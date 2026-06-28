// scripts/applyProductColumnMigrations.cjs
//
// One-shot migration runner that applies the two pending products-table column
// migrations to the prod Supabase database in one transaction:
//   - supabase/migrations/20260620_add_is_limited_edition_to_products.sql
//   - supabase/migrations/20260628_add_product_making_video_url.sql
//
// Both migrations are idempotent (ALTER TABLE ... ADD COLUMN IF NOT EXISTS),
// so re-running this script is safe.
//
// Connection strategy mirrors scripts/seedBrain.cjs:
//   1. SUPABASE_DB_URL / DATABASE_URL / POSTGRES_URL  (verbatim, if set)
//   2. Supabase PG pooler session     (port 5432 on aws-0-us-east-1 pooler)
//   3. Supabase PG pooler transaction (port 6543 on aws-0-us-east-1 pooler)
//   4. Direct Supabase DB             (port 5432 on db.{ref}.supabase.co)
//
// Honors the legacy SUPABASE env var as the DB password because the project's
// first migrations (scripts/runRlsMigration.cjs) were applied using it.
//
// Usage: node scripts/applyProductColumnMigrations.cjs

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');

function loadDotenv() {
    const envPath = path.join(ROOT, '.env');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.substring(0, eqIdx).trim();
        let value = trimmed.substring(eqIdx + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
    });
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
    const supabaseUrl = firstEnv(['VITE_SUPABASE_URL', 'SUPABASE_URL']);
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
    const dbPassword = firstEnv([
        'SUPABASE_DB_PASSWORD',
        'POSTGRES_PASSWORD',
        'SUPABASE',
    ]);
    if (!projectRef || !dbPassword) {
        console.error('Missing Supabase database connection settings.');
        console.error('Set SUPABASE_DB_URL, or set VITE_SUPABASE_URL plus one of:');
        console.error('  SUPABASE_DB_PASSWORD / POSTGRES_PASSWORD / SUPABASE (legacy).');
        process.exit(1);
    }

    const encodedPassword = encodeURIComponent(dbPassword);

    // This Supabase project is provisioned in aws-0-us-west-2. Brute-force probing
    // all other regions returns `(ENOTFOUND) tenant/user <ref> not found` from
    // Supavisor; only us-west-2 reaches the password step. Override with the
    // SUPABASE_POOLER_REGION env var if your project lives elsewhere.
    const poolerRegion = process.env.SUPABASE_POOLER_REGION || 'aws-0-us-west-2';

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
    const attempts = connectionAttempts();
    for (const [label, connectionString] of attempts) {
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
            console.log(`${label}: ${error.message.substring(0, 160)}`);
            await pool.end().catch(() => {});
        }
    }
    console.error('Could not connect to Supabase Postgres with any method.');
    process.exit(1);
}

async function main() {
    loadDotenv();

    const migrationFiles = [
        '20260620_add_is_limited_edition_to_products.sql',
        '20260628_add_product_making_video_url.sql',
    ];

    console.log('Applying pending product-column migrations:');
    for (const file of migrationFiles) {
        console.log(`  - ${path.relative(ROOT, path.join(MIGRATIONS_DIR, file))}`);
    }

    const { client, pool } = await connect();

    try {
        await client.query('BEGIN');
        for (const file of migrationFiles) {
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            console.log(`\nRunning ${file} ...`);
            await client.query(sql);
        }
        await client.query('COMMIT');
        console.log('\nMigrations committed.\n');

        const verify = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'products'
              AND column_name IN ('is_limited_edition', 'making_video_url')
            ORDER BY column_name;
        `);

        console.log('Post-migration column state on public.products:');
        if (verify.rowCount === 0) {
            console.log('  (none of the expected columns were found - investigate)');
        } else {
            for (const row of verify.rows) {
                const def = row.column_default !== null ? `, default=${row.column_default}` : '';
                console.log(
                    `  ${row.column_name.padEnd(22)} ${row.data_type} (nullable=${row.is_nullable}${def})`,
                );
            }
        }

        if (verify.rowCount < 2) {
            console.error('\nExpected 2 columns to be present. Got', verify.rowCount);
            process.exitCode = 1;
        }
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('\nMigration failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end().catch(() => {});
    }
}

main();
