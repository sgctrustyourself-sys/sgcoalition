// =============================================================================
// /scripts/migrateArchiveNote.cjs
// -----------------------------------------------------------------------------
// Idempotently adds the `archive_note` TEXT column to public.products. Same
// pattern as scripts/migrateImageRoles.cjs: pre-flight check via
// information_schema, dry-run + --apply modes, and a SQL Editor fallback
// printed so an operator without DB credentials can still apply the change.
//
// Companion migration file: supabase/migrations/20260701_add_archive_note_to_products.sql
//
// USAGE
//   node scripts/migrateArchiveNote.cjs                # pre-flight + dry-run
//   node scripts/migrateArchiveNote.cjs --apply        # actually ALTER TABLE
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
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    } catch { /* fall through */ }
    return { rejectUnauthorized: false };
}

async function connect() {
    for (const [label, connectionString] of connectionAttempts()) {
        const pool = new Pool({ connectionString, ssl: sslForConnection(connectionString), connectionTimeoutMillis: 8000 });
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

const SQL_PREFLIGHT = `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name = 'archive_note';
`;

const SQL_APPLY = `
    ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS archive_note TEXT;

    COMMENT ON COLUMN public.products.archive_note IS
        'Operator-authored copy shown beneath the buy button on sold/archived PDPs. Mirrors Product.archiveNote on the client.';
`;

function printSqlFallback() {
    console.log('\nFallback (paste into Supabase SQL Editor if you do not have DB credentials):');
    console.log('---------------------------------------------------------------');
    console.log(SQL_APPLY.trim());
    console.log('---------------------------------------------------------------');
}

async function main() {
    const args = process.argv.slice(2);
    const isApply = args.includes('--apply');
    const isDryRun = !isApply;

    const { client, pool } = await connect();
    try {
        const pre = await client.query(SQL_PREFLIGHT);
        const hasColumn = pre.rowCount > 0;

        if (hasColumn) {
            console.log(`\n[OK] archive_note already exists on public.products (${pre.rows[0].data_type}).`);
            if (isDryRun) console.log('Nothing to do.');
            return;
        }

        if (isDryRun) {
            console.log('\n[DRY-RUN] archive_note column missing on public.products.');
            console.log('Pass --apply to ALTER TABLE public.products ADD COLUMN archive_note TEXT.\n');
            printSqlFallback();
            return;
        }

        console.log('\n[APPLY] Adding archive_note column to public.products.');
        await client.query(SQL_APPLY);
        console.log('Added archive_note column.');
        console.log('Re-run to confirm idempotency: node scripts/migrateArchiveNote.cjs');
        console.log('Next: rebuild the storefront; AppContext will surface archive_note via the products row mapper.');
    } catch (e) {
        if (/column .*archive_note.* already exists/i.test(e.message)) {
            console.log('[OK] archive_note already exists (caught on the ALTER).');
            return;
        }
        console.error('Migration failed:', e.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end().catch(() => {});
    }
}

main();
