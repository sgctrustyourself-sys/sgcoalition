// scripts/reviewStalePendingOrders.ts
//
// READ-ONLY review of live `orders` rows still in payment_status='pending',
// written to investigate the two stale warnings the catalog audit
// (tests/soldYetBuyableAudit.test.ts) prints for the Above as Below set:
//   PENDING ORDER  prod_set_above_as_below — N unit(s) in pending
//   cashapp/crypto order(s) while still buyable
//
// Prints everything needed to judge validity: timestamps, items, customer,
// payment method, totals. The disposition (cancel vs close) is decided from
// this output, not from the row's mere existence.
//
// Reviewed 2026-10-03 — three pending rows, two of them QA artifacts:
//   ORD-QA-VERIFY-2    QA TEST CASHAPP <qa.cashapp.verify@test.local>, row id
//                      order_test_cashapp_verify2 — hand-made fixture, never paid
//   ORD-2Z7APRBFW      same QA identity, same item/size/price 40s later, row id
//                      order_1786504575820 (orderIntake's timestamp id) — a
//                      real checkout-path run under a test identity, never paid
//   TRAVIS-SHIRT-…     REAL: cash deposit ledger (DEP $30 / BAL $10), order-only
//                      product documented in ORPHAN_DECISIONS — RESOLVED
//                      2026-10-03: balance confirmed received, reconciled to
//                      paid via scripts/resolveTravisDeposit.ts; no longer pending
//
// Disposition for the two QA rows: payment_status 'cancelled'
// (OrderStatus.CANCELLED) — terminal, excluded from the public orders feed
// (utils/liveOrdersFeed.ts EXCLUDED_STATUSES) and a no-op for
// reconcilePayment (services/orderIntake.ts), which only acts on 'pending'.
//
// USAGE:  npx tsx scripts/reviewStalePendingOrders.ts           (read-only)
//         npx tsx scripts/reviewStalePendingOrders.ts --apply   (cancel QA rows)

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Orders are not anon-readable — same service-role requirement as the audit.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const APPLY = process.argv.includes('--apply');

/** The two QA rows decided above, by immutable row id — never by name match. */
const CANCEL_TARGETS = new Map<string, string>([
    ['order_test_cashapp_verify2', 'ORD-QA-VERIFY-2 — QA fixture (order_test_* id, qa.cashapp.verify@test.local)'],
    ['order_1786504575820', 'ORD-2Z7APRBFW — QA run under the same test identity, 40s after ORD-QA-VERIFY-2'],
]);

// The Above as Below products the audit warning can attach to.
const ABOVE_AS_BELOW_IDS = [
    'prod_set_above_as_below',
    'prod_womens_above_as_below_set',
    'prod_tee_above_as_below',
    'prod_shorts_above_as_below',
    'prod_womens_above_as_below_crop_tank',
    'prod_womens_above_as_below_contrast_shorts',
    'Coalition_Above_As_Below_Wallet_1_1',
    'prod_1784012446238',
    'prod_1784012355221',
];

async function review() {
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_status', 'pending')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('❌ Error reading orders:', error);
        process.exit(1);
    }

    console.log(`pending orders in live table: ${(orders || []).length}\n`);

    for (const o of orders || []) {
        const items = Array.isArray(o.items) ? o.items : [];
        const touchesSet = items.some((i: any) => ABOVE_AS_BELOW_IDS.includes(String(i?.productId ?? i?.product_id ?? i?.id)));
        console.log('='.repeat(80));
        console.log(`order_number : ${o.order_number}`);
        console.log(`row id       : ${o.id}`);
        console.log(`created_at   : ${o.created_at}`);
        console.log(`updated_at   : ${o.updated_at ?? '—'}`);
        console.log(`status       : payment=${o.payment_status} fulfillment=${o.fulfillment_status ?? '—'} status=${o.status ?? '—'}`);
        console.log(`payment      : method=${o.payment_method ?? '—'} total=${o.total ?? o.total_amount ?? '—'}`);
        console.log(`customer     : ${o.customer_name ?? o.name ?? '—'} <${o.customer_email ?? o.email ?? '—'}>`);
        console.log(`phone        : ${o.phone ?? o.customer_phone ?? '—'}`);
        console.log(`notes        : ${o.notes ?? o.customer_notes ?? '—'}`);
        console.log(`set-related  : ${touchesSet ? 'YES — Above as Below' : 'no'}`);
        console.log('items:');
        for (const it of items) {
            console.log(
                `  - ${String(it?.productId ?? it?.product_id ?? it?.id ?? '?')} | ${it?.productName ?? it?.name ?? '?'} | qty ${it?.quantity ?? it?.qty ?? 1} | ${it?.selectedSize ?? it?.size ?? '—'} | $${it?.price ?? '?'}`,
            );
        }
        console.log('');
    }
}

async function apply() {
    console.log('\n--- apply: cancelling QA rows (guarded: only if still pending) ---');
    for (const [id, reason] of CANCEL_TARGETS) {
        const { data: before, error: readErr } = await supabase
            .from('orders')
            .select('id,order_number,payment_status,customer_email')
            .eq('id', id)
            .maybeSingle();
        if (readErr) { console.error(`❌ read ${id}:`, readErr.message); process.exitCode = 1; continue; }
        if (!before) { console.log(`- ${id}: row gone — nothing to do`); continue; }
        if (before.payment_status !== 'pending') {
            console.log(`- ${before.order_number}: already '${before.payment_status}' — skipped`);
            continue;
        }
        const { error: updErr } = await supabase
            .from('orders')
            .update({ payment_status: 'cancelled' })
            .eq('id', id)
            .eq('payment_status', 'pending'); // never clobber a row that changed since the review
        if (updErr) { console.error(`❌ update ${id}:`, updErr.message); process.exitCode = 1; continue; }
        console.log(`✓ ${before.order_number} (${before.customer_email}) pending → cancelled`);
        console.log(`    ${reason}`);
    }
}

async function main() {
    await review();
    if (APPLY) await apply();
}

main();
