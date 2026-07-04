// scripts/upsertFriiqyWholesale.ts
// ----------------------------------------------------------------------------
// Mirrors the @friiqy wholesale row from constants.ts > INITIAL_ORDERS into
// the production Supabase `orders` table so the Live Orders Map surfaces the
// wholesale for real production visitors (not just the local fallback).
//
// This script writes to the `orders` table ONLY. The companion script
// `scripts/seedVerifiedCustomers.ts` (`npm run seed:verified-customers`)
// is what registers @friiqy as a verified past_customer in
// `marketing_contacts` so the test-campaign guard in
// api/_handlers/marketing-send.ts (utils/marketingAudience.ts) drops him
// from any campaign whose name contains "test". Run BOTH scripts to
// fully mirror the wholesale to production - the orders row alone is not
// enough to suppress friiqy from test campaigns because the
// `source='past_customer'` tag that marketing-send.ts attaches to
// order-derived contacts is computed at audience-fetch time, not stored
// on the orders row itself.
//
// Single source of truth: this script imports INITIAL_ORDERS from
// constants.ts and finds the wholesale row by id, so the script can never
// drift from the canonical local-fallback row. Same id
// (`public-md-wholesale-wallets-2026_05_22`) is the dedup key used by
// buildLiveOrdersFeed in utils/liveOrdersFeed.ts.
//
// Idempotent: uses `upsert` with `onConflict: 'id'`. Re-running rewrites
// the existing row with the canonical data.
//
// Privacy contract: the full street address lives in
// shipping_internal.json at the repo root (gitignored, admin-only).
// The script reads that file at runtime to populate the address1 +
// zip fields when mirroring this row to Supabase. See
// shipping_internal.example.json for the schema + setup steps. The
// PUBLIC_RECENT_ORDER_SEED in utils/liveOrdersFeed.ts also strips
// address1 + zip before the live map renders, so the live map only
// ever surfaces city + state. The Vercel deploy never has
// shipping_internal.json in its build output, so production has no
// access to the full address.
//
// Prerequisite: apply the migration FIRST so the instagram_username column
// exists. The script's error message points at the migration file path if
// the column is missing.
// ----------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_ORDERS } from '../constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    const missing: string[] = [];
    if (!supabaseUrl) missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
    if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    console.error('Set them in .env (or .env.local) or export them before running:');
    console.error('  SUPABASE_URL=https://your-project.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
    console.error('Note: VITE_SUPABASE_URL is accepted as a fallback for SUPABASE_URL, but');
    console.error('SUPABASE_SERVICE_ROLE_KEY is server-side only and has no VITE_* variant.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
});

const WHOLESALE_ID = 'public-md-wholesale-wallets-2026_05_22';

// Find the canonical wholesale row in the local-fallback source of truth.
// Throws early if the row was renamed / removed in constants.ts so the
// operator fixes the drift before this script can run with a stale shape.
const wholesaleRow = INITIAL_ORDERS.find((order: any) => order?.id === WHOLESALE_ID);
if (!wholesaleRow) {
    console.error(`Could not find INITIAL_ORDERS row with id="${WHOLESALE_ID}".`);
    console.error('Either the row was renamed/removed in constants.ts, or this');
    console.error('script is out of sync with the local-fallback source of truth.');
    console.error('Fix the drift in constants.ts and re-run.');
    process.exit(1);
}

// Transform the camelCase INITIAL_ORDERS row into the snake_case shape
// expected by the Supabase `orders` table. Mirrors the column list used by
// api/_handlers/complete-order.ts. The only field that lives in
// constants.ts but NOT in the Supabase row is `customerName` -> wait, that
// is mapped below. `instagramUsername` is mapped to `instagram_username`
// (the column added by 20260704_add_instagram_username_to_orders.sql).
function toOrdersRow(row: any) {
    return {
        id: row.id,
        order_number: row.orderNumber,
        user_id: row.userId ?? null,
        is_guest: Boolean(row.isGuest ?? !row.userId),
        customer_name: row.customerName,
        customer_email: row.customerEmail,
        customer_phone: row.customerPhone ?? '',
        items: row.items,
        subtotal: row.subtotal,
        tax: row.tax ?? 0,
        discount: row.discount ?? 0,
        total: row.total,
        payment_method: row.paymentMethod,
        payment_status: row.paymentStatus,
        payment_reference: row.paymentReference ?? null,
        paypal_order_id: row.paypalOrderId ?? null,
        order_type: row.orderType ?? 'manual',
        shipping_address: row.shippingAddress ?? null,
        notes: row.notes ?? '',
        sg_coin_reward: row.sgCoinReward ?? 0,
        facebook_username: row.facebookUsername ?? null,
        instagram_username: row.instagramUsername ?? null,
        created_at: row.createdAt,
        paid_at: row.paidAt ?? row.createdAt,
    };
}

// Read shipping_internal.json at the repo root. The file is gitignored
// and admin-only. Returns null if the file is missing/unreadable or
// not a JSON object. The seed script falls back to empty strings
// (privacy contract default) in that case — a missing entry never
// blocks the upsert, it just means Supabase gets the empty-string
// default the same as every other offline-cash row in INITIAL_ORDERS.
type ShippingInternalEntry = { address1?: string; zip?: string };
type ShippingInternalMap = Record<string, ShippingInternalEntry>;

function loadShippingInternal(): ShippingInternalMap | null {
    const filePath = path.resolve(__dirname, '../shipping_internal.json');
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as ShippingInternalMap;
        }
        console.warn('[shipping] shipping_internal.json is not a JSON object; ignoring.');
        return null;
    } catch (err: any) {
        console.warn(`[shipping] WARNING: shipping_internal.json is unreadable (${err?.message || err}). Falling back to empty address fields.`);
        return null;
    }
}

function isInstagramColumnMissing(error: any): boolean {
    // Match Postgres error 42703 (undefined_column) - sharper than
    // substring matching on "column" + "orders" which can false-positive
    // on other errors that happen to mention both words.
    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    if (code === '42703' || code === 'PGRST204') return true;
    return message.includes('instagram_username') || (message.includes('column') && message.includes('instagram'));
}

async function upsertWholesaleOrder() {
    const payload = toOrdersRow(wholesaleRow);

    // Populate the full street address from shipping_internal.json
    // (gitignored, admin-only). Fall back to empty strings with a
    // warning if the file is missing or has no entry for this order
    // — the upsert still runs, but the Supabase row will have empty
    // address fields (the privacy contract default for every other
    // offline-cash row in INITIAL_ORDERS).
    const shippingInternal = loadShippingInternal();
    const addressEntry = shippingInternal?.[payload.id];
    if (addressEntry && payload.shipping_address) {
        if (typeof addressEntry.address1 === 'string' && addressEntry.address1.length > 0) {
            payload.shipping_address.address1 = addressEntry.address1;
        }
        if (typeof addressEntry.zip === 'string' && addressEntry.zip.length > 0) {
            payload.shipping_address.zip = addressEntry.zip;
        }
        console.log(`[shipping] Loaded full address from shipping_internal.json for order ${payload.id}.`);
    } else {
        console.warn(`[shipping] No entry for order ${payload.id} in shipping_internal.json — falling back to empty address fields.`);
    }

    const { data: existing, error: lookupError } = await supabase
        .from('orders')
        .select('id, order_number, total, payment_status, instagram_username')
        .eq('id', payload.id)
        .maybeSingle();

    if (lookupError) {
        console.error('Error looking up existing orders row:', lookupError.message);
        process.exit(1);
    }

    if (existing) {
        console.log(`[orders] Row already exists (id=${existing.id}, order_number=${existing.order_number}, total=$${existing.total}, status=${existing.payment_status}, instagram=@${existing.instagram_username || 'null'}).`);
        console.log('[orders] Re-running will upsert (overwrite) the existing row with the canonical data.');
    }

    const { data, error } = await supabase
        .from('orders')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

    if (error) {
        if (isInstagramColumnMissing(error)) {
            console.error('[orders] Error upserting wholesale row:', error.message);
            console.error('');
            console.error('The instagram_username column does not exist on public.orders.');
            console.error('Apply the migration first:');
            console.error('  supabase db push');
            console.error('  # or paste supabase/migrations/20260704_add_instagram_username_to_orders.sql into the Supabase SQL editor');
            process.exit(1);
        }
        console.error('[orders] Error upserting wholesale row:', error.message);
        process.exit(1);
    }

    const itemCount = Array.isArray(data.items) ? data.items.length : 0;
    console.log(`[orders] Upserted wholesale row: id=${data.id}, order_number=${data.order_number}, total=$${data.total}, status=${data.payment_status}, instagram=@${data.instagram_username}, items=${itemCount}`);

    // Round-trip verify so the operator sees the items array made it
    // through the JSONB column without truncation.
    const { data: verify, error: verifyError } = await supabase
        .from('orders')
        .select('id, items, total, instagram_username')
        .eq('id', payload.id)
        .single();

    if (verifyError) {
        console.warn('[orders] Verification query failed:', verifyError.message);
        return;
    }

    const verifyItemCount = Array.isArray(verify.items) ? verify.items.length : 0;
    if (verifyItemCount !== itemCount) {
        console.warn(`[orders] WARNING: items array round-trip mismatch. Wrote ${itemCount}, read back ${verifyItemCount}.`);
    } else {
        console.log(`[orders] Verified items round-trip: ${verifyItemCount} items preserved.`);
    }
}

async function main() {
    console.log(`Mirroring wholesale row "${WHOLESALE_ID}" to Supabase orders table...`);
    console.log(`  source:  constants.ts > INITIAL_ORDERS (single source of truth)`);
    console.log(`  items:   ${Array.isArray(wholesaleRow.items) ? wholesaleRow.items.length : '?'} (7 wallets at $25 each = $${wholesaleRow.total})`);
    console.log(`  city:    ${wholesaleRow.shippingAddress?.city || '?'}, ${wholesaleRow.shippingAddress?.state || '?'}`);
    console.log(`  buyer:   @${wholesaleRow.instagramUsername || '?'} on Instagram`);
    console.log('');
    await upsertWholesaleOrder();
    console.log('');
    console.log('Done with the orders write.');
    console.log('');
    console.log('REMINDER: to register @friiqy as a verified customer for the test-campaign guard, also run:');
    console.log('  npm run seed:verified-customers');
    console.log('');
    console.log('Verify the orders write in Supabase:');
    console.log("  SELECT id, order_number, total, instagram_username FROM orders WHERE id = '" + WHOLESALE_ID + "';");
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
