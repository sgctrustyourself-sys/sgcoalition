// tests/stripeWebhookReconcile.test.ts
//
// Tests for the hardened /api/stripe-webhook reconcile path:
//   - metadata.order_id validation (missing / malformed / valid)
//   - retryability classification (transient vs permanent reconcile failures)
//   - HTTP status mapping (500 only for transient, 200 for permanent,
//     400 for malformed metadata — so Stripe's redelivery policy is correct)
//
// The handler is exercised with mock Supabase + Resend boundaries. Events are
// pre-signed with the configured STRIPE_WEBHOOK_SECRET using Stripe's own
// generateTestHeaderString, so constructEvent verification runs for real in
// every test.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Mock external modules BEFORE importing the handler
// ---------------------------------------------------------------------------

const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: mockSupabaseFrom,
        rpc: mockSupabaseRpc,
    })),
}));

const mockResendSend = vi.fn();
vi.mock('resend', () => ({
    Resend: vi.fn(function (this: any) {
        return { emails: { send: mockResendSend } };
    }),
}));

// ---------------------------------------------------------------------------
// Request/response stubs
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'whsec_test_1234567890abcdef';

function makeRes() {
    const res: any = {
        statusCode: 0,
        body: undefined,
        setHeader: vi.fn(),
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        json(b: unknown) {
            res.body = b;
            return res;
        },
        end() {
            return res;
        },
    };
    return res;
}

function makeReq(rawBody: string, headers: Record<string, string> = {}): any {
    return {
        method: 'POST',
        headers,
        // readRawBody accepts a string body directly.
        body: rawBody,
    };
}

/** Build a signed event using Stripe's real HMAC scheme. */
function makeEvent(payload: object): { raw: string; signature: string } {
    const raw = JSON.stringify(payload);
    const stripe = new Stripe('sk_test_signing');
    const signature = stripe.webhooks.generateTestHeaderString({
        payload: raw,
        secret: WEBHOOK_SECRET,
    });
    return { raw, signature };
}

function piSucceeded(overrides: {
    id?: string;
    metadata?: Record<string, string> | null;
} = {}): Record<string, unknown> {
    return {
        id: 'evt_test_1',
        object: 'event',
        api_version: '2024-06-20',
        created: Math.floor(Date.now() / 1000),
        data: {
            object: {
                id: overrides.id ?? 'pi_test_123',
                object: 'payment_intent',
                amount: 4000,
                currency: 'usd',
                status: 'succeeded',
                metadata: overrides.metadata === undefined ? { order_id: 'order_123' } : overrides.metadata,
            },
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: null, idempotency_key: null },
        type: 'payment_intent.succeeded',
    };
}

/** Stub the orders lookup used by reconcilePayment. */
function stubOrderLookup(row: unknown) {
    mockSupabaseFrom.mockReturnValue(({
        select: () => ({
            eq: () => ({
                maybeSingle: () => Promise.resolve(row),
            }),
        }),
    }) as any);
}

// ---------------------------------------------------------------------------
// Import handler AFTER mocks (the module reads env at import time)
// ---------------------------------------------------------------------------

async function importHandler() {
    process.env.STRIPE_SECRET_KEY = 'sk_test_hook';
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.RESEND_API_KEY = 're_test_key';
    const mod = await import('../api/stripe-webhook');
    return mod.default;
}

async function post(payload: object, headers: Record<string, string> = {}) {
    const handler = await importHandler();
    const { raw, signature } = makeEvent(payload);
    const res = makeRes();
    await handler(
        makeReq(raw, { 'stripe-signature': headers['stripe-signature'] ?? signature }),
        res
    );
    return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stripe-webhook reconcile hardening', () => {
    beforeEach(() => {
        mockSupabaseFrom.mockReset();
        mockSupabaseRpc.mockReset();
        mockResendSend.mockReset();
        mockResendSend.mockResolvedValue({ data: { id: 'email_x' }, error: null });
        delete process.env.ORDER_NOTIFICATION_EMAIL;
        delete process.env.ADMIN_ORDER_EMAIL;
    });

    afterEach(() => {
        delete process.env.STRIPE_SECRET_KEY;
        delete process.env.STRIPE_WEBHOOK_SECRET;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.RESEND_API_KEY;
    });

    it('200 + reconciled when the RPC flips a pending deposit order to paid', async () => {
        stubOrderLookup({ data: { id: 'order_123', balance_due: 50, total: 100, payment_status: 'pending', paid_amount: 50 }, error: null });
        mockSupabaseRpc.mockResolvedValue({
            data: { success: true, balance_paid: 50, new_total_paid: 100 },
            error: null,
        });

        const res = await post(piSucceeded());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ received: true }));
        expect(mockSupabaseRpc).toHaveBeenCalledWith('reconcile_balance_payment', { p_order_id: 'order_123' });
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('missing order -> 200 (no Stripe retry), admin alerted as permanent', async () => {
        stubOrderLookup({ data: null, error: null });

        const res = await post(piSucceeded());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ reconciled: false }));
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        const call = mockResendSend.mock.calls[0][0];
        expect(call.subject).toContain('webhook reconcile failed');
        expect(call.html).toContain('Permanently unreconcilable');
    });

    it('alert email carries Stripe event ID and one-click triage links', async () => {
        stubOrderLookup({ data: null, error: null });

        await post(piSucceeded());
        const call = mockResendSend.mock.calls[0][0];
        // Stripe event ID (from the signed envelope) is in the email body
        expect(call.html).toContain('evt_test_1');
        // Deep link into the admin orders view, pre-filtered on the order id
        // (& is HTML-escaped in the href attribute, as it must be)
        expect(call.html).toContain('/#/admin?tab=orders&amp;q=order_123');
        // Direct link to the payment in the Stripe dashboard
        expect(call.html).toContain('dashboard.stripe.com/payments/pi_test_123');
    });

    it('DB outage during lookup -> 500 (Stripe retries), transient alert', async () => {
        stubOrderLookup({ data: null, error: { message: 'connection reset' } });

        const res = await post(piSucceeded());
        expect(res.statusCode).toBe(500);
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        const call = mockResendSend.mock.calls[0][0];
        expect(call.html).toContain('Stripe will redeliver');
    });

    it('RPC business reject -> 200, no retry, admin alerted as permanent', async () => {
        stubOrderLookup({ data: { id: 'order_123', balance_due: 50, total: 100, payment_status: 'pending', paid_amount: 50 }, error: null });
        mockSupabaseRpc.mockResolvedValue({
            data: { success: false, error: 'Balance mismatch' },
            error: null,
        });

        const res = await post(piSucceeded());
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ reconciled: false }));
        const call = mockResendSend.mock.calls[0][0];
        expect(call.html).toContain('Permanently unreconcilable');
    });

    it('malformed metadata order_id -> 400 (Stripe stops redelivering), no DB call, no alert', async () => {
        const res = await post(piSucceeded({ metadata: { order_id: '../etc/passwd' } }));
        expect(res.statusCode).toBe(400);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
        expect(mockSupabaseRpc).not.toHaveBeenCalled();
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('order_id with a non-string value -> 400 (metadata values are always strings)', async () => {
        const payload = piSucceeded();
        (payload as any).data.object.metadata = { order_id: 12345 };
        const res = await post(payload);
        expect(res.statusCode).toBe(400);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('succeeded PI with no order_id metadata -> 200, no reconcile attempt', async () => {
        const res = await post(piSucceeded({ metadata: null }));
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ received: true }));
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('non-payment_intent.succeeded events are accepted with 200 and ignored', async () => {
        const payload = {
            id: 'evt_other',
            object: 'event',
            type: 'charge.dispute.created',
            data: { object: { id: 'ch_1' } },
        };
        const res = await post(payload);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ received: true }));
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('bad signature -> 400 before any reconciliation runs', async () => {
        const res = await post(piSucceeded(), { 'stripe-signature': 't=1,v1=deadbeef' });
        expect(res.statusCode).toBe(400);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });
});
