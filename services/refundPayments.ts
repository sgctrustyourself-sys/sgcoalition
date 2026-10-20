// services/refundPayments.ts
//
// SERVER-ONLY. Issues the Stripe refund for an admin refund exception and
// records it on the order. The browser never talks to Stripe: the admin UI
// calls POST /api/admin-refund (api/_handlers/admin-refund.ts), which is
// admin-gated and delegates here.
//
// Flow, in order:
//   1. Load the order and confirm it was paid by Stripe card (pi_ reference).
//   2. Insert the refund_exceptions row as the audit record (processed=false).
//      The no-refunds override is the exception itself: the admin has already
//      decided to override the customer's consent, so no consent check gates it.
//   3. Create the Stripe refund. The idempotency key is derived from the
//      exception id, so a repeat of this exact call cannot refund twice.
//   4. Append the refund to the order notes, set payment_status to 'refunded'
//      when the whole charge is returned, and mark the exception processed.
//
// If step 3 fails, the exception row stays processed=false and no money moved,
// so the audit trail shows an attempt that did not complete.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { stripeClient } from '../api/_services.js';

export class RefundError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

function sb(): SupabaseClient {
    const u = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!u || !k) throw new RefundError(503, 'Supabase not configured.');
    return createClient(u, k);
}

export interface IssueOrderRefundInput {
    orderId: string;
    /** Refund amount in cents. Must be positive and no more than the order total. */
    amountCents: number;
    reason: string;
    /** Who approved the refund, recorded on the exception row. */
    adminId: string;
}

export interface IssuedOrderRefund {
    refundId: string;
    exceptionId: string;
    amountCents: number;
    fullyRefunded: boolean;
}

export async function issueOrderRefund(input: IssueOrderRefundInput): Promise<IssuedOrderRefund> {
    const client = sb();
    const orderId = String(input.orderId || '').trim();
    if (!orderId) throw new RefundError(400, 'orderId is required.');

    const { data: order, error: orderErr } = await client
        .from('orders')
        .select('id,total,payment_method,payment_reference,payment_status,notes')
        .eq('id', orderId)
        .maybeSingle();
    if (orderErr) throw new RefundError(500, orderErr.message || 'Order lookup failed.');
    if (!order) throw new RefundError(404, 'Order not found.');

    const paymentIntentId = String(order.payment_reference || '').trim();
    if (order.payment_method !== 'stripe' || !paymentIntentId.startsWith('pi_')) {
        throw new RefundError(422, 'Only orders paid by Stripe card can be refunded automatically.');
    }

    const totalCents = Math.round(Number(order.total || 0) * 100);
    const amountCents = Math.round(Number(input.amountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > totalCents) {
        throw new RefundError(400, 'Refund amount must be more than $0.00 and no more than the order total.');
    }

    // 2. Audit row first, so the Stripe idempotency key can name it.
    const { data: exception, error: excErr } = await client
        .from('refund_exceptions')
        .insert([{
            order_id: orderId,
            admin_id: input.adminId,
            admin_wallet_address: input.adminId,
            reason: input.reason,
            refund_amount: amountCents / 100,
            processed: false,
        }])
        .select('id')
        .single();
    if (excErr || !exception) throw new RefundError(500, excErr?.message || 'Could not record the refund exception.');
    const exceptionId = String((exception as { id: unknown }).id);

    // 3. Stripe. Stripe itself rejects any amount above what remains refundable.
    let refund: { id: string };
    try {
        refund = await stripeClient().refunds.create(
            {
                payment_intent: paymentIntentId,
                amount: amountCents,
                metadata: { order_id: orderId, exception_id: exceptionId },
            },
            { idempotencyKey: `refund-exception-${exceptionId}` },
        );
    } catch (e: unknown) {
        const message = (e as { message?: string })?.message || 'Stripe refund failed.';
        throw new RefundError(502, message);
    }

    // Whole-charge check against Stripe's own refund ledger, so a partial refund
    // issued earlier is counted. Falls back to this refund's amount alone.
    let fullyRefunded = amountCents === totalCents;
    try {
        const stripe = stripeClient();
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
        const refundedCents = refunds.data
            .filter((r) => r.status !== 'failed' && r.status !== 'canceled')
            .reduce((sum, r) => sum + r.amount, 0);
        fullyRefunded = intent.amount_received > 0 && refundedCents >= intent.amount_received;
    } catch {
        // Keep the fallback; the refund itself already succeeded.
    }

    // 4. Record on the order and close the exception.
    const stamp = new Date().toISOString().slice(0, 10);
    const noteLine = `Refund: -$${(amountCents / 100).toFixed(2)} via ${refund.id} on ${stamp} (${input.reason})`;
    const orderUpdate: Record<string, unknown> = {
        notes: [order.notes || '', noteLine].filter(Boolean).join('\n'),
    };
    if (fullyRefunded) orderUpdate.payment_status = 'refunded';

    const { error: updateErr } = await client.from('orders').update(orderUpdate).eq('id', orderId);
    if (updateErr) {
        throw new RefundError(500, `Refund ${refund.id} was issued but the order could not be updated: ${updateErr.message}`);
    }

    const { error: closeErr } = await client
        .from('refund_exceptions')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('id', exceptionId);
    if (closeErr) {
        throw new RefundError(500, `Refund ${refund.id} was issued but the exception could not be closed: ${closeErr.message}`);
    }

    return { refundId: refund.id, exceptionId, amountCents, fullyRefunded };
}
