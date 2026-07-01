// scripts/applyTierPricingAndNumberedPieces.cjs
//
// Apply supabase/migrations/20261101_add_tier_pricing_and_numbered_pieces.sql
// to the live Supabase Postgres. Mirrors scripts/runRlsMigration.cjs (pg.Pool
// + multi-conn-string fallback). Idempotent: the migration uses
//   ADD COLUMN IF NOT EXISTS
//   CREATE TABLE IF NOT EXISTS
//   CREATE OR REPLACE FUNCTION
//   DROP POLICY IF EXISTS before CREATE POLICY
// so re-runs are safe.
//
// What this lands in production:
//   * public.products.edition_size        INT
//   * public.products.pricing_tiers       JSONB
//   * public.numbered_pieces              table + RLS policies
//   * public.get_product_paid_count(p_id TEXT) -> INT  RPC
//
// Used by:
//   * services/numberedPieces.ts > fetchPaidCountsByProduct()
//   * pages/ProductDetails.tsx (cohort-progress tracker "X/50 minted at $Y")
//   * api/complete-order.ts (server-side tier price re-verification)
//
// Source repo: C:\Users\SG\OneDrive\WebApps\SGCoalition

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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
  console.log('Trying ' + label + '...');
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    const client = await pool.connect();
    console.log('SUCCESS Connected via ' + label);
    return { client, pool };
  } catch (e) {
    console.log('FAILED ' + label + ': ' + e.message.substring(0, 100));
    try { await pool.end(); } catch {}
    return null;
  }
}

async function main() {
  const env = loadEnv();
  const projectRef = 'tvacscfbzcmjlcekjcsn';
  const token = env.SUPABASE || '';
  if (!token) {
    console.error('No SUPABASE token in .env (runRlsMigration.cjs expects SUPABASE=...)');
    console.error('Add a database password / direct-connect token and re-run.');
    process.exit(1);
  }
  const encodedToken = encodeURIComponent(token);

  const attempts = [
    ['direct DB', 'postgresql://postgres.' + projectRef + ':' + encodedToken + '@db.' + projectRef + '.supabase.co:5432/postgres'],
    ['pooler session', 'postgresql://postgres.' + projectRef + ':' + encodedToken + '@aws-0-us-east-1.pooler.supabase.com:5432/postgres'],
    ['pooler transaction', 'postgresql://postgres.' + projectRef + ':' + encodedToken + '@aws-0-us-east-1.pooler.supabase.com:6543/postgres'],
  ];

  let conn = null;
  for (const [label, connStr] of attempts) {
    conn = await tryConnect(label, connStr);
    if (conn) break;
  }

  if (!conn) {
    console.log('\nCould not connect to database. Run the SQL manually:');
    console.log('  1. https://supabase.com/dashboard/project/' + projectRef + '/sql');
    console.log('  2. Paste supabase/migrations/20261101_add_tier_pricing_and_numbered_pieces.sql');
    console.log('  3. Click Run');
    process.exit(1);
  }

  const { client, pool } = conn;
  try {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261101_add_tier_pricing_and_numbered_pieces.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('\nApplying tier-pricing + numbered-pieces migration...');
    await client.query(sql);
    console.log('Migration executed successfully');

    console.log('\nVerifying schema state...');
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('products', 'numbered_pieces', 'orders') ORDER BY table_name"
    );
    console.log('\nTables present (expected: products, orders; numbered_pieces is being added):');
    for (const r of tables.rows) console.log('  - ' + r.table_name);

    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name IN ('edition_size', 'pricing_tiers', 'is_limited_edition') ORDER BY column_name"
    );
    console.log('\nTier-pricing columns on products (expected: all three):');
    for (const r of cols.rows) console.log('  - ' + r.column_name);

    const fns = await client.query(
      "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_product_paid_count'"
    );
    console.log('\nPaid-count RPC (expected: get_product_paid_count):');
    for (const r of fns.rows) console.log('  - ' + r.routine_name);

    const policies = await client.query(
      "SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'numbered_pieces' ORDER BY policyname"
    );
    console.log('\nnumbered_pieces policies (expected: 2):');
    for (const r of policies.rows) console.log('  - ' + r.policyname + ' (' + r.cmd + ')');
  } catch (e) {
    console.error('\nSQL execution error:', e.message);
    if (e.code) console.error('pg error code: ' + e.code);
  } finally {
    try { client.release(); } catch {}
    try { await pool.end(); } catch {}
  }
}

main();
