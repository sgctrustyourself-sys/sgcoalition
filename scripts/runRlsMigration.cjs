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
  console.log(`Trying ${label}...`);
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
  try {
    const client = await pool.connect();
    console.log(`✅ Connected via ${label}`);
    return client;
  } catch (e) {
    console.log(`❌ ${label}: ${e.message.substring(0, 100)}`);
    try { await pool.end(); } catch {}
    return null;
  }
}

async function main() {
  const env = loadEnv();
  const projectRef = 'tvacscfbzcmjlcekjcsn';
  const token = env.SUPABASE || '';
  if (!token) { console.error('No SUPABASE token'); process.exit(1); }
  const encodedToken = encodeURIComponent(token);

  // Try multiple connection methods
  const attempts = [
    ['direct DB', `postgresql://postgres.${projectRef}:${encodedToken}@db.${projectRef}.supabase.co:5432/postgres`],
    ['pooler session', `postgresql://postgres.${projectRef}:${encodedToken}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`],
    ['pooler transaction', `postgresql://postgres.${projectRef}:${encodedToken}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`],
  ];

  let client = null;
  for (const [label, connStr] of attempts) {
    client = await tryConnect(label, connStr);
    if (client) break;
  }

  if (!client) {
    console.log('\n❌ Could not connect to database.');
    console.log('\n📋 To run this migration manually:');
    console.log('   1. Go to https://supabase.com/dashboard/project/tvacscfbzcmjlcekjcsn');
    console.log('   2. Open SQL Editor');
    console.log('   3. Paste the contents of: supabase/migrations/20240611_add_rls_policies.sql');
    console.log('   4. Click Run');
    process.exit(1);
  }

  try {
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20240611_add_rls_policies.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('\n🚀 Running RLS migration...');
    await client.query(sql);
    console.log('✅ Migration executed successfully');

    console.log('\n📊 Verifying RLS status...');
    const verify = await client.query("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;");
    console.log('\nTable                          RLS');
    console.log('─────────────────────────────────────');
    verify.rows.forEach(r => console.log(`  ${r.tablename.padEnd(30)} ${r.rowsecurity ? '✅ ON' : '❌ OFF'}`));

    const policies = await client.query("SELECT tablename, count(*) as cnt FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename ORDER BY tablename;");
    console.log('\nPolicies per table:');
    let total = 0;
    policies.rows.forEach(r => { console.log(`  ${r.tablename.padEnd(30)} ${r.cnt}`); total += parseInt(r.cnt); });
    console.log(`\n✅ Total: ${total} policies across ${policies.rows.length} tables`);

    client.release();
    console.log('\n🎉 RLS migration complete! All tables secured.');
  } catch (e) {
    console.error('\n❌ SQL execution error:', e.message);
  }
  try { await client.release(); } catch {}
}
main();
