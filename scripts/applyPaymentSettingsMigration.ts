// scripts/applyPaymentSettingsMigration.ts
// One-off migration runner for supabase/migrations/20260804_create_payment_settings.sql
// (owner-controlled payment-option toggles). Same pattern as applyMigrationsSql.ts:
// pg over TLS to the Supabase pooler, DB password from the SUPABASE env var.
//
// USAGE: npx tsx scripts/applyPaymentSettingsMigration.ts

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import pg from 'pg';

dotenv.config({ path: '.env' });

// Run from the project root (npx tsx scripts/applyPaymentSettingsMigration.ts).
// Optional argv[2] = migration path (defaults to the payment_settings
// migration). To apply both pending migrations at once, pass the combined
// file:
//   npx tsx scripts/applyPaymentSettingsMigration.ts supabase/migrations/PENDING_COMBINED_paste_into_sql_editor.sql
const ROOT = process.cwd();
const DEFAULT_MIGRATION = 'supabase/migrations/20260804_create_payment_settings.sql';
const MIGRATION = (process.argv[2] || DEFAULT_MIGRATION).replace(/^\/+/, '');

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
            console.log(`Connected via ${label} (project ${projectRef})`);
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
    console.log('Coalition Migration Runner — payment_settings');
    console.log('');

    const { client, pool } = await connect();

    try {
        const fullPath = path.join(ROOT, MIGRATION);
        if (!fs.existsSync(fullPath)) {
            console.error(`  MISSING: ${MIGRATION}`);
            process.exit(1);
        }
        const sql = fs.readFileSync(fullPath, 'utf8');
        console.log(`Applying: ${MIGRATION} (${sql.length} bytes)...`);
        await client.query(sql);
        console.log('  OK');

        console.log('\n--- Row Verification ---');
        const row = await client.query(
            `SELECT id, card_enabled, paypal_enabled, klarna_enabled, cashapp_enabled, crypto_enabled, updated_at
             FROM public.payment_settings WHERE id = 1`
        );
        if (row.rowCount === 0) {
            console.log('  ROW NOT FOUND — seed insert failed');
        } else {
            const r = row.rows[0];
            console.log(`  id=${r.id} card=${r.card_enabled} paypal=${r.paypal_enabled} klarna=${r.klarna_enabled} cashapp=${r.cashapp_enabled} crypto=${r.crypto_enabled} updated_at=${r.updated_at}`);
        }

        // If a combined file was passed, also verify the Trusted Few objects
        // landed. Guarded so the payment_settings-only run is unchanged.
        const tf = await client.query(
            `SELECT count(*)::int AS apps FROM trust_circle_applications
             UNION ALL SELECT count(*)::int FROM drop_vouchers`
        ).catch(() => null);
        if (tf && tf.rowCount) {
            console.log(`  trust_circle_applications rows=${tf.rows[0]?.apps} drop_vouchers rows=${tf.rows[1]?.apps}`);
        }

        console.log('\n--- RLS Policies ---');
        const policies = await client.query(
            `SELECT policyname, cmd, permissive FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_settings'`
        );
        if (policies.rowCount === 0) {
            console.log('  NO POLICIES FOUND');
        } else {
            for (const p of policies.rows) {
                console.log(`  ${p.policyname} (${p.cmd}, ${p.permissive})`);
            }
        }

        console.log('\n--- Grants ---');
        const grants = await client.query(
            `SELECT grantee, privilege_type FROM information_schema.role_table_grants
             WHERE table_schema = 'public' AND table_name = 'payment_settings'
             ORDER BY grantee, privilege_type`
        );
        for (const g of grants.rows) {
            console.log(`  ${g.grantee}: ${g.privilege_type}`);
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
