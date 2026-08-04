// scripts/applyMigrationsSql.ts
// REST-based migration runner: uses pg (over TLS to Supabase pooler) with
// the SUPABASE env var from .env as the database password.
// No separate SUPABASE_DB_PASSWORD needed — the existing .env has SUPABASE.
//
// USAGE: npx tsx scripts/applyMigrationsSql.ts

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';

dotenv.config({ path: '.env' });

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS = [
  'supabase/migrations/20260725_add_paid_amount_balance_due_to_orders.sql',
  'supabase/migrations/20260730_create_reconcile_balance_payment.sql',
  'supabase/migrations/20260730_create_payments_table.sql',
];
const TRAVIS_ORDER_ID = 'public-travis-pending-shirt-2026-07-25';

function firstEnv(names: string[]): string {
  for (const name of names) {
    if (process.env[name]) return process.env[name]!;
  }
  return '';
}

function inferProjectRef(): string {
  const explicit = firstEnv(['SUPABASE_PROJECT_REF', 'SUPABASE_REF']);
  if (explicit) return explicit;
  const supabaseUrl = firstEnv(['VITE_SUPABASE_URL', 'SUPABASE_URL']);
  if (!supabaseUrl) return '';
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const match = hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return match ? match[1] : '';
  } catch { return ''; }
}

function buildConnectionString(projectRef: string, password: string, suffix: string): string {
  const encoded = encodeURIComponent(password);
  return `postgresql://postgres.${projectRef}:${encoded}@aws-0-us-west-2.pooler.supabase.com:${suffix}/postgres`;
}

async function connect(): Promise<{ client: pg.PoolClient; pool: pg.Pool }> {
  const projectRef = inferProjectRef();
  const password = firstEnv(['SUPABASE_DB_PASSWORD', 'POSTGRES_PASSWORD', 'SUPABASE']);

  if (!projectRef) {
    console.error('Cannot infer Supabase project ref. Set VITE_SUPABASE_URL.');
    process.exit(1);
  }
  if (!password) {
    console.error('No database password found. Set SUPABASE_DB_PASSWORD or SUPABASE in .env.');
    process.exit(1);
  }

  const attempts: [string, string][] = [
    ['pooler session', buildConnectionString(projectRef, password, '5432')],
    ['pooler transaction', buildConnectionString(projectRef, password, '6543')],
  ];

  for (const [label, connStr] of attempts) {
    const pool = new pg.Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      const client = await pool.connect();
      console.log(`Connected via ${label}`);
      return { client, pool };
    } catch (err: any) {
      console.log(`  ${label}: ${err.message.slice(0, 100)}`);
      await pool.end().catch(() => {});
    }
  }

  console.error('Could not connect to Supabase Postgres.');
  process.exit(1);
}

async function main() {
  console.log('Coalition Migration Runner (pg + dotenv)');
  console.log('');

  const { client, pool } = await connect();

  try {
    for (const migrationPath of MIGRATIONS) {
      const fullPath = path.join(ROOT, migrationPath);
      if (!fs.existsSync(fullPath)) {
        console.error(`  MISSING: ${migrationPath}`);
        continue;
      }
      const sql = fs.readFileSync(fullPath, 'utf8');
      console.log(`Applying: ${migrationPath} (${sql.length} bytes)...`);
      await client.query(sql);
      console.log(`  OK`);
    }

    // Verify paid_amount + balance_due columns
    console.log('\n--- Column Verification ---');
    const cols = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders'
       AND column_name IN ('paid_amount', 'balance_due')
       ORDER BY column_name`
    );
    for (const row of cols.rows) {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable=${row.is_nullable}, default=${row.column_default})`);
    }

    // Verify Travis row
    console.log('\n--- Travis Row ---');
    const travis = await client.query(
      `SELECT id, payment_status, paid_amount, balance_due, total
       FROM orders WHERE id = $1`,
      [TRAVIS_ORDER_ID]
    );
    if (travis.rowCount === 0) {
      console.log(`  Row ${TRAVIS_ORDER_ID} not found`);
    } else {
      const r = travis.rows[0];
      console.log(`  payment_status: ${r.payment_status}`);
      console.log(`  paid_amount:    ${r.paid_amount} (expected 30)`);
      console.log(`  balance_due:    ${r.balance_due} (expected 10)`);
      console.log(`  total:          ${r.total}`);
      const ok = Number(r.paid_amount) === 30 && Number(r.balance_due) === 10;
      console.log(`  ${ok ? 'OK - columns populated correctly' : 'MISMATCH - check regex'}`);
    }

    // Verify RPC function exists
    console.log('\n--- RPC Verification ---');
    const rpc = await client.query(
      `SELECT proname FROM pg_proc WHERE proname = 'reconcile_balance_payment'`
    );
    if (rpc.rowCount && rpc.rowCount > 0) {
      console.log('  reconcile_balance_payment RPC exists');
    } else {
      console.log('  RPC NOT FOUND - second migration may have failed');
    }

    console.log('\nDone.');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

main();
