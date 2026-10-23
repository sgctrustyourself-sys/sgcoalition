// scripts/applyMigrations.ts
// Auto-discovering migration runner for supabase/migrations/YYYYMMDD_*.sql.
//
// Picks up every *timestamped* migration file automatically — no hardcoded
// list to maintain. Non-timestamped legacy files (create_referral_system.sql,
// initialize_existing_users.sql, …) are the pre-timestamping history and are
// deliberately excluded from auto-run.
//
// Applied files are tracked in a `schema_migrations` table (version = the
// full filename, which is unique even when two migrations share a timestamp
// prefix), so re-runs are no-ops and each migration runs exactly once — in
// timestamp order.
//
// Deferred files: supabase/migrations/.deferred lists migrations that must
// NOT be auto-applied (production was provisioned selectively; several
// authored migrations were never run there). Deferred files are skipped in
// every mode unless a line is removed from the manifest.
//
// USAGE (from project root):
//   npx tsx scripts/applyMigrations.ts                      # apply pending migrations
//   npx tsx scripts/applyMigrations.ts --check              # show applied vs pending, apply nothing
//   npx tsx scripts/applyMigrations.ts --baseline           # record current files as applied (no execution)
//   npx tsx scripts/applyMigrations.ts --baseline 20260804,20260806   # record ONLY the given versions
//
// Existing production DBs: the app's schema was built selectively (SQL editor
// pastes + ad-hoc SQL outside this folder), so several timestamped files were
// never applied there. Baseline only the verifiably-applied subset, then
// review `--check` output before ever running apply against production.
//
// Credentials: SUPABASE_DB_PASSWORD (or SUPABASE) in .env, or DATABASE_URL
// for a direct connection string. Same pooler fallback chain as
// scripts/applyPaymentSettingsMigration.ts.

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';

dotenv.config({ path: '.env' });

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
// Only proper timestamped migrations are auto-picked-up.
const TIMESTAMP_RE = /^(\d{8})_.*\.sql$/;
const DEFERRED_FILE = path.join(MIGRATIONS_DIR, '.deferred');

/** Load the deferred manifest (migration filenames to skip), if present. */
function loadDeferred(): Set<string> {
    const set = new Set<string>();
    if (!fs.existsSync(DEFERRED_FILE)) return set;
    for (const raw of fs.readFileSync(DEFERRED_FILE, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        set.add(line);
    }
    return set;
}

const TRACKING_DDL = `
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version    text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
);
`;

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
    } catch {
        return '';
    }
}

function buildConnectionString(projectRef: string, password: string, suffix: string): string {
    const encoded = encodeURIComponent(password);
    return `postgresql://postgres.${projectRef}:${encoded}@aws-0-us-west-2.pooler.supabase.com:${suffix}/postgres`;
}

async function connect(): Promise<{ client: pg.PoolClient; pool: pg.Pool }> {
    const projectRef = inferProjectRef();
    const password = firstEnv(['SUPABASE_DB_PASSWORD', 'POSTGRES_PASSWORD', 'SUPABASE']);

    const attempts: [string, string][] = [];
    const directUrl = firstEnv(['DATABASE_URL', 'SUPABASE_DB_URL', 'POSTGRES_URL']);
    if (directUrl) {
        attempts.push(['direct url', directUrl]);
    }
    if (projectRef && password) {
        attempts.push(
            ['pooler session', buildConnectionString(projectRef, password, '5432')],
            ['pooler transaction', buildConnectionString(projectRef, password, '6543')],
        );
    }

    if (attempts.length === 0) {
        console.error(
            !projectRef
                ? 'Cannot infer Supabase project ref. Set VITE_SUPABASE_URL.'
                : 'No database credentials found. Set SUPABASE_DB_PASSWORD (or DATABASE_URL).',
        );
        process.exit(1);
    }

    for (const [label, connStr] of attempts) {
        const pool = new pg.Pool({
            connectionString: connStr,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 8000,
        });
        try {
            const client = await pool.connect();
            console.log(`Connected via ${label}${projectRef ? ` (project ${projectRef})` : ''}`);
            return { client, pool };
        } catch (err: any) {
            console.log(`  ${label}: ${err.message.slice(0, 100)}`);
            await pool.end().catch(() => {});
        }
    }

    console.error('Could not connect to Supabase Postgres.');
    process.exit(1);
}

/** Discover timestamped migration files, sorted by version ascending. */
function discoverMigrations(): { version: string; file: string; fullPath: string }[] {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
        process.exit(1);
    }
    const found: { version: string; file: string; fullPath: string }[] = [];
    for (const name of fs.readdirSync(MIGRATIONS_DIR)) {
        const m = name.match(TIMESTAMP_RE);
        if (!m) continue; // skip non-timestamped legacy files
        found.push({ version: name, file: name, fullPath: path.join(MIGRATIONS_DIR, name) });
    }
    // Sort by the 8-digit timestamp prefix, then by filename (so two files
    // sharing a prefix keep a deterministic order).
    found.sort((a, b) => a.version.localeCompare(b.version));
    return found;
}

async function main() {
    const mode = process.argv[2] || 'apply';
    if (!['apply', '--check', '--baseline'].includes(mode)) {
        console.error(`Unknown mode: ${mode}. Use apply | --check | --baseline`);
        process.exit(1);
    }
    // --baseline accepts a comma-separated list of 8-digit prefixes (expands
    // to every file with that prefix) and/or exact filenames.
    const onlyVersions = process.argv[3]
        ? new Set(process.argv[3].split(',').map((v) => v.trim()).filter(Boolean))
        : null;
    if (onlyVersions) {
        for (const v of Array.from(onlyVersions)) {
            if (!/^\d{8}$/.test(v) && !/^\d{8}_.*\.sql$/.test(v)) {
                console.error(`Invalid version in --baseline list: ${v} (expected YYYYMMDD or a migration filename)`);
                process.exit(1);
            }
        }
    }

    const deferred = loadDeferred();
    const migrations = discoverMigrations();
    console.log(`Coalition Migration Runner — ${mode === '--check' ? 'check' : mode === '--baseline' ? 'baseline' : 'apply'}`);
    console.log(`Discovered ${migrations.length} timestamped migrations` + (deferred.size ? ` (${deferred.size} deferred)` : '') + ':');
    for (const m of migrations) {
        const tag = deferred.has(m.version) ? '  [deferred]' : '';
        console.log(`  ${m.version}  ${m.file}${tag}`);
    }
    console.log('');

    const { client, pool } = await connect();
    try {
        await client.query(TRACKING_DDL);

        const tracked = await client.query('SELECT version FROM public.schema_migrations');
        const appliedSet = new Set<string>(tracked.rows.map((r: any) => r.version));

        const applied = migrations.filter((m) => appliedSet.has(m.version));
        const deferredList = migrations.filter((m) => !appliedSet.has(m.version) && deferred.has(m.version));
        const pending = migrations.filter((m) => !appliedSet.has(m.version) && !deferred.has(m.version));

        console.log(`Applied:  ${applied.length}`);
        console.log(`Deferred: ${deferredList.length}`);
        console.log(`Pending:  ${pending.length}`);
        console.log('');

        if (mode !== '--baseline' && deferredList.length) {
            console.log('Deferred (skipped — remove from supabase/migrations/.deferred to apply):');
            for (const m of deferredList) console.log(`  deferred  ${m.version}`);
            console.log('');
        }

        if (mode === '--check') {
            for (const m of pending) console.log(`  pending  ${m.version}`);
            console.log('\nNothing applied (--check).');
            return;
        }

        if (mode === '--baseline') {
            const isWanted = (m: { version: string }) =>
                onlyVersions === null || onlyVersions.has(m.version) || onlyVersions.has(m.version.slice(0, 8));
            const targets = onlyVersions ? migrations.filter(isWanted) : pending;
            if (onlyVersions) {
                const matched = new Set<string>();
                for (const m of migrations) if (isWanted(m)) matched.add(m.version.slice(0, 8));
                const missing = Array.from(onlyVersions).filter((v) => !matched.has(v.slice(0, 8)));
                if (missing.length) {
                    console.error(`Unknown version(s) requested: ${missing.join(', ')}`);
                    process.exit(1);
                }
            }
            let recorded = 0;
            for (const m of targets) {
                await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [m.version]);
                console.log(`  baseline  ${m.version}`);
                recorded++;
            }
            console.log(`\nBaseline complete — recorded ${recorded} migration(s) as applied (not executed).`);
            return;
        }

        // apply mode
        if (pending.length === 0) {
            console.log('Nothing to apply — schema is up to date.');
            return;
        }

        for (const m of pending) {
            const sql = fs.readFileSync(m.fullPath, 'utf8');
            console.log(`Applying: ${m.version} (${sql.length} bytes)...`);
            try {
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [m.version]);
                await client.query('COMMIT');
                console.log('  OK');
            } catch (err: any) {
                await client.query('ROLLBACK').catch(() => {});
                console.error(`  FAILED — rolled back: ${err.message}`);
                console.error(`  Remaining pending: ${pending.filter((x) => x.version > m.version).map((x) => x.version).join(', ') || '(none)'}`);
                process.exit(1);
            }
        }

        console.log(`\nDone — applied ${pending.length} migration(s).`);
    } finally {
        client.release();
        await pool.end().catch(() => {});
    }
}

main();
