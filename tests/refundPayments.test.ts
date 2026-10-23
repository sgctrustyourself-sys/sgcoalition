// tests/refundPayments.test.ts
//
// Tests for services/refundPayments.ts — the server-side Stripe refund.
//
// Supabase and the Stripe client are faked at their module boundaries, so these
// tests pin the decisions the module makes: which orders are refundable, the
// amount sent to Stripe, the idempotency key, and what is written back.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
    const state = {
        order: null as Record<string, unknown> | null,
        writes: [] as Array<{ table: string; op: string; payload: unknown }>,
        refundCreate: vi.fn(),
        paymentIntentRetrieve: vi.fn(),
        refundList: vi.fn(),
        failUpdate: false,
    };
    return state;
});

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        from(table: string) {
            const log = { table, op: 'select', payload: null as unknown };
            const chain: any = {
                select() { return chain; },
                insert(p: unknown) { log.op = 'insert'; log.payload = p; h.writes.push(log); return chain; },
                update(p: unknown) { log.op = 'update'; log.payload = p; h.writes.push(log); return chain; },
                eq() { return chain; },
                single() { return Promise.resolve({ data: { id: 'exc_1' }, error: null }); },
                maybeSingle() { return Promise.resolve({ data: h.order, error: null }); },
                then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
                    const result = log.op === 'update' && h.failUpdate
                        ? { data: null, error: { message: 'db down' } }
                        : { data: null, error: null };
                    return Promise.resolve(result).then(resolve, reject);
                },
            };
            return chain;
        },
    }),
}));

vi.mock('../api/_services', () => ({
    stripeClient: () => ({
        refunds: { create: h.refundCreate, list: h.refundList },
        paymentIntents: { retrieve: h.paymentIntentRetrieve },
        // refunds.list is also used for the whole-charge check
    }),
}));

import { issueOrderRefund, RefundError } from '../services/refundPayments';

const ORDER = {
    id: 'order_1',
    total: 25,
    payment_method: 'stripe',
    payment_reference: 'pi_123',
    payment_status: 'paid',
    notes: 'Gift wrap',
};

const input = { orderId: 'order_1', amountCents: 2500, reason: 'damaged', adminId: 'ops' };

describe('issueOrderRefund', () => {
    beforeEach(() => {
        h.order = { ...ORDER };
        h.writes.length = 0;
        h.failUpdate = false;
        h.refundCreate.mockReset().mockResolvedValue({ id: 're_1' });
        h.paymentIntentRetrieve.mockReset().mockResolvedValue({ amount_received: 2500 });
        h.refundList.mockReset().mockResolvedValue({ data: [{ amount: 2500, status: 'succeeded' }] });
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    });

    afterEach(() => {
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it('refuses an order that was not paid by Stripe card (422, no Stripe call)', async () => {
        h.order = { ...ORDER, payment_method: 'crypto', payment_reference: '' };

        await expect(issueOrderRefund(input)).rejects.toMatchObject({ status: 422 });
        expect(h.refundCreate).not.toHaveBeenCalled();
        expect(h.writes).toHaveLength(0);
    });

    it('refuses a Stripe order whose reference is not a payment intent (422)', async () => {
        h.order = { ...ORDER, payment_reference: 'ch_legacy' };

        await expect(issueOrderRefund(input)).rejects.toBeInstanceOf(RefundError);
        expect(h.refundCreate).not.toHaveBeenCalled();
    });

    it('refuses an amount above the order total (400, no Stripe call)', async () => {
        await expect(issueOrderRefund({ ...input, amountCents: 2501 })).rejects.toMatchObject({ status: 400 });
        expect(h.refundCreate).not.toHaveBeenCalled();
    });

    it('refuses a zero amount (400)', async () => {
        await expect(issueOrderRefund({ ...input, amountCents: 0 })).rejects.toMatchObject({ status: 400 });
    });

    it('records the audit row first, refunds with an exception-keyed idempotency key, then closes it', async () => {
        const result = await issueOrderRefund(input);

        expect(h.refundCreate).toHaveBeenCalledWith(
            {
                payment_intent: 'pi_123',
                amount: 2500,
                metadata: { order_id: 'order_1', exception_id: 'exc_1' },
            },
            { idempotencyKey: 'refund-exception-exc_1' },
        );

        const exceptionWrites = h.writes.filter((w) => w.table === 'refund_exceptions');
        expect(exceptionWrites[0]).toMatchObject({
            op: 'insert',
            payload: [expect.objectContaining({ order_id: 'order_1', refund_amount: 25, processed: false })],
        });
        expect(exceptionWrites[1]).toMatchObject({
            op: 'update',
            payload: expect.objectContaining({ processed: true }),
        });

        expect(result).toEqual({ refundId: 're_1', exceptionId: 'exc_1', amountCents: 2500, fullyRefunded: true });
    });

    it('marks a fully refunded order "refunded" and appends the refund to its notes', async () => {
        await issueOrderRefund(input);

        const orderWrite = h.writes.find((w) => w.table === 'orders');
        expect(orderWrite?.op).toBe('update');
        const payload = orderWrite?.payload as { notes: string; payment_status?: string };
        expect(payload.payment_status).toBe('refunded');
        expect(payload.notes).toContain('Gift wrap');
        expect(payload.notes).toContain('Refund: -$25.00 via re_1');
    });

    it('a partial refund leaves payment_status alone and reports fullyRefunded=false', async () => {
        h.refundList.mockResolvedValue({ data: [{ amount: 1000, status: 'succeeded' }] });

        const result = await issueOrderRefund({ ...input, amountCents: 1000 });

        const payload = h.writes.find((w) => w.table === 'orders')?.payload as Record<string, unknown>;
        expect(payload).not.toHaveProperty('payment_status');
        expect(payload.notes).toContain('Refund: -$10.00 via re_1');
        expect(result.fullyRefunded).toBe(false);
    });

    it('a Stripe failure is a 502 and leaves the exception unprocessed', async () => {
        h.refundCreate.mockRejectedValue(new Error('charge already refunded'));

        await expect(issueOrderRefund(input)).rejects.toMatchObject({
            status: 502,
            message: 'charge already refunded',
        });

        const closed = h.writes.some((w) => w.table === 'refund_exceptions' && w.op === 'update');
        const orderTouched = h.writes.some((w) => w.table === 'orders');
        expect(closed).toBe(false);
        expect(orderTouched).toBe(false);
    });

    it('a failed order update after a successful refund is reported with the refund id', async () => {
        h.failUpdate = true;

        await expect(issueOrderRefund(input)).rejects.toThrow(/re_1/);
    });
});
