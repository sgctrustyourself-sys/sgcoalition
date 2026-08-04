// scripts/backfillLiveOrderSeeds.ts
//
// One-shot backfill: upserts all 6 PUBLIC_RECENT_ORDER_SEEDS entries from
// constants.ts > INITIAL_ORDERS into the live Supabase `orders` table so
// the /live-orders map works even without the Layer 2 code-level fallback.
//
// WHY THIS EXISTS
//   The /live-orders map has a three-layer feed (see README > Recently
//   Ordered Live Map):
//     Layer 1 - real Supabase orders (source of truth).
//     Layer 2 - PUBLIC_RECENT_ORDER_SEEDS in utils/liveOrdersFeed.ts
//               (code-level fallback for offline sales).
//     Layer 3 - DEV-only demo seeds.
//
//   Layer 2 was built so the map is never empty, but it's a client-side
//   fallback. This script promotes those 6 offline sales to real Supabase
//   `orders` rows so Layer 1 picks them up natively. Once the rows exist
//   in Supabase, the dedup contract (same `id` -> Layer 1 wins) means
//   Layer 2 becomes a pure safety net rather than the primary surface.
//
// IDEMPOTENCY
//   Upsert with `onConflict: 'id'` - re-runs update the rows in place
//   rather than duplicating them. Each seed's `id` is `public-<state>-<slug>`,
//   which can never collide with an `order_<timestamp>` id minted by the
//   checkout flow. Safe to run multiple times.
//
// PRIVACY CONTRACT
//   The INITIAL_ORDERS rows already carry safe placeholders:
//     - customerEmail: "wholesale@example.com" (never a real address)
//     - customerName: "Wholesale Customer" (not a real buyer name)
//     - shippingAddress.address1: "" (empty - no street address)
//     - shippingAddress.zip: "" (empty - no ZIP)
//   The full street address lives in gitignored shipping_internal.json.
//   This script does NOT add any PII - it writes exactly what
//   INITIAL_ORDERS already contains.
//
// WHAT IS NOT INCLUDED
//   - `instagram_username` - the `orders` table does not have this column
//     (it's a frontend-only field on the INITIAL_ORDERS shape). If a future
//     migration adds the column, extend the converter below.
//   - `payment_reference` / `paypal_order_id` - these are PayPal-specific;
//     offline cash sales have neither, so they're set to null.
//   - `sg_coin_reward` - set to 0; offline sales did not earn SGCoin.
//
// USAGE
//   # preview only - reads .env, fetches current Supabase state, prints
//   # intended upserts. NO writes.
//   npx.cmd tsx scripts/backfillLiveOrderSeeds.ts --dry-run
//
//   # real run - upserts all 6 rows into the orders table
//   npx.cmd tsx scripts/backfillLiveOrderSeeds.ts --confirm
//
// EXIT CODES
//   0  dry-run complete OR confirm run succeeded
//   1  env missing, Supabase read/write failure
//
// AUTH
//   Uses SUPABASE_SERVICE_ROLE_KEY (NOT the anon key). RLS on the orders
//   table rejects anon writes. Matches the convention set by
//   scripts/syncImageFieldsToSupabase.ts and scripts/uploadSkyyBlueWalletImages.ts.

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { INITIAL_ORDERS } from '../constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
        '!! .env must contain VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
            '   The anon key (VITE_SUPABASE_ANON_KEY) will NOT work for orders writes due to RLS.',
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// camelCase -> snake_case converter
// ---------------------------------------------------------------------------
// Mirrors the `toOrderRecord` function in api/_handlers/complete-order.ts.
// INITIAL_ORDERS uses the frontend Order type (camelCase); the Supabase
// `orders` table uses snake_case (see api/_types.ts > OrderRow).

interface OrderRow {
    id: string;
    order_number: string;
    user_id: string | null;
    is_guest: boolean;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    items: Record<string, unknown>[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    payment_method: string;
    payment_status: string;
    payment_reference: string | null;
    paypal_order_id: string | null;
    order_type: string;
    shipping_address: Record<string, unknown> | null;
    notes: string;
    created_at: string;
    paid_at: string | null;
    sg_coin_reward: number;
    paid_amount: number;
    balance_due: number;
}

function toOrderRow(entry: any): OrderRow {
    return {
        id: String(entry.id),
        order_number: String(entry.orderNumber || `ORD-${entry.id}`),
        user_id: null, // offline sales have no auth user
        is_guest: true,
        customer_name: String(entry.customerName || 'Wholesale Customer'),
        customer_email: String(entry.customerEmail || 'wholesale@example.com'),
        customer_phone: '',
        items: (Array.isArray(entry.items) ? entry.items : []).map((item: any) => ({
            productId: item.productId,
            productName: item.productName,
            productImage: item.productImage,
            selectedSize: item.selectedSize || 'One Size',
            quantity: Math.max(1, Number(item.quantity || 1)),
            price: Number(item.price || 0),
            total: Number(item.total || 0),
            // Fields expected by normalizeOrderItems in complete-order.ts
            basePrice: Number(item.basePrice || item.price || 0),
            addOnPrice: 0,
            keychainClipOn: false,
            name: item.productName,
            image: item.productImage,
            size: item.selectedSize || 'One Size',
        })),
        subtotal: Number(entry.subtotal || 0),
        tax: Number(entry.tax || 0),
        discount: Number(entry.discount || 0),
        total: Number(entry.total || 0),
        payment_method: String(entry.paymentMethod || 'cash'),
        payment_status: String(entry.paymentStatus || 'paid'),
        payment_reference: null,
        paypal_order_id: null,
        order_type: String(entry.orderType || 'manual'),
        shipping_address: entry.shippingAddress || null,
        notes: `Backfilled from INITIAL_ORDERS seed. Offline ${entry.paymentMethod || 'cash'} sale.`,
        created_at: String(entry.createdAt),
        paid_at: entry.paidAt || entry.createdAt || null,
        sg_coin_reward: 0,
        // Seed rows are always fully-paid offline sales, so the partial-payment
        // columns collapse to: paid_amount = total, balance_due = 0. See
        // supabase/migrations/20260725_add_paid_amount_balance_due_to_orders.sql
        // for the column semantics and utils/orderDepositNotes.parseDepositNotes
        // for the diamond case (DEP $X paid / BAL $Y owes) handwritten in notes.
        paid_amount: Number(entry.total || 0),
        balance_due: 0,
    };
}

// ---------------------------------------------------------------------------
// Dry-run: read current state, print intended upserts, NO writes
// ---------------------------------------------------------------------------

async function runDry(): Promise<void> {
    console.log('[DRY RUN] no writes\n');
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    console.log(`Key source:   SUPABASE_SERVICE_ROLE_KEY  (redacted)\n`);
    console.log(`Seeds to upsert: ${INITIAL_ORDERS.length}\n`);

    // Check which rows already exist in the orders table
    const seedIds = INITIAL_ORDERS.map((entry: any) => entry.id);
    const { data: existing, error } = await supabase
        .from('orders')
        .select('id, order_number, created_at, payment_status')
        .in('id', seedIds);

    if (error) {
        throw new Error(`Failed to read existing orders: ${error.message}`);
    }

    const existingIds = new Set((existing || []).map((row: any) => row.id));

    console.log('+-----------------------------------------+---------+---------------+');
    console.log('| id                                      | status  | exists?       |');
    console.log('+-----------------------------------------+---------+---------------+');
    for (const entry of INITIAL_ORDERS) {
        const e = entry as any;
        const exists = existingIds.has(e.id);
        const status = String(e.paymentStatus || 'paid').padEnd(7);
        const existsLabel = exists ? 'YES (update)' : 'NO  (insert)';
        console.log(`| ${e.id.padEnd(39)} | ${status} | ${existsLabel.padEnd(13)} |`);
    }
    console.log('+-----------------------------------------+---------+---------------+');

    const newCount = INITIAL_ORDERS.length - existingIds.size;
    const updateCount = existingIds.size;
    console.log(`\n  -> ${newCount} new row(s) will be inserted`);
    console.log(`  -> ${updateCount} existing row(s) will be updated`);
    console.log(`  -> 0 PII fields added (all placeholders already in INITIAL_ORDERS)\n`);

    // Print a sample row so the operator can sanity-check the shape
    if (INITIAL_ORDERS.length > 0) {
        const sample = toOrderRow(INITIAL_ORDERS[0]);
        console.log('Sample upsert payload (first seed):');
        console.log(JSON.stringify(sample, null, 2));
        console.log();
    }

    console.log('Re-run with --confirm to execute.\n');
}

// ---------------------------------------------------------------------------
// Confirm: upsert all 6 rows
// ---------------------------------------------------------------------------

async function runConfirm(): Promise<void> {
    console.log('[CONFIRM RUN] upserting seed orders into Supabase\n');

    const rows = INITIAL_ORDERS.map((entry: any) => toOrderRow(entry));

    console.log(`Upserting ${rows.length} rows into the orders table...\n`);

    const results: Array<{ id: string; ok: boolean; created: boolean; error?: string }> = [];

    for (const row of rows) {
        // Check if the row already exists so we can report insert vs update
        const { data: existing } = await supabase
            .from('orders')
            .select('id')
            .eq('id', row.id)
            .maybeSingle();

        const { error } = await supabase
            .from('orders')
            .upsert(row, { onConflict: 'id' })
            .select()
            .single();

        if (error) {
            // If the error is about a missing column (e.g. payment_reference
            // or paypal_order_id on a schema that hasn't applied the PayPal
            // migration), retry without those columns - same fallback pattern
            // as complete-order.ts > toLegacyOrderRecord.
            const errText = `${error.code || ''} ${error.message || ''}`.toLowerCase();
            if (errText.includes('payment_reference') || errText.includes('paypal_order_id') || errText.includes('column')) {
                console.log(`  [WARN]  ${row.id}: missing PayPal columns, retrying without them...`);
                const legacyRow = { ...row };
                delete (legacyRow as any).payment_reference;
                delete (legacyRow as any).paypal_order_id;
                const retry = await supabase
                    .from('orders')
                    .upsert(legacyRow, { onConflict: 'id' })
                    .select()
                    .single();

                if (retry.error) {
                    results.push({ id: row.id, ok: false, created: false, error: retry.error.message });
                    console.log(`  [FAIL]  ${row.id}: ${retry.error.message}`);
                } else {
                    results.push({ id: row.id, ok: true, created: !existing });
                    console.log(`  [ OK ]  ${row.id}: ${!existing ? 'inserted' : 'updated'} (legacy schema)`);
                }
            } else {
                results.push({ id: row.id, ok: false, created: false, error: error.message });
                console.log(`  [FAIL]  ${row.id}: ${error.message}`);
            }
        } else {
            results.push({ id: row.id, ok: true, created: !existing });
            console.log(`  [ OK ]  ${row.id}: ${!existing ? 'inserted' : 'updated'}`);
        }
    }

    // Summary
    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    const inserted = succeeded.filter((r) => r.created).length;
    const updated = succeeded.filter((r) => !r.created).length;

    console.log(`\n-------------------------------------------`);
    console.log(`  Total:   ${results.length}`);
    console.log(`  OK:      ${succeeded.length}  (${inserted} inserted, ${updated} updated)`);
    if (failed.length > 0) {
        console.log(`  FAIL:    ${failed.length}`);
        for (const f of failed) {
            console.log(`           ${f.id}: ${f.error}`);
        }
    }
    console.log(`-------------------------------------------\n`);

    if (failed.length > 0) {
        console.log('Some rows failed. See errors above. Re-run after fixing the issue.\n');
        process.exit(1);
    }

    console.log('All seed orders are now in the Supabase orders table.');
    console.log('The /live-orders map will pick them up via Layer 1 on the next page load.');
    console.log('Layer 2 (PUBLIC_RECENT_ORDER_SEEDS) remains as a safety net - the dedup');
    console.log('contract ensures no double-counting (same id -> Layer 1 wins).\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const mode = process.argv.includes('--dry-run')
    ? 'dry'
    : process.argv.includes('--confirm')
      ? 'confirm'
      : null;

if (!mode) {
    console.error('Usage: tsx scripts/backfillLiveOrderSeeds.ts [--dry-run | --confirm]');
    process.exit(1);
}

(async () => {
    try {
        if (mode === 'dry') await runDry();
        else await runConfirm();
    } catch (err) {
        console.error('\n!! Aborted. Full error object:');
        console.error(err);
        if (err && typeof err === 'object') {
            console.error('--- error shape summary ---');
            console.error('  name:    ', (err as any).name);
            console.error('  message: ', (err as any).message);
            console.error('  code:    ', (err as any).code);
        }
        process.exit(1);
    }
})();
