// scripts/createGetProductPaidCountRpc.cjs
//
// Focused idempotent migration that creates/replaces ONLY the
// public.get_product_paid_count RPC. Use this after a Supabase reset
// (project pause, restore from backup, manual schema delete) drops the
// routine; the app otherwise logs
//   [numberedPieces] get_product_paid_count failed for ... (PGRST202)
// and storefront cohort counters read "0 / N minted at $Y" forever.
//
// This script is a SUBSET of scripts/applyTierPricingAndNumberedPieces.cjs.
// The runner applies the FULL migration (numbered_pieces table +
// edition_size + pricing_tiers columns + tier policies +
// get_product_paid_count). Run THIS script when ONLY the function is
// missing on an otherwise-healthy schema -- it's faster and won't
// touch columns that are already in place.
//
// SQL body mirrors the function definition committed in
// supabase/migrations/20261101_add_tier_pricing_and_numbered_pieces.sql
// (paid-orders' items JSONB summed by productId). Re-run safe: CREATE
// OR REPLACE FUNCTION replaces the body in place.

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

const SQL = `
CREATE OR REPLACE FUNCTION public.get_product_paid_count(p_id TEXT)
RETURNS INT AS $$
    SELECT COALESCE(SUM((item->>'quantity')::int), 0)::int
    FROM public.orders o,
         jsonb_array_elements(o.items) AS item
    WHERE o.payment_status = 'paid'
      AND item->>'productId' = p_id;
$$ LANGUAGE SQL STABLE;
`;

async function main() {
  const env = loadEnv();
  const projectRef = 'tvacscfbzcmjlcekjcsn';
  const token = env.SUPABASE || '';
  if (!token) {
    console.error('No SUPABASE token in .env (database password / direct-connect token expected).');
    console.error('Add a token and re-run.');
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
    console.log('\nCould not connect to Supabase Postgres. Run the SQL manually:');
    console.log('  1. https://supabase.com/dashboard/project/' + projectRef + '/sql');
    console.log('  2. Paste the function body below and click Run\n');
    console.log(SQL);
    process.exit(1);
  }

  const { client, pool } = conn;
  try {
    console.log('\nCreating public.get_product_paid_count RPC...');
    await client.query(SQL);
    console.log('Function created/replaced successfully.\n');

    const fns = await client.query(
      "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'get_product_paid_count'"
    );
    console.log('Verified routine (expected: get_product_paid_count):');
    for (const r of fns.rows) console.log('  - ' + r.routine_name);

    if (fns.rows.length === 0) {
      console.error('\nFunction still not present after CREATE OR REPLACE. Inspect Postgres logs.');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('\nSQL execution error:', e.message);
    if (e.code) console.error('pg error code: ' + e.code);
    // Non-zero exit so CI / shell chaining can detect a failed apply.
    // Release + pool.end() still run in the finally block below.
    process.exitCode = 1;
  } finally {
    try { client.release(); } catch {}
    try { await pool.end(); } catch {}
  }
}

main();
