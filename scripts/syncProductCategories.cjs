// =============================================================================
// /scripts/syncProductCategories.cjs
// -----------------------------------------------------------------------------
// One-shot sync of public.products.category for 3 products so the storefront
// matches the local constants.ts source of truth:
//
//   prod_tee_above_as_below             -> 'shirt'
//   prod_shorts_above_as_below          -> 'shorts'
//   prod_hoodie_overwhelmingly_patient  -> 'sweatshirt'
//
// Pattern mirrors scripts/apply_tier_pricing_to_shirts.cjs:
//   - pg + multi-attempt pool/direct connection + dotenv
//   - dry-run default, --apply to commit
//   - SQL_APPLY generated from CATEGORY_TARGETS (no hardcoded divergence)
//   - CHECK constraint pre-flight so a stale whitelist surfaces clearly
//   - WHERE id IN (...) blast-radius guard
//   - RETURNING audit row
//
// USAGE
//   node scripts/syncProductCategories.cjs             # dry-run (default)
//   node scripts/syncProductCategories.cjs --apply     # actually write
// =============================================================================

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

function firstEnv(names) {
    for (const name of names) if (process.env[name]) return process.env[name];
    return '';
}

function inferProjectRef() {
    const explicit = firstEnv(['SUPABASE_PROJECT_REF', 'SUPABASE_REF']);
    if (explicit) return explicit;
    const supabaseUrl = firstEnv(['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL']);
    if (!supabaseUrl) return '';
    try {
        const match = new URL(supabaseUrl).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
        return match ? match[1] : '';
    } catch { return ''; }
}

function connectionAttempts() {
    const explicitUrl = firstEnv(['SUPABASE_DB_URL', 'DATABASE_URL', 'POSTGRES_URL']);
    if (explicitUrl) return [['explicit database url', explicitUrl]];
    const projectRef = inferProjectRef();
    const dbPassword = firstEnv(['SUPABASE_DB_PASSWORD', 'POSTGRES_PASSWORD', 'SUPABASE']);
    if (!projectRef || !dbPassword) {
        console.error('Missing Supabase DB credentials. Set SUPABASE_DB_URL, or VITE_SUPABASE_URL + SUPABASE_DB_PASSWORD.');
        process.exit(1);
    }
    const enc = encodeURIComponent(dbPassword);
    const region = process.env.SUPABASE_POOLER_REGION || 'aws-0-us-east-1';
    return [
        ['pooler session', `postgresql://postgres.${projectRef}:${enc}@${region}.pooler.supabase.com:5432/postgres`],
        ['pooler transaction', `postgresql://postgres.${projectRef}:${enc}@${region}.pooler.supabase.com:6543/postgres`],
        ['direct database', `postgresql://postgres:${enc}@db.${projectRef}.supabase.co:5432/postgres`],
        ['direct database legacy user', `postgresql://postgres.${projectRef}:${enc}@db.${projectRef}.supabase.co:5432/postgres`],
    ];
}

function sslFor(cs) {
    if (process.env.SUPABASE_DB_SSL && process.env.SUPABASE_DB_SSL.toLowerCase() === 'false') return false;
    try {
        const h = new URL(cs).hostname;
        if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
    } catch { /* fall through */ }
    return { rejectUnauthorized: false };
}

async function connect() {
    for (const [label, cs] of connectionAttempts()) {
        const pool = new Pool({ connectionString: cs, ssl: sslFor(cs), connectionTimeoutMillis: 8000 });
        try {
            const client = await pool.connect();
            console.log(`Connected via ${label}`);
            return { client, pool };
        } catch (err) {
            console.log(`${label}: ${err.message.substring(0, 120)}`);
            await pool.end().catch(() => {});
        }
    }
    console.error('Could not connect to Supabase Postgres.');
    process.exit(1);
}

// Single source of truth. SQL_APPLY is BUILT from this array so the array
// and the SQL string cannot drift apart.
const CATEGORY_TARGETS = [
    { id: 'prod_tee_above_as_below',          category: 'shirt' },
    { id: 'prod_shorts_above_as_below',       category: 'shorts' },
    { id: 'prod_hoodie_overwhelmingly_patient', category: 'sweatshirt' },
];

const TARGET_IDS = CATEGORY_TARGETS.map((t) => t.id);

const SQL_PREFLIGHT = `
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name IN ('category', 'id', 'name')
`;

const SQL_CHECK_CONSTRAINT = `
    SELECT pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'products' AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%category%'
`;

// Build UPDATE … FROM (VALUES …) dynamically from CATEGORY_TARGETS. Binds
// the rows as a JSON array of [id, category] tuples so the array is the
// only source of truth, no string duplication.
const SQL_APPLY = `
    UPDATE public.products AS p
    SET category = v.category
    FROM jsonb_to_recordset($1::jsonb) AS v(id text, category text)
    WHERE p.id = v.id
    RETURNING p.id, p.name, p.category
`;

const SQL_SELECT_CURRENT = `
    SELECT id, name, category
    FROM public.products
    WHERE id = ANY($1::text[])
    ORDER BY id
`;

function printFallbackSql() {
    // The Supabase SQL Editor does NOT accept $N bound parameters, so the
    // jsonb_to_recordset form used by SQL_APPLY can't be pasted directly.
    // Emit a literal UPDATE ... FROM (VALUES (...)) form that runs verbatim
    // inside the SQL Editor UI. Postgres VALUES requires a comma between
    // tuples — a previous bare-newline variant failed to parse.
    const tuplesSql = CATEGORY_TARGETS
        .map((t) => `    ('${t.id}', '${t.category}')`)
        .join(',\n');
    const sql = [
        'UPDATE public.products',
        'SET category = v.category',
        'FROM (VALUES',
        tuplesSql,
        ') AS v(id, category)',
        'WHERE public.products.id = v.id',
        'RETURNING public.products.id, public.products.name, public.products.category;',
    ].join('\n');
    // Self-check: count only separator commas between tuples. A previous
    // version counted every comma in the block (including the intra-tuple
    // ones inside (id, category)), which always warned on valid output.
    // Separator tuples look like '),\n    (' — match those exactly. With
    // N tuples there must be exactly N-1 separator commas.
    const expectedSeparators = Math.max(0, CATEGORY_TARGETS.length - 1);
    const actualSeparators = (tuplesSql.match(/\),\s*\n\s*\(/g) || []).length;
    if (actualSeparators !== expectedSeparators) {
        console.warn(`[warn] printFallbackSql expected ${expectedSeparators} separator commas between tuples, found ${actualSeparators}. The pasted SQL will likely fail to parse.`);
    }
    console.log('\nFallback (paste into Supabase SQL Editor if PG direct connection is unavailable):');
    console.log('---------------------------------------------------------------');
    console.log(sql);
    console.log('---------------------------------------------------------------');
}

function diff(currentRows) {
    const m = new Map(currentRows.map((r) => [r.id, r]));
    console.log('\n  id                                       current    -> target');
    console.log('  ---------------------------------------- ----------- ----------');
    let drift = 0, missing = 0;
    for (const t of CATEGORY_TARGETS) {
        const row = m.get(t.id);
        if (!row) {
            console.log(`  ${t.id.padEnd(40)} ${'(row missing)'.padEnd(12)} -> ${t.category}`);
            missing += 1;
            continue;
        }
        const cur = String(row.category || '(null)');
        const same = cur.toLowerCase() === t.category.toLowerCase();
        const marker = same ? '=' : '!';
        if (!same) drift += 1;
        console.log(`  ${t.id.padEnd(40)} ${cur.padEnd(12)} ${marker}-> ${t.category}`);
    }
    return { drift, missing };
}

async function main() {
    const isApply = process.argv.slice(2).includes('--apply');
    const { client, pool } = await connect();

    try {
        const preCols = new Set((await client.query(SQL_PREFLIGHT)).rows.map((r) => r.column_name));
        if (!preCols.has('id') || !preCols.has('name') || !preCols.has('category')) {
            console.error('\n[ERROR] public.products missing required columns. Detected:', Array.from(preCols));
            process.exit(2);
        }

        // CHECK constraint pre-flight: surface a "category not in whitelist"
        // violation BEFORE the COMMIT instead of mid-transaction rollback.
        const checks = (await client.query(SQL_CHECK_CONSTRAINT)).rows.map((r) => r.def).join('\n');
        if (checks) {
            const want = CATEGORY_TARGETS.map((t) => t.category);
            const allowed = checks.match(/\([^)]*\)/);
            console.log('\n[info] products.category CHECK constraint detected:');
            console.log('  ' + checks.replace(/\n/g, '\n  '));
            if (allowed && want.some((c) => !allowed[0].includes(`'${c}'`) && !allowed[0].includes(`"${c}"`))) {
                console.error('\n[ERROR] One or more target categories are not in the existing CHECK whitelist.');
                console.error('Whitelist:', allowed[0]);
                console.error('Targets needing whitelist update:', want.filter((c) => !allowed[0].includes(`'${c}'`)));
                console.error('Add them to the constraint first, then re-run this script.');
                process.exit(2);
            }
        } else {
            console.log('\n[info] No CHECK constraint on products.category — direct write is allowed.');
        }

        const current = await client.query(SQL_SELECT_CURRENT, [TARGET_IDS]);
        const { drift, missing } = diff(current.rows);

        if (!isApply) {
            console.log(`\n[DRY-RUN] ${drift} row${drift === 1 ? '' : 's'} would be updated${missing ? `, ${missing} target id${missing === 1 ? ' is' : 's are'} missing on Supabase` : ''}.`);
            console.log(`\nPlanned write (single UPDATE, scope = 3 ids):`);
            console.log(`  payload: ${JSON.stringify(CATEGORY_TARGETS)}`);
            console.log('\nRe-run with --apply to commit.');
            printFallbackSql();
            return;
        }

        console.log('\n[APPLY] Committing category sync for 3 product rows.');
        await client.query('BEGIN');
        const r = await client.query(SQL_APPLY, [JSON.stringify(CATEGORY_TARGETS)]);
        await client.query('COMMIT');
        console.log(`\nUpdated ${r.rowCount} row${r.rowCount === 1 ? '' : 's'}:`);
        for (const row of r.rows) console.log(`  - ${row.id}  |  ${row.name}  |  category=${row.category}`);

        const post = await client.query(SQL_SELECT_CURRENT, [TARGET_IDS]);
        console.log('\nPost-run state:');
        for (const row of post.rows) console.log(`  ${row.id.padEnd(40)} category=${row.category}`);
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Migration failed:', e.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end().catch(() => {});
    }
}

main();
