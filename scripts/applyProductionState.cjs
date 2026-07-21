// scripts/applyProductionState.cjs
//
// Two-phase idempotent runner for the production_state migration:
//   Phase 1: 20260722_create_production_state_table.sql (table + RLS + seed)
//            → applies via any candidate (pooler OR direct).
//   Phase 2: 20260722_publish_production_state_for_realtime.sql
//            → applies via DIRECT-only candidate. `ALTER PUBLICATION` is
//              a session-level op that poolers reject.
//
// Mirrors scripts/applyWalletMints7dView.cjs verbatim. A future refactor
// could collapse both into a single generic `applyRealtimeMigration.cjs`
// that takes the migration name as argv[2].
// --------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const TABLE_SQL = path.join(ROOT, 'supabase', 'migrations', '20260722_create_production_state_table.sql');
const PUB_SQL   = path.join(ROOT, 'supabase', 'migrations', '20260722_publish_production_state_for_realtime.sql');

// ---------------------------------------------------------------------------
// .env loader
// ---------------------------------------------------------------------------
function loadDotenv(filePath) {
    if (!fs.existsSync(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (!m) continue;
        const [, key, raw] = m;
        if (process.env[key] !== undefined) continue;
        let val = raw;
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
    }
}
loadDotenv(path.join(ROOT, '.env'));

const firstEnv = (names) => { for (const n of names) if (process.env[n]) return process.env[n]; return ''; };

function inferProjectRef() {
    if (process.env.SUPABASE_PROJECT_REF || process.env.SUPABASE_REF) return process.env.SUPABASE_PROJECT_REF || process.env.SUPABASE_REF;
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const m = url.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/);
    return m ? m[1] : '';
}

function sslForConnection(connStr) {
    if (process.env.SUPABASE_DB_SSL === 'disable') return false;
    const isLocal = /localhost|127\.0\.0\.1/i.test(connStr);
    return isLocal ? false : { rejectUnauthorized: false };
}

function buildCandidates() {
    const direct = firstEnv(['SUPABASE_DB_URL', 'DATABASE_URL', 'POSTGRES_URL']);
    if (direct) {
        const isPooler = /pooler\.supabase\.com/i.test(direct);
        if (isPooler) {
            console.warn('[production_state] SUPABASE_DB_URL is a pooler URL — phase 2 (publication) will not be applied. Re-run with direct credentials, or paste supabase/migrations/20260722_publish_production_state_for_realtime.sql into the Supabase Dashboard SQL Editor.');
        }
        return [{ label: isPooler ? 'pooler-url' : 'direct-url', connStr: direct, direct: !isPooler }];
    }
    const ref = inferProjectRef();
    const password = firstEnv(['SUPABASE_DB_PASSWORD', 'POSTGRES_PASSWORD', 'SUPABASE']);
    if (!ref || !password) return [];
    const region = process.env.SUPABASE_POOLER_REGION || 'aws-0-us-west-2';
    return [
        { label: `pooler-session:${region}`, connStr: `postgres://postgres.${ref}:${encodeURIComponent(password)}@${region}.pooler.supabase.com:5432/postgres`, direct: false },
        { label: `pooler-tx:${region}`,      connStr: `postgres://postgres.${ref}:${encodeURIComponent(password)}@${region}.pooler.supabase.com:6543/postgres`, direct: false },
        { label: 'direct',                   connStr: `postgres://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`, direct: true },
        { label: 'direct-legacy',            connStr: `postgres://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`, direct: true },
    ];
}

async function applyPhase(label, sqlPath, candidates) {
    const sql = fs.readFileSync(sqlPath, 'utf8');
    let lastErr = null;
    for (const c of candidates) {
        const client = new Client({ connectionString: c.connStr, ssl: sslForConnection(c.connStr) });
        try {
            await client.connect();
            console.log(`[${label}] connected via ${c.label}`);
            await client.query(sql);
            console.log(`[${label}] applied (${c.label}).`);
            try { await client.end(); } catch (_) { /* ignore */ }
            return c.label;
        } catch (e) {
            lastErr = e;
            console.warn(`[${label}] ${c.label} failed: ${e.message}`);
            try { await client.end(); } catch (_) { /* ignore */ }
        }
    }
    console.error(`[${label}] all candidates failed. Last error: ${lastErr?.message}`);
    return null;
}

async function verifyRow(client) {
    const v = await client.query('SELECT currently_being_built_label, last_drop_at, on_deck_label, on_deck_cylinder_current, on_deck_cylinder_total FROM public.production_state WHERE id = 1');
    const r = v.rows[0];
    if (!r) { console.log('   (no production_state row found)'); return; }
    console.log(`   production_state row: ${r.currently_being_built_label} | last_drop_at=${r.last_drop_at.toISOString()} | on_deck=${r.on_deck_label} (cylinder ${r.on_deck_cylinder_current} of ${r.on_deck_cylinder_total})`);
}

async function verifyPublication(client) {
    const p = await client.query(
        `SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = 'production_state'`
    );
    console.log(p.rows.length === 1
        ? '   production_state is in supabase_realtime publication ✓'
        : '   ⚠ production_state is NOT in supabase_realtime publication — re-run phase 2 or check.');
}

async function main() {
    const all = buildCandidates();
    if (all.length === 0) {
        console.error('❌ No Supabase credentials found.');
        console.error('   Set SUPABASE_DB_URL or SUPABASE_DB_PASSWORD + VITE_SUPABASE_URL in .env');
        process.exit(2);
    }
    const ph1 = await applyPhase('phase-1 table+seed', TABLE_SQL, all.filter(c => true));
    if (!ph1) { console.error('❌ Phase 1 failed — table not created.'); process.exit(1); }

    const directConn = all.find(c => c.direct) ?? null;
    if (directConn) {
        const client = new Client({ connectionString: directConn.connStr, ssl: sslForConnection(directConn.connStr) });
        try { await client.connect(); await verifyRow(client); await client.end(); } catch (e) { console.warn(`   (verify skipped — ${e.message})`); }
    }

    const ph2 = await applyPhase('phase-2 publication', PUB_SQL, all.filter(c => c.direct));
    if (!ph2) {
        console.error('⚠ Phase 2 failed — table exists but NOT in supabase_realtime.');
        console.error('   Apply the publication manually in Supabase Dashboard → SQL Editor → paste supabase/migrations/20260722_publish_production_state_for_realtime.sql');
        process.exit(3);
    }
    if (directConn) {
        const client = new Client({ connectionString: directConn.connStr, ssl: sslForConnection(directConn.connStr) });
        try { await client.connect(); await verifyPublication(client); await client.end(); } catch (e) { console.warn(`   (verify skipped — ${e.message})`); }
    }
    console.log('✅ Two-phase production_state migration complete.');
}

main().catch((e) => { console.error('💥 Unexpected error:', e); process.exit(1); });
