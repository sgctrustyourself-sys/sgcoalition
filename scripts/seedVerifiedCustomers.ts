// scripts/seedVerifiedCustomers.ts
//
// One-shot seed: registers @friiqy as a marketing_contacts row so
// /admin > Verified Buyers tab surfaces them on the next refresh, AND
// the test-campaign auto-exclusion (substring match on campaign name)
// keeps them off any 'test' campaign send.
//
// WHY THIS SCRIPT EXISTS
// README 1570s notes scripts/seedVerifiedCustomers.ts registers
// @friiqy as a stable identity for the test-campaign filter. The
// marketing_contacts table is the source of truth for the exclusion
// (see utils/marketingAudience.ts > VERIFIED_CUSTOMER_SOURCES includes
// 'manual_seed'). Without this row, friiqy could get spammed by Resend
// test sends; this script closes the gap.
//
// USAGE   npx.cmd tsx scripts/seedVerifiedCustomers.ts [--dry-run | --confirm]
// AUTH    Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
//
// IDEMPOTENCY
//   Looks up row by email first. If found, UPDATES metadata + source.
//   If missing, INSERTS new row with the full payload.
//   The @sgcoalition-verified-buyer-link-2026-07-16 tag is appended
//   to the metadata.notes_tag field so a future audit can grep.
//

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';
import * as path from 'path';

export const TARGET_EMAIL = 'wholesale@example.com';
export const FRIQQY_IG_HANDLE = 'friiqy';
export const VERIFIED_NOTES_TAG = '@sgcoalition-verified-buyer-link-2026-07-16';
export const TOTAL_OFFLINE_ORDERS = 3;
export const TOTAL_OFFLINE_SPEND_USD = 555;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// VITEST_WORKER_ID guard: tests don't crash on missing env.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
    || process.env.SUPABASE_URL
    || (process.env.VITEST_WORKER_ID ? 'https://fake.test' : undefined);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    || (process.env.VITEST_WORKER_ID ? 'fake-key' : undefined);

if (!SUPABASE_URL || !SERVICE_KEY) {
    if (!process.env.VITEST_WORKER_ID) {
        console.error('!! .env must contain VITE_SUPABASE_URL AND SUPABASE_SERVICE_ROLE_KEY.');
        process.exit(1);
    }
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// Build the marketing_contacts UPSERT payload.
// metadata.instagram_username pins the VerifiedBuyersAdmin JOIN.
export function buildMarketingContactPayload(): any {
    return {
        email: TARGET_EMAIL,
        source: 'manual_seed',
        status: 'active',
        metadata: {
            instagram_username: FRIQQY_IG_HANDLE,
            total_offline_orders: TOTAL_OFFLINE_ORDERS,
            total_offline_spend_usd: TOTAL_OFFLINE_SPEND_USD,
            lifecycle_stage: 'wholesale_buyer',
            notes_tag: VERIFIED_NOTES_TAG,
        },
    };
}

export async function runDry(): Promise<void> {
    console.log('[DRY RUN] no writes\n');
    console.log('Supabase URL: ' + SUPABASE_URL);
    console.log('Target email: ' + TARGET_EMAIL);
    console.log('Key source:   SUPABASE_SERVICE_ROLE_KEY  (redacted)\n');

    const { data: existing, error } = await supabase
        .from('marketing_contacts')
        .select('id, email, source, status, metadata')
        .eq('email', TARGET_EMAIL)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        throw new Error('marketing_contacts read failed: ' + error.message);
    }

    if (existing) {
        console.log('VERIFIED_FOUND existing id=' + existing.id + ' email=' + existing.email);
        console.log('  current source=' + (existing.source || 'null'));
        console.log('  current metadata=' + JSON.stringify(existing.metadata || {}));
        const igHandleInMeta = (existing.metadata || {}).instagram_username;
        if (igHandleInMeta === FRIQQY_IG_HANDLE) {
            console.log('  instagram_username matches friiqy (idempotent tag-update path)');
        } else {
            console.log('  instagram_username=' + JSON.stringify(igHandleInMeta) + ' -> will overwrite to friiqy');
        }
    } else {
        console.log('VERIFIED_NOT_FOUND (contact missing - fresh insert path)');
    }

    console.log('\nINTENDED_VERIFIED_UPSERT payload:');
    console.log(JSON.stringify(buildMarketingContactPayload(), null, 2));
    console.log('\nVERIFIED_NOTES_TAG: ' + VERIFIED_NOTES_TAG);
    console.log('Re-run with --confirm to execute the upsert.\n');
}

export async function runConfirm(): Promise<void> {
    console.log('[CONFIRM RUN] upserting verified-customer marketing_contacts row\n');

    const payload = buildMarketingContactPayload();

    const { data: upserted, error: upsertErr } = await supabase
        .from('marketing_contacts')
        .upsert(payload, { onConflict: 'email' })
        .select()
        .single();

    if (upsertErr) {
        console.log('VERIFIED_UPSERT_FAIL  email=' + TARGET_EMAIL + ': ' + upsertErr.message);
        throw new Error(upsertErr.message);
    }

    console.log('VERIFIED_UPSERT_OK   upserted  email=' + TARGET_EMAIL + ' id=' + upserted.id);

    // Cross-validate: re-read the row after upsert to enforce the JOIN
    // contract - metadata.instagram_username must equal 'friiqy'.
    const { data: reread, error: rerr } = await supabase
        .from('marketing_contacts')
        .select('id, email, source, status, metadata')
        .eq('id', upserted.id)
        .maybeSingle();

    if (rerr) {
        console.log('CROSS_VALIDATE_FAIL  re-read failed: ' + rerr.message);
        throw new Error('cross-validation read failed: ' + rerr.message);
    }

    if (!reread) {
        console.log('CROSS_VALIDATE_FAIL  row vanished after upsert');
        throw new Error('row disappeared between upsert and re-read');
    }

    const igHandle = (reread.metadata || {}).instagram_username;
    if (igHandle !== FRIQQY_IG_HANDLE) {
        console.log('CROSS_VALIDATE_FAIL  instagram_username=' + JSON.stringify(igHandle) + ' expected=' + FRIQQY_IG_HANDLE);
        throw new Error('cross-validation failed: instagram_username mismatch');
    }
    if (reread.email !== TARGET_EMAIL) {
        console.log('CROSS_VALIDATE_FAIL  email=' + JSON.stringify(reread.email) + ' expected=' + TARGET_EMAIL);
        throw new Error('cross-validation failed: email mismatch');
    }

    console.log('CROSS_VALIDATE_PASS  instagram_username=' + igHandle + ' email=' + reread.email);
    console.log('VerifiedBuyersAdmin will now show @friiqy at top of /admin > Verified Buyers.');
}

// Entry point + auto-execute guard.
const mode = process.argv.includes('--dry-run')
    ? 'dry'
    : process.argv.includes('--confirm')
        ? 'confirm'
        : null;

if (mode === null) {
    if (!process.env.VITEST_WORKER_ID) {
        console.error('Usage: tsx scripts/seedVerifiedCustomers.ts [--dry-run | --confirm]');
        process.exit(1);
    }
}

async function entryPoint(): Promise<void> {
    try {
        if (mode === 'dry') await runDry();
        else if (mode === 'confirm') await runConfirm();
    } catch (err) {
        console.error('\n!! Aborted. Full error:');
        console.error(err);
        if (err && typeof err === 'object') {
            console.error('  message: ' + (err as any).message);
            console.error('  code:    ' + (err as any).code);
        }
        process.exit(1);
    }
}

const argvFileUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
const isMain = argvFileUrl && argvFileUrl === import.meta.url;

if (isMain && mode) {
    entryPoint();
}
