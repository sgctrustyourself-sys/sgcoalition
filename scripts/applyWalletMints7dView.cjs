// scripts/applyWalletMints7dView.cjs
//
// Two-phase idempotent runner for the wallet_mints_7d migration:
//   Phase 1: 20260721_create_wallet_mints_7d_view.sql (view + grant)
//            → applies via any candidate (pooler OR direct).
//   Phase 2: 20260721_publish_wallet_mints_7d_for_realtime.sql
//            → applies via DIRECT-only candidate. `ALTER PUBLICATION`
//              is a session-level op that poolers (ports 5432/6543 on
//              pooler.supabase.com) reject.
//
// Connection-fallback chain mirrors scripts/applyProductColumnMigrations.cjs.
// Phase 2 only walks the direct candidates so we never accidentally apply
// the publication to a pooler connection.
// --------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const VIEW_SQL = path.join(ROOT, 'supabase', 'migrations', '20260721_create_wallet_mints_7d_view.sql');
const PUB_SQL  = path.join(ROOT, 'supabase', 'migrations', '20260721_publish_wallet_mints_7d_for_realtime.sql');

// ---------------------------------------------------------------------------
// .env loader
// ---------------------------------------------------------------------------
function loadDotenv(filePath) {
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (!m) continue;
        const [, key, raw] = m;
        if (process.env[key] !== undefined) continue;
        let val = raw;
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
    }
}
loadDotenv(path.join(ROOT, '.env'));

const firstEnv = (names) => {
    for (const n of names) if (process.env[n]) return process.env[n];
    return '';
};

function inferProjectRef() {
    if (process.env.SUPABASE_PROJECT_REF || process.env.SUPABASE_REF) {
        return process.env.SUPABASE_PROJECT_REF || process.env.SUPABASE_REF;
    }
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const m = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/);
    return m ? m[1] : '';
}

function sslForConnection(connStr) {
    if (process.env.SUPABASE_DB_SSL === 'disable') return false;
    const isLocal = /localhost|127\.0\.0\.1/i.test(connStr);
    return isLocal ? false : { rejectUnauthorized: false };
}

function buildCandidates() {
    const direct = firstEnv(['SUPABASE_DB_URL', 'DATABASE_URL', 'POSTGRES_URL']);
    if (direct) {
        // Sniff the host: if the URL points at the pooler, ALTER PUBLICATION
        // (phase 2) will reject — tag as direct:false so phase 2 fails loudly
        // with 'publication needs direct' rather than silently dropping the
        // ALTER. The user can then paste phase-2 SQL into the Supabase
        // Dashboard SQL Editor to complete publication.
        const isPooler = /pooler\.supabase\.com/i.test(direct);
        if (isPooler) {
            console.warn('[walletMints7d] SUPABASE_DB_URL is a pooler URL — phase 2 (publication) will not be applied. Re-run with direct credentials, or paste supabase/migrations/20260721_publish_wallet_mints_7d_for_realtime.sql into the Supabase Dashboard SQL Editor.');
        }
        return [{ label: isPooler ? 'pooler-url' : 'direct-url', connStr: direct, direct: !isPooler }];
    }
    const ref = inferProjectRef();
    const password = firstEnv(['SUPABASE_DB_PASSWORD', 'POSTGRES_PASSWORD', 'SUPABASE']);
    if (!ref || !password) return [];
    const region = process.env.SUPABASE_POOLER_REGION || 'aws-0-us-west-2';
    return [
        // Pooler candidates — direct=false: only phase 1 will use these.
        { label: `pooler-session:${region}`,
          connStr: `postgres://postgres.${ref}:${encodeURIComponent(password)}@${region}.pooler.supabase.com:5432/postgres`,
          direct: false },
        { label: `pooler-tx:${region}`,
          connStr: `postgres://postgres.${ref}:${encodeURIComponent(password)}@${region}.pooler.supabase.com:6543/postgres`,
          direct: false },
        // Direct candidates — phase 2 (ALTER PUBLICATION) only.
        { label: 'direct',
          connStr: `postgres://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`,
          direct: true },
        { label: 'direct-legacy',
          connStr: `postgres://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`,
          direct: true },
    ];
}

// ---------------------------------------------------------------------------
// Apply one SQL file across the relevant candidates.
// Returns the label of the candidate that succeeded, or null.
// ---------------------------------------------------------------------------
async function applyPhase(label, sqlPath, candidates) {
    const sql = fs.readFileSync(sqlPath, 'utf8');
    let lastErr = null;
    for (const c of candidates) {
        const client = new Client({ connectionString: c.connStr, ssl: sslForConnection(c.connStr) });
        try {
            await client.connect();
            console.log(`[${label}] connected via ${c.label}`);
            await client.query(sql);
            console.log(`[${label}] applied (${c.label}).`);
            try { await client.end(); } catch (_) { /* ignore */ }
            return c.label;
        } catch (e) {
            lastErr = e;
            console.warn(`[${label}] ${c.label} failed: ${e.message}`);
            try { await client.end(); } catch (_) { /* ignore */ }
        }
    }
    console.error(`[${label}] all candidates failed. Last error: ${lastErr?.message}`);
    return null;
}

async function verifyView(client) {
    const v = await client.query('SELECT mint_count FROM public.wallet_mints_7d');
    console.log(`   public.wallet_mints_7d.mint_count = ${v.rows[0].mint_count}`);
}

async function verifyPublication(client) {
    const p = await client.query(
        `SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = 'wallet_mints_7d'`
    );
    console.log(p.rows.length === 1
        ? '   wallet_mints_7d is in supabase_realtime publication ✓'
        : '   ⚠ wallet_mints_7d is NOT in supabase_realtime publication — re-apply publication phase or check.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    const all = buildCandidates();
    if (all.length === 0) {
        console.error('❌ No Supabase credentials found.');
        console.error('   Set SUPABASE_DB_URL or SUPABASE_DB_PASSWORD + VITE_SUPABASE_URL in .env');
        process.exit(2);
    }

    const phase1Conn = all.filter(c => true);                            // any
    const phase2Conn = all.filter(c => c.direct);                        // direct-only

    const ph1 = await applyPhase('phase-1 view+grant', VIEW_SQL, phase1Conn);
    if (!ph1) {
        console.error('❌ Phase 1 failed — view not created. Aborting before phase 2.');
        process.exit(1);
    }

    // Prefer the same connection for verify (only meaningful when direct).
    const directConn = all.find(c => c.direct) ?? null;
    if (directConn) {
        const client = new Client({ connectionString: directConn.connStr, ssl: sslForConnection(directConn.connStr) });
        try {
            await client.connect();
            await verifyView(client);
            await client.end();
        } catch (e) {
            console.warn(`   (verify skipped — ${e.message})`);
        }
    }

    const ph2 = await applyPhase('phase-2 publication', PUB_SQL, phase2Conn);
    if (!ph2) {
        console.error('⚠ Phase 2 failed — view exists but view NOT in supabase_realtime.');
        console.error('   Apply the publication manually in Supabase Dashboard → SQL Editor.');
        process.exit(3);
    }
    if (directConn) {
        const client = new Client({ connectionString: directConn.connStr, ssl: sslForConnection(directConn.connStr) });
        try {
            await client.connect();
            await verifyPublication(client);
            await client.end();
        } catch (e) {
            console.warn(`   (verify skipped — ${e.message})`);
        }
    }

    console.log('✅ Two-phase migration complete.');
}

main().catch((e) => { console.error('💥 Unexpected error:', e); process.exit(1); });

