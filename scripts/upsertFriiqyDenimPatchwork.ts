// scripts/upsertFriiqyDenimPatchwork.ts
//
// One-shot upsert: links the Coalition Denim Patchwork 1/1 Jeans S1
// (ORD-SG-DENIM-S1, sold via @friiqy in November 2024) to the Supabase
// orders table so it surfaces in /admin via the marketing_contacts
// metadata.instagram_username JOIN.
//
// WHY THIS SCRIPT EXISTS
// scripts/backfillLiveOrderSeeds.ts already upserts ALL 6 INITIAL_ORDERS
// rows; this script is the per-row cousin that ALSO appends the
// @sgcoalition-friiqy-link-2026-07-16 tag to the notes column so a
// future audit can grep for orders linked to @friiqy specifically.
//
// USAGE   npx.cmd tsx scripts/upsertFriiqyDenimPatchwork.ts [--dry-run | --confirm]
// AUTH    Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
//
// SHIPPING ADDRESS
//   Reads shipping_internal.json at runtime. Schema:
//     { <INITIAL_ORDERS.id>: { address1: string, zip: string } }
//   Falls back to "" if missing (privacy contract default).
//
// IDEMPOTENCY
//   Upsert with onConflict: 'id'. Re-runs update the row in place.
//   The FRIQQY_TAG is appended ONLY on the first run; subsequent
//   calls detect .includes() and skip appending so notes does not
//   grow unbounded.

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath, pathToFileURL } from 'url';
import * as path from 'path';
import * as fs from 'fs';

export const TARGET_ORDER_ID = 'public-md-denim-patchwork-2024_11_08';
export const ORDER_NUMBER = 'ORD-SG-DENIM-S1';
export const FRIQQY_TAG = '@sgcoalition-friiqy-link-2026-07-16';
export const DENIM_NOTES_TAG = FRIQQY_TAG;
export const BACKFILL_NOTES_TEXT = 'Backfilled from INITIAL_ORDERS seed. Offline cash sale.';

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

// Script already guarded with process.exit(1) when env is unset;
// SUPABASE_URL/SERVICE_KEY are guaranteed string at runtime.
// strictNullChecks-safe assertion.
const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// Read full street address from gitignored shipping_internal.json.
// Falls back to { address1: '', zip: '' } per the privacy contract.
export function readShippingAddress(orderId: string): { address1: string; zip: string } {
    const fallback = { address1: '', zip: '' };
    try {
        const p = path.resolve(__dirname, '../shipping_internal.json');
        if (!fs.existsSync(p)) return fallback;
        const raw = fs.readFileSync(p, 'utf-8');
        const data = JSON.parse(raw);
        const entry = data && data[orderId];
        if (!entry || typeof entry !== 'object') return fallback;
        return {
            address1: String(entry.address1 || ''),
            zip: String(entry.zip || ''),
        };
    } catch {
        return fallback;
    }
}

// Build the orders-table row payload from constants + shipping override.
// Mirrors backfillLiveOrderSeeds.ts > toOrderRow conversion.
export function buildOrderRow(): any {
    const shipping = readShippingAddress(TARGET_ORDER_ID);
    return {
        id: TARGET_ORDER_ID,
        order_number: ORDER_NUMBER,
        user_id: null,
        is_guest: true,
        customer_name: 'Wholesale Customer',
        customer_email: 'wholesale@example.com',
        customer_phone: '',
        items: [
            {
                productId: 'Coalition_Denim_Patchwork_S1',
                productName: 'Coalition Denim Patchwork 1/1 Jeans S1',
                productImage: 'https://i.imgur.com/2VU7MEr.jpg',
                selectedSize: '30',
                quantity: 1,
                price: 140,
                total: 140,
                basePrice: 140,
                addOnPrice: 0,
                keychainClipOn: false,
                name: 'Coalition Denim Patchwork 1/1 Jeans S1',
                image: 'https://i.imgur.com/2VU7MEr.jpg',
                size: '30',
            },
        ],
        subtotal: 140,
        tax: 0,
        discount: 0,
        total: 140,
        payment_method: 'cash',
        payment_status: 'paid',
        payment_reference: null,
        paypal_order_id: null,
        order_type: 'manual',
        shipping_address: {
            address1: shipping.address1,
            city: 'Abingdon',
            state: 'MD',
            zip: shipping.zip,
            country: 'US',
        },
        notes: BACKFILL_NOTES_TEXT,
        created_at: '2024-11-08T00:00:00Z',
        paid_at: '2024-11-08T00:00:00Z',
        sg_coin_reward: 0,
    };
}

// Append FRIQQY_TAG to notes if not already present.
function appendFriqqyTagIfMissing(existingNotes: string | null | undefined): string {
    const base = BACKFILL_NOTES_TEXT + ' ' + FRIQQY_TAG;
    const current = (existingNotes || '').trim();
    if (current.includes(FRIQQY_TAG)) return current;
    return base;
}

export async function runDry(): Promise<void> {
    console.log('[DRY RUN] no writes\n');
    console.log('Supabase URL: ' + SUPABASE_URL);
    console.log('Target order: ' + TARGET_ORDER_ID);
    console.log('Key source:   SUPABASE_SERVICE_ROLE_KEY  (redacted)\n');

    const { data: existing, error } = await supabase
        .from('orders')
        .select('id, order_number, notes, created_at')
        .eq('id', TARGET_ORDER_ID)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') {
        throw new Error('orders read failed: ' + error.message);
    }

    const row = buildOrderRow();

    if (existing) {
        console.log('DENIM_FOUND existing id=' + existing.id);
        console.log('  current notes=' + (existing.notes || ''));
        const tagAlready = (existing.notes || '').includes(FRIQQY_TAG);
        if (tagAlready) {
            console.log('  FRIQQY_TAG already present (idempotent no-op)');
        } else {
            console.log('  FRIQQY_TAG missing -> will append on confirm');
        }
    } else {
        console.log('DENIM_NOT_FOUND (order missing - fresh insert path)');
    }

    console.log('\nINTENDED_DENIM_UPSERT payload:');
    console.log(JSON.stringify(row, null, 2));
    console.log('\nDENIM_NOTES_TAG: ' + FRIQQY_TAG);
    console.log('Re-run with --confirm to execute the upsert.\n');
}

export async function runConfirm(): Promise<void> {
    console.log('[CONFIRM RUN] upserting denim patchwork order to Supabase\n');

    const { data: existing, error: readErr } = await supabase
        .from('orders')
        .select('id, notes')
        .eq('id', TARGET_ORDER_ID)
        .maybeSingle();

    if (readErr && readErr.code !== 'PGRST116') {
        console.log('DENIM_UPSERT_FAIL read-error: ' + readErr.message);
        throw new Error('orders read failed: ' + readErr.message);
    }

    const row = buildOrderRow();

    if (existing) {
        const newNotes = appendFriqqyTagIfMissing(existing.notes);
        if (newNotes !== (existing.notes || '')) {
            row.notes = newNotes;
            console.log('DENIM_NOTES_TAG appended: ' + FRIQQY_TAG);
        } else {
            console.log('DENIM_NOTES_TAG already (idempotent skip)');
        }
    } else {
        row.notes = BACKFILL_NOTES_TEXT + ' ' + FRIQQY_TAG;
        console.log('DENIM_NOTES_TAG_on_insert: ' + FRIQQY_TAG);
    }

    const { error: upsertErr } = await supabase
        .from('orders')
        .upsert(row, { onConflict: 'id' })
        .select()
        .single();

    if (upsertErr) {
        const errText = ((upsertErr.code || '') + ' ' + (upsertErr.message || '')).toLowerCase();
        if (errText.includes('payment_reference') || errText.includes('paypal_order_id')) {
            console.log('  [WARN] missing PayPal columns, retrying without them...');
            const legacy = { ...row };
            delete legacy.payment_reference;
            delete legacy.paypal_order_id;
            const { error: retryErr } = await supabase
                .from('orders')
                .upsert(legacy, { onConflict: 'id' })
                .select()
                .single();
            if (retryErr) {
                console.log('DENIM_UPSERT_FAIL  ' + TARGET_ORDER_ID + ': ' + retryErr.message);
                throw new Error(retryErr.message);
            }
            console.log('DENIM_UPSERT_OK   upserted (legacy)  ' + TARGET_ORDER_ID);
            return;
        }
        console.log('DENIM_UPSERT_FAIL  ' + TARGET_ORDER_ID + ': ' + upsertErr.message);
        throw new Error(upsertErr.message);
    }

    console.log('DENIM_UPSERT_OK   upserted  ' + TARGET_ORDER_ID + ' (linked to @friiqy)');
    console.log('VerifiedBuyersAdmin will now surface this order against @friiqy via the marketing_contacts.metadata.instagram_username JOIN.');
}

// Entry point with --dry-run / --confirm arg parsing + auto-execute guard.
const mode = process.argv.includes('--dry-run')
    ? 'dry'
    : process.argv.includes('--confirm')
        ? 'confirm'
        : null;

if (mode === null) {
    if (!process.env.VITEST_WORKER_ID) {
        console.error('Usage: tsx scripts/upsertFriiqyDenimPatchwork.ts [--dry-run | --confirm]');
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
