// =============================================================================
// /scripts/apply_tier_pricing_to_shirts.cjs
// -----------------------------------------------------------------------------
// Applies the Coalition numbered-edition tier-pricing configuration to every
// category='shirt' product in Supabase that does not already have one. Pattern
// matches the user's live brief: first 44 units priced at $75, units 45+ at
// $100; edition_size = 44 (drives the X/44 marker on PDP + numbered-piece
// auto-binding).
//
// Mirrors supabase/migrations/20261101_add_tier_pricing_and_numbered_pieces.sql.
//
// USAGE
//   node scripts/apply_tier_pricing_to_shirts.cjs            # dry-run (default)
//   node scripts/apply_tier_pricing_to_shirts.cjs --apply    # actually write
//
// The dry-run lists every shirt product that would be touched and prints the
// wholesale write payload. The --apply branch executes the UPDATE inside a
// transaction and prints the RETURNING rows for an audit trail.
//
// CONNECTION MODEL
//   Mirrors scripts/seedBrain.cjs: pg + multi-attempt pool/direct connection + dotenv.
//   Reads from .env (gitignored) via dotenv; or set SUPABASE_DB_URL directly.
// =============================================================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

function firstEnv(names) {
    for (const name of names) {
        if (process.env[name]) return process.env[name];
    }
    return '';
}

function inferProjectRef() {
    const explicit = firstEnv(['SUPABASE_PROJECT_REF', 'SUPABASE_REF']);
    if (explicit) return explicit;

    const supabaseUrl = firstEnv(['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']);
    if (!supabaseUrl) return '';
    try {
        const hostname = new URL(supabaseUrl).hostname;
        const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
        return match ? match[1] : '';
    } catch {
        return '';
    }
}

function connectionAttempts() {
    const explicitUrl = firstEnv(['SUPABASE_DB_URL', 'DATABASE_URL', 'POSTGRES_URL']);
    if (explicitUrl) {
        return [['explicit database url', explicitUrl]];
    }
    const projectRef = inferProjectRef();
    const dbPassword = firstEnv(['SUPABASE_DB_PASSWORD', 'POSTGRES_PASSWORD', 'SUPABASE']);
    if (!projectRef || !dbPassword) {
        console.error('Missing Supabase database connection settings.');
        console.error('Set SUPABASE_DB_URL, or set VITE_SUPABASE_URL plus SUPABASE_DB_PASSWORD.');
        console.error('SUPABASE is still accepted as a legacy database password name.');
        process.exit(1);
    }
    const encodedPassword = encodeURIComponent(dbPassword);
    const poolerRegion = process.env.SUPABASE_POOLER_REGION || 'aws-0-us-east-1';
    return [
        ['pooler session', `postgresql://postgres.${projectRef}:${encodedPassword}@${poolerRegion}.pooler.supabase.com:5432/postgres`],
        ['pooler transaction', `postgresql://postgres.${projectRef}:${encodedPassword}@${poolerRegion}.pooler.supabase.com:6543/postgres`],
        ['direct database', `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`],
        ['direct database legacy user', `postgresql://postgres.${projectRef}:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`],
    ];
}

function sslForConnection(connectionString) {
    if (process.env.SUPABASE_DB_SSL) {
        return process.env.SUPABASE_DB_SSL.toLowerCase() !== 'false'
            ? { rejectUnauthorized: false }
            : false;
    }
    try {
        const hostname = new URL(connectionString).hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return false;
        }
    } catch {
        return { rejectUnauthorized: false };
    }
    return { rejectUnauthorized: false };
}

async function connect() {
    for (const [label, connectionString] of connectionAttempts()) {
        const pool = new Pool({
            connectionString,
            ssl: sslForConnection(connectionString),
            connectionTimeoutMillis: 8000,
        });
        try {
            const client = await pool.connect();
            console.log(`Connected via ${label}`);
            return { client, pool };
        } catch (error) {
            console.log(`${label}: ${error.message.substring(0, 120)}`);
            await pool.end().catch(() => {});
        }
    }
    console.error('Could not connect to Supabase Postgres.');
    process.exit(1);
}

// Tier config straight from the user's brief. Keep these as named constants so
// the dry-run and the UPDATE can't drift apart.
const TIER_JSON = JSON.stringify([
    { until_count: 44, price: 75 },
    { until_count: null, price: 100 },
]);
const EDITION_SIZE = 44;

const SQL_PREFLIGHT = `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name IN ('pricing_tiers', 'edition_size')
    ORDER BY column_name;
`;

// Dry-run: list every shirt product that lacks tier pricing now.
// LOWER(category) = LOWER('shirt') collapses 'shirt' / 'Shirt' / 'SHIRT' to
// the same match. Plural 'shirts' is intentionally NOT matched (different
// word) — operator should rename the column value first if they want it
// included.
const SQL_SELECT_UNTOUCHED = `
    SELECT id, name, category, archived, pricing_tiers, edition_size, created_at
    FROM public.products
    WHERE LOWER(category) = LOWER('shirt')
      AND (pricing_tiers IS NULL OR pricing_tiers = 'null'::jsonb)
    ORDER BY created_at DESC;
`;

// Apply: tier-write inside a transaction. RETURNING gives the operator a
// post-run audit trail of which rows were actually touched.
const SQL_APPLY = `
    UPDATE public.products
    SET
        pricing_tiers = $1::jsonb,
        edition_size = $2
    WHERE LOWER(category) = LOWER('shirt')
      AND (pricing_tiers IS NULL OR pricing_tiers = 'null'::jsonb)
    RETURNING id, name, edition_size;
`;

function printSqlFallback() {
    const safeTier = TIER_JSON.replace(/'/g, "''");
    console.log('\nFallback (paste into Supabase SQL Editor if you do not have DB credentials):');
    console.log('---------------------------------------------------------------');
    console.log(`UPDATE public.products`);
    console.log(`SET`);
    console.log(`    pricing_tiers = '${safeTier}'::jsonb,`);
    console.log(`    edition_size  = ${EDITION_SIZE}`);
    console.log(`WHERE LOWER(category) = LOWER('shirt')`);
    console.log(`  AND (pricing_tiers IS NULL OR pricing_tiers = 'null'::jsonb)`);
    console.log(`RETURNING id, name, edition_size;`);
    console.log('---------------------------------------------------------------');
}

async function main() {
    const args = process.argv.slice(2);
    const isApply = args.includes('--apply');
    const isDryRun = !isApply;

    const { client, pool } = await connect();

    try {
        // Schema pre-flight: be loud (not silent) if 20261101 wasn't applied.
        const pre = await client.query(SQL_PREFLIGHT);
        const cols = new Set(pre.rows.map((r) => r.column_name));
        if (!cols.has('pricing_tiers') || !cols.has('edition_size')) {
            console.error('\n[ERROR] Supabase is missing required columns.');
            console.error('Detected on public.products:', Array.from(cols));
            console.error('Apply supabase/migrations/20261101_add_tier_pricing_and_numbered_pieces.sql first, then re-run.');
            printSqlFallback();
            process.exit(2);
        }

        if (isDryRun) {
            console.log('\n[DRY-RUN] Listing category=shirt products that lack tier pricing. Pass --apply to commit.\n');
            const r = await client.query(SQL_SELECT_UNTOUCHED);
            if (r.rowCount === 0) {
                console.log('(no rows matched — every shirt already has pricing_tiers set)');
            } else {
                console.log(`${r.rowCount} matching row${r.rowCount === 1 ? '' : 's'}:\n`);
                for (const row of r.rows) {
                    const archived = row.archived ? 'archived' : 'live';
                    console.log(`  - ${row.id}  |  ${row.name}  |  ${archived}  |  created_at=${row.created_at}`);
                }
            }

            console.log(`\nPlanned wholesale write (per matching row):`);
            console.log(`  pricing_tiers = ${TIER_JSON}`);
            console.log(`  edition_size  = ${EDITION_SIZE}`);
            console.log('\nRe-run with --apply to commit.');
            printSqlFallback();
            return;
        }

        console.log('\n[APPLY] Updating category=shirt products that lack tier pricing.');
        await client.query('BEGIN');
        const r = await client.query(SQL_APPLY, [TIER_JSON, EDITION_SIZE]);
        await client.query('COMMIT');

        if (r.rowCount === 0) {
            console.log('(no rows updated — every shirt already had pricing_tiers set)');
        } else {
            console.log(`\nUpdated ${r.rowCount} row${r.rowCount === 1 ? '' : 's'}:`);
            for (const row of r.rows) {
                console.log(`  - ${row.id}  |  ${row.name}  |  edition_size=${row.edition_size}`);
            }
            console.log(`\nWholesale write applied: pricing_tiers=${TIER_JSON}, edition_size=${EDITION_SIZE}.`);
            console.log('Next: rebuild the storefront (Vite picks up pricing_tiers / edition_size on next fetchProducts);');
            console.log('server-side tier re-verify at api/complete-order.ts will now gate orders against the live supply.');
        }
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        if (/column .*pricing_tiers.* does not exist/i.test(e.message)
            || /column .*edition_size.* does not exist/i.test(e.message)) {
            console.error('\n[ERROR] Schema check failed: pricing_tiers / edition_size column missing.');
            console.error('Apply supabase/migrations/20261101_add_tier_pricing_and_numbered_pieces.sql first.');
            printSqlFallback();
            process.exit(2);
        }
        console.error('Migration failed:', e.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end().catch(() => {});
    }
}

main();
