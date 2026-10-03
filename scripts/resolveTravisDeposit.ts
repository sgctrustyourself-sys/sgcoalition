// scripts/resolveTravisDeposit.ts
//
// Resolves TRAVIS-SHIRT-DEPOSIT-2026-07-25, the last pending row in the live
// `orders` table: a $40 bespoke-shirt order written 2026-07-25 with notes
// "DEP $30 paid / BAL $10 owes" (backfilled by @sgcoalition-backfill-travis-
// 2026-07-25; paid_amount/balance_due columns exist for exactly this row —
// supabase/migrations/20260725_add_paid_amount_balance_due_to_orders.sql).
//
// Inspect (default) prints everything bearing on the decision: the full row,
// the payments audit ledger (any $10 balance payment would live there), and
// the deposit parse. Two apply modes, both mutually exclusive:
//
//   --apply-paid    balance was received -> reconcile_balance_payment RPC.
//                   Flips pending -> paid, paid_amount=total, balance_due=0,
//                   paid_at=now, profile lifetime_spend += balance. This is
//                   the admin panel's own close path (OrderManager >
//                   reconcileBalancePayment); the RPC re-checks pending +
//                   balance_due>0 itself.
//
//   --apply-close   balance will never arrive -> payment_status='cancelled'
//                   plus a notes line recording the disposition, so the $30
//                   already received stays visible in the row instead of the
//                   status silently erasing it. Cancelled is the feed-
//                   excluding terminal status (utils/liveOrdersFeed.ts).
//
// One of the two reflects reality; guessing which falsifies the books, so
// the inspect output is the authority.
//
// USAGE:  npx tsx scripts/resolveTravisDeposit.ts                (read-only)
//         npx tsx scripts/resolveTravisDeposit.ts --apply-paid
//         npx tsx scripts/resolveTravisDeposit.ts --apply-close
//         npx tsx scripts/resolveTravisDeposit.ts --apply-ledger
//
// RESOLVED 2026-10-03: the $10 balance WAS received (confirmed by the owner).
// --apply-paid ran: notes marker struck, balance_due restored to 10, then
// reconcile_balance_payment flipped the row to paid (paid_amount 40, paid_at
// set, profile lifetime_spend +10). record_partial_payment — the RPC that
// would have written the payments ledger row itself — is BROKEN against the
// live schema: its INSERT INTO profiles (id, user_id, ...) fails with
// `column "user_id" of relation "profiles" does not exist` (drift in
// supabase/migrations/20260730_create_payments_table.sql). --apply-ledger
// writes that audit row directly instead, noting the fallback.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEPOSIT_NOTES_RE } from '../utils/orderDepositNotes';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const ORDER_ID = 'public-travis-pending-shirt-2026-07-25';
const ORDER_NUMBER = 'TRAVIS-SHIRT-DEPOSIT-2026-07-25';
const APPLY_PAID = process.argv.includes('--apply-paid');
const APPLY_CLOSE = process.argv.includes('--apply-close');
const APPLY_LEDGER = process.argv.includes('--apply-ledger');

if ([APPLY_PAID, APPLY_CLOSE, APPLY_LEDGER].filter(Boolean).length > 1) {
    console.error('❌ --apply-paid, --apply-close and --apply-ledger are mutually exclusive');
    process.exit(1);
}

async function inspect() {
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', ORDER_ID)
        .maybeSingle();
    if (error) { console.error('❌ orders read:', error.message); process.exit(1); }
    if (!order) { console.error('❌ Travis order row not found'); process.exit(1); }

    console.log('--- orders row ---');
    for (const k of ['id', 'order_number', 'payment_status', 'payment_method', 'total', 'paid_amount', 'balance_due', 'paid_at', 'created_at', 'user_id', 'notes']) {
        console.log(`  ${k.padEnd(16)}: ${(order as any)[k] ?? 'null'}`);
    }
    console.log(`  items             : ${JSON.stringify(order.items)}`);

    const { data: payments, error: pErr } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', ORDER_ID)
        .order('created_at', { ascending: true });
    if (pErr) {
        console.log(`\n--- payments ledger --- (read error: ${pErr.message})`);
    } else {
        console.log(`\n--- payments ledger (${(payments || []).length} rows) ---`);
        for (const p of payments || []) console.log(`  ${JSON.stringify(p)}`);
    }

    if ((order as any).user_id) {
        const { data: prof } = await supabase
            .from('profiles')
            .select('id,lifetime_spend_usd')
            .eq('id', (order as any).user_id)
            .maybeSingle();
        console.log(`\n--- profile ---\n  ${JSON.stringify(prof)}`);

        const { data: sibling } = await supabase
            .from('orders')
            .select('id,order_number,payment_status,created_at,total,paid_amount,balance_due')
            .eq('user_id', (order as any).user_id)
            .order('created_at');
        console.log(`\n--- all orders for this user (${(sibling || []).length}) ---`);
        for (const s of sibling || []) console.log(`  ${JSON.stringify(s)}`);
    } else {
        console.log('\n--- profile ---\n  no user_id (public backfill row) — reconcile would skip the profile increment');
    }

    const { data: shp, error: shpErr } = await supabase
        .from('shipments')
        .select('*')
        .eq('order_id', ORDER_ID)
        .maybeSingle();
    console.log(`\n--- shipment --- ${shpErr ? `(read error: ${shpErr.message})` : JSON.stringify(shp)}`);
}

async function applyPaid() {
    const { data: order, error: oErr } = await supabase
        .from('orders')
        .select('payment_status,total,notes,balance_due,paid_amount')
        .eq('id', ORDER_ID)
        .maybeSingle();
    if (oErr) { console.error('❌ orders read:', oErr.message); process.exit(1); }
    if (!order) { console.error('❌ row gone'); process.exit(1); }
    if (order.payment_status !== 'pending') { console.log(`already '${order.payment_status}' — nothing to do`); return; }

    // Step 1: restore the balance the notes attest, and STRIKE the "owes"
    // marker. resolvePaymentState (utils/orderDepositNotes.ts) parses notes
    // BEFORE status, so a paid row still reading "BAL $10 owes" would have
    // its balance_due resurrected to 10 on the next write path that runs
    // through that helper — the exact drift this repo keeps fighting.
    const m = DEPOSIT_NOTES_RE.exec(String(order.notes || ''));
    const owed = m ? Number(m[2]) : 10;
    const fixedNotes = String(order.notes || '').replace(
        /BAL \$\d+(?:\.\d+)? owes/,
        `BAL $${owed} paid 2026-10-03 (reconciled)`,
    );
    const { error: uErr } = await supabase
        .from('orders')
        .update({ balance_due: owed, notes: fixedNotes })
        .eq('id', ORDER_ID)
        .eq('payment_status', 'pending');
    if (uErr) { console.error('❌ restore update:', uErr.message); process.exit(1); }
    console.log(`✓ restored balance_due=${owed} per notes, struck the "owes" marker`);

    // Step 2: record the receipt. A full-balance record flips the order to
    // paid, credits profiles.lifetime_spend_usd, and writes the audit row to
    // `payments` — the evidence trail that was missing. Falls back to
    // reconcile_balance_payment (same flip, no ledger row) if the RPC's
    // execute grant is absent.
    const { data: rec, error: recErr } = await supabase.rpc('record_partial_payment', {
        p_order_id: ORDER_ID,
        p_amount: owed,
        p_proof_url: null,
        p_notes: 'Balance collected off-platform; deposit order reconciled 2026-10-03',
        p_payment_method: 'cash',
    });
    if (recErr || !(rec as any)?.success) {
        console.warn(`⚠ record_partial_payment unavailable (${recErr?.message || (rec as any)?.error}) — falling back to reconcile_balance_payment`);
        const { data: rc, error: rErr } = await supabase.rpc('reconcile_balance_payment', { p_order_id: ORDER_ID });
        if (rErr || !(rc as any)?.success) { console.error('❌', rErr?.message || JSON.stringify(rc)); process.exit(1); }
        console.log('✓ reconcile_balance_payment:', JSON.stringify(rc));
    } else {
        console.log('✓ record_partial_payment:', JSON.stringify(rec));
    }

    // Step 3: read everything back.
    const { data: after } = await supabase
        .from('orders')
        .select('payment_status,paid_amount,balance_due,paid_at,total,notes')
        .eq('id', ORDER_ID)
        .maybeSingle();
    const { data: ledger } = await supabase.from('payments').select('*').eq('order_id', ORDER_ID);
    const { data: prof } = await supabase.from('profiles').select('lifetime_spend_usd').eq('id', 'fb078e4d-3aae-4efc-8999-7c8625427459').maybeSingle();
    console.log('\n--- after ---');
    console.log('  order : ' + JSON.stringify(after));
    console.log('  ledger: ' + JSON.stringify(ledger));
    console.log('  profile: ' + JSON.stringify(prof));
}

async function applyClose() {
    const marker = `BAL $10 closed unpaid on 2026-10-03 — balance never received; $30 deposit kept on record (see ORPHAN_DECISIONS).`;
    const { data: cur } = await supabase.from('orders').select('notes,payment_status').eq('id', ORDER_ID).maybeSingle();
    if (!cur) { console.error('❌ row gone'); process.exit(1); }
    if (cur.payment_status !== 'pending') { console.log(`already '${cur.payment_status}' — nothing to do`); return; }
    const notes = String(cur.notes || '').includes('BAL $10 closed unpaid')
        ? cur.notes
        : `${cur.notes || ''} ${marker}`.trim();
    const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'cancelled', notes })
        .eq('id', ORDER_ID)
        .eq('payment_status', 'pending');
    if (error) { console.error('❌ update error:', error.message); process.exit(1); }
    console.log(`✓ ${ORDER_NUMBER} pending → cancelled (notes annotated)`);
}

async function applyLedger() {
    const { data: existing, error: eErr } = await supabase
        .from('payments')
        .select('id')
        .eq('order_id', ORDER_ID);
    if (eErr) { console.error('❌ payments read:', eErr.message); process.exit(1); }
    if ((existing || []).length) { console.log(`already ${(existing || []).length} ledger row(s) — nothing to do`); return; }
    const { data, error } = await supabase.from('payments').insert({
        order_id: ORDER_ID,
        amount: 10,
        proof_url: null,
        payment_method: 'cash',
        notes: 'Balance collected off-platform; deposit order reconciled 2026-10-03 via reconcile_balance_payment (record_partial_payment RPC unavailable: profiles.user_id missing).',
        admin_id: null,
    }).select();
    if (error) { console.error('❌ payments insert:', error.message); process.exit(1); }
    console.log('✓ ledger row written: ' + JSON.stringify(data));
}

async function main() {
    await inspect();
    if (APPLY_PAID) await applyPaid();
    if (APPLY_CLOSE) await applyClose();
    if (APPLY_LEDGER) await applyLedger();
}

main();
