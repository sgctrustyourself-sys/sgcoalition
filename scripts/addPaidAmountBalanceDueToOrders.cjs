// scripts/addPaidAmountBalanceDueToOrders.cjs
//
// One-shot migration runner that applies
//   supabase/migrations/20260725_add_paid_amount_balance_due_to_orders.sql
// against the prod Supabase database, then verifies the new columns land
// and re-checks Travis's row to confirm paid_amount=30, balance_due=10.
//
// CONNECTION mirrors scripts/applyProductColumnMigrations.cjs:
//   1. SUPABASE_DB_URL / DATABASE_URL / POSTGRES_URL  (verbatim)
//   2. Supabase PG pooler session     (port 5432)
//   3. Supabase PG pooler transaction (port 6543)
//   4. Direct Supabase DB             (port 5432 on db.{ref}.supabase.co)
//
// USAGE   node scripts/addPaidAmountBalanceDueToOrders.cjs
// EXIT    0 ok / 1 env or connection or verification failed

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_FILE = '20260725_add_paid_amount_balance_due_to_orders.sql';
const MIGRATION_PATH = path.join(ROOT, 'supabase', 'migrations', MIGRATION_FILE);
const TRAVIS_ORDER_ID = 'public-travis-pending-shirt-2026-07-25';

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
    if (explicitUrl) return [['explicit database url', explicitUrl]];

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
    const poolerRegion = process.env.SUPABASE_POOLER_REGION || 'aws-0-us-west-2';

    return [
        ['pooler session', 'postgresql://postgres.' + projectRef + ':' + encodedPassword + '@' + poolerRegion + '.pooler.supabase.com:5432/postgres'],
        ['pooler transaction', 'postgresql://postgres.' + projectRef + ':' + encodedPassword + '@' + poolerRegion + '.pooler.supabase.com:6543/postgres'],
        ['direct database', 'postgresql://postgres:' + encodedPassword + '@db.' + projectRef + '.supabase.co:5432/postgres'],
        ['direct database legacy user', 'postgresql://postgres.' + projectRef + ':' + encodedPassword + '@db.' + projectRef + '.supabase.co:5432/postgres'],
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
        if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
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
            console.log('Connected via ' + label);
            return { client, pool };
        } catch (error) {
            console.log(label + ': ' + error.message.substring(0, 160));
            await pool.end().catch(() => {});
        }
    }
    console.error('Could not connect to Supabase Postgres with any method.');
    process.exit(1);
}

async function main() {
    loadDotenv();

    if (!fs.existsSync(MIGRATION_PATH)) {
        console.error('Migration file missing: ' + MIGRATION_PATH);
        process.exit(1);
    }

    console.log('Applying migration:');
    console.log('  ' + path.relative(ROOT, MIGRATION_PATH));

    const { client, pool } = await connect();

    try {
        const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
        await client.query(sql);
        console.log('Migration committed.\n');

        const cols = await client.query(
            "SELECT column_name, data_type, is_nullable, column_default " +
            "FROM information_schema.columns " +
            "WHERE table_schema = 'public' AND table_name = 'orders' " +
            "AND column_name IN ('paid_amount', 'balance_due') " +
            "ORDER BY column_name"
        );

        console.log('Post-migration column state on public.orders:');
        if (cols.rowCount === 0) {
            console.error('  (none of the expected columns were found - investigate)');
            process.exit(1);
        }
        for (const row of cols.rows) {
            const def = row.column_default !== null ? ', default=' + row.column_default : '';
            console.log('  ' + row.column_name.padEnd(14) + ' ' + row.data_type + ' (nullable=' + row.is_nullable + def + ')');
        }

        const travis = await client.query(
            'SELECT id, payment_status, paid_amount, balance_due, total, notes FROM public.orders WHERE id = $1',
            [TRAVIS_ORDER_ID]
        );

        let failed = false;
        if (travis.rowCount === 0) {
            console.log('  Travis row (' + TRAVIS_ORDER_ID + ') not found - skipping per-order verification.\n');
        } else {
            const r = travis.rows[0];
            const paid = Number(r.paid_amount);
            const bal = Number(r.balance_due);
            const ok = paid === 30 && bal === 10;
            console.log('Travis row verification (' + r.id + '):');
            console.log('  payment_status: ' + r.payment_status);
            console.log('  paid_amount:    ' + paid + ' (expected 30)');
            console.log('  balance_due:    ' + bal + ' (expected 10)');
            console.log('  total:          ' + r.total);
            console.log('  notes:          ' + (r.notes || '').slice(0, 100));
            if (!ok) {
                console.error('  FAIL - Travis row backfilled with the wrong values. Re-check the regex.');
                failed = true;
            } else {
                console.log('  OK - paid_amount + balance_due match the parsed notes.\n');
            }
        }

        if (failed) {
            process.exitCode = 1;
        } else {
            console.log('Done.');
        }
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end().catch(() => {});
    }
}

main();
