const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const seedSqlPath = path.join(rootDir, 'supabase', 'migrations', '20240611_seed_brain_entries.sql');

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

async function main() {
  const sql = fs.readFileSync(seedSqlPath, 'utf8');
  const { client, pool } = await connect();

  try {
    console.log(`Running ${path.relative(rootDir, seedSqlPath)}...`);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    const seeded = await client.query(`
      SELECT title
      FROM public.brain_entries
      WHERE metadata->>'seed_source' = 'coalition_brain_bootstrap'
      ORDER BY importance DESC, title ASC;
    `);

    console.log(`Seeded/updated ${seeded.rowCount} Coalition Brain entries:`);
    for (const row of seeded.rows) {
      console.log(`- ${row.title}`);
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Brain bootstrap failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

main();
