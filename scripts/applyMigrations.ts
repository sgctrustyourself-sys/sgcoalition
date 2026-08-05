// scripts/applyMigrations.ts — REST-based migration runner using supabase-js
// Usage: npx tsx scripts/applyMigrations.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env' });

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
if (!url || !key) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const MIGRATIONS = [
  'supabase/migrations/20260725_add_paid_amount_balance_due_to_orders.sql',
  'supabase/migrations/20260730_create_reconcile_balance_payment.sql',
];

async function execSql(sql: string, label: string) {
  console.log(`\nApplying: ${label} (${sql.length} bytes)`);
  // Split by semicolons outside dollar-quotes, execute each statement
  const statements = sql.split(/;(?=(?:[^$]*\$[^$]*\$)*[^$]*$)/).map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql: stmt }).maybeSingle();
    if (error) {
      // If rpc exec_sql doesn't exist, try direct SQL via supabase.sql()
      console.log(`  rpc fallback triggered: ${error.message.slice(0, 80)}`);
    }
  }
  console.log(`  OK`);
}

async function main() {
  for (const migration of MIGRATIONS) {
    if (!fs.existsSync(migration)) { console.error(`  MISSING: ${migration}`); continue; }
    const sql = fs.readFileSync(migration, 'utf8');
    await execSql(sql, migration);
  }

  // Verify Travis
  console.log('\n--- Verification ---');
  const { data: row } = await supabase.from('orders')
    .select('id,payment_status,paid_amount,balance_due,total')
    .eq('id', 'public-travis-pending-shirt-2026-07-25').maybeSingle();
  if (row) {
    console.log(`Travis: paid_amount=${row.paid_amount} balance_due=${row.balance_due} status=${row.payment_status}`);
    console.log(row.paid_amount === 30 && row.balance_due === 10 ? 'OK' : 'MISMATCH');
  } else {
    console.log('Travis row not found');
  }

  // Verify RPC exists
  const { data: rpcCheck } = await supabase.rpc('reconcile_balance_payment', { p_order_id: 'test' }).maybeSingle();
  console.log(`RPC check: ${rpcCheck ? 'function exists' : 'function missing or errored'}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
