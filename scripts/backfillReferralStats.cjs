// One-time backfill: create a `referral_stats` row for every `auth.users`
// row that doesn't already have one. Mirrors the SQL trigger from
// `create_referral_system.sql` so the schema + code format are identical.
//
// Why: the `create_referral_stats_on_signup` trigger only fires for new
// Supabase auth signups. Users who existed before the trigger was
// applied (migration drift, manual `INSERT INTO auth.users`, etc.) have
// no row, and the dashboard's `getReferralStats` returned `null` for
// them. The client-side self-heal in `utils/referralSystem.ts` will
// still catch the rest as a fallback, but this backfill is the proper
// one-shot repair.
//
// Idempotent: `ON CONFLICT (user_id) DO NOTHING` makes it safe to re-run.
//
// Usage:
//   node scripts/backfillReferralStats.cjs              # real run
//   node scripts/backfillReferralStats.cjs --dry-run    # count only, no writes
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.substring(0, eqIdx).trim();
        let value = trimmed.substring(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        env[key] = value;
    });
    return env;
}

async function tryConnect(label, connectionString) {
    console.log(`Trying ${label}...`);
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    try {
        const client = await pool.connect();
        console.log(`Connected via ${label}`);
        return { client, pool };
    } catch (e) {
        console.log(`${label} failed: ${e.message.substring(0, 100)}`);
        try { await pool.end(); } catch { }
        return null;
    }
}

// Explicit `(user_id)` conflict target so future unique indexes added by
// later migrations can't silently change the inference. `RETURNING`
// only includes actually-inserted rows (skipped conflicts aren't
// returned), so `rowCount` is the correct metric.
const BACKFILL_SQL = `
INSERT INTO referral_stats (user_id, referral_code)
SELECT
    u.id,
    'SG-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6))
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM referral_stats rs WHERE rs.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING
RETURNING user_id, referral_code;
`;

const COUNT_NEEDED_SQL = `
SELECT COUNT(*)::int AS missing
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM referral_stats rs WHERE rs.user_id = u.id
);
`;

const COUNT_TOTAL_SQL = `SELECT COUNT(*)::int AS total FROM referral_stats;`;

async function main() {
    const env = loadEnv();
    const projectRef = 'tvacscfbzcmjlcekjcsn';
    const token = env.SUPABASE || '';
    if (!token) {
        console.error('No SUPABASE token in .env');
        process.exit(1);
    }
    const encodedToken = encodeURIComponent(token);

    // Mirror the same fallback ladder as runRlsMigration.cjs.
    const attempts = [
        ['direct DB', `postgresql://postgres.${projectRef}:${encodedToken}@db.${projectRef}.supabase.co:5432/postgres`],
        ['pooler session', `postgresql://postgres.${projectRef}:${encodedToken}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`],
        ['pooler transaction', `postgresql://postgres.${projectRef}:${encodedToken}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`],
    ];

    let handle = null;
    for (const [label, connStr] of attempts) {
        handle = await tryConnect(label, connStr);
        if (handle) break;
    }
    if (!handle) {
        console.log('\nCould not connect to database via any method.');
        console.log('\nTo run the backfill manually:');
        console.log('   1. Go to https://supabase.com/dashboard/project/tvacscfbzcmjlcekjcsn');
        console.log('   2. Open SQL Editor');
        console.log('   3. Paste the contents of: supabase/migrations/20260712_backfill_referral_stats.sql');
        console.log('   4. Click Run');
        process.exit(1);
    }
    const { client, pool } = handle;

    try {
        // Pre-count
        const totalBefore = (await client.query(COUNT_TOTAL_SQL)).rows[0].total;
        const missing = (await client.query(COUNT_NEEDED_SQL)).rows[0].missing;
        console.log(`\nPre-flight:`);
        console.log(`   referral_stats rows: ${totalBefore}`);
        console.log(`   auth.users missing a stats row: ${missing}`);

        if (missing === 0) {
            console.log('\nNothing to backfill. All auth.users already have a referral_stats row.');
            client.release();
            await pool.end();
            return;
        }

        if (DRY_RUN) {
            console.log(`\n--dry-run set: would INSERT ${missing} row(s) into referral_stats.`);
            console.log('   Re-run without --dry-run to apply.');
            client.release();
            await pool.end();
            return;
        }

        // Wrap in a transaction so a mid-INSERT failure rolls back cleanly
        // instead of leaving a partial backfill committed. BEGIN is
        // *inside* the try so a `BEGIN` failure (broken connection,
        // server in recovery) doesn't skip the ROLLBACK branch. ROLLBACK
        // itself can also fail (the BEGIN already failed), so we
        // .catch() it rather than masking the real error.
        console.log(`\nBackfilling ${missing} missing referral_stats row(s)...`);
        let inserted;
        try {
            await client.query('BEGIN');
            const result = await client.query(BACKFILL_SQL);
            inserted = result.rowCount;
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK').catch(() => { });
            throw e;
        }
        console.log(`Inserted: ${inserted} row(s)`);

        // Post-count. NOTE: drift of 1-2 here is expected if a new user
        // signed up between the pre-count and the post-count (the
        // trigger would have added their row). Anything larger
        // warrants investigation.
        const totalAfter = (await client.query(COUNT_TOTAL_SQL)).rows[0].total;
        const expected = totalBefore + inserted;
        const drift = totalAfter - expected;
        console.log(`\nPost-flight:`);
        console.log(`   referral_stats rows: ${totalAfter} (was ${totalBefore})`);
        if (drift === 0) {
            console.log(`Counters line up - no drift.`);
        } else {
            console.log(`Drift: ${drift} (expected ${expected}, got ${totalAfter}).`);
            console.log(`   Likely a concurrent signup; re-run is safe.`);
        }

        // Spot-check: confirm no duplicate referral_codes.
        const dupes = await client.query(`
            SELECT referral_code, COUNT(*)::int AS n
            FROM referral_stats
            GROUP BY referral_code
            HAVING COUNT(*) > 1
            ORDER BY n DESC
            LIMIT 5;
        `);
        if (dupes.rows.length === 0) {
            console.log(`No duplicate referral_codes.`);
        } else {
            console.log(`Found ${dupes.rows.length} duplicate referral_code(s) (top 5):`);
            dupes.rows.forEach(r => console.log(`   ${r.referral_code}  x${r.n}`));
        }

        console.log(`\nBackfill complete. ${inserted} new referral_stats row(s) created.`);
        console.log(`   The client-side self-heal in utils/referralSystem.ts is now a fallback.`);
    } catch (e) {
        console.error('\nSQL execution error:', e.message);
        process.exit(1);
    } finally {
        try { client.release(); } catch { }
        try { await pool.end(); } catch { }
    }
}

main();
