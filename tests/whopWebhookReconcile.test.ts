// tests/whopWebhookReconcile.test.ts
// Tests for the hardened /api/whop-webhook reconcile path:
//   - metadata.order_id validation (missing / malformed / valid)
//   - retryability classification (transient vs permanent reconcile failures)
//   - HTTP status mapping (500 only for transient, 200 for permanent,
//     400 for malformed metadata — so Whop's redelivery policy is correct)
//
// The handler is exercised with mock Supabase + Resend boundaries. Events are
// pre-signed with the configured WHOP_WEBHOOK_SECRET using Whop's own
// signing scheme, so signature verification runs for real in every test.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
    Resend: vi.fn(function (this: Record<string, unknown>) {
        return { emails: { send: mockResendSend } };
    }),
}));

// ---------------------------------------------------------------------------
// Request/response stubs
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'ws_test_1234567890abcdef';

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
        body: rawBody,
    };
}

/** Build a signed Whop event using Whop's real HMAC scheme. */
function makeEvent(payload: object): { raw: string; signature: string } {
    const raw = JSON.stringify(payload);
    // Use Whop's webhook signing scheme: HMAC-SHA256 of the raw body with the secret
    const crypto = require('crypto');
    const secret = WEBHOOK_SECRET.startsWith('ws_') ? WEBHOOK_SECRET : 'ws_' + WEBHOOK_SECRET;
    const hmac = crypto.createHmac('sha256', secret);
    // Whop's header carries base64 of the raw HMAC digest — not a re-encoded
    // base64 string. Signing the double-encoded form made these tests pass
    // while every real delivery was rejected.
    const signature = 'v1,' + hmac.update(raw).digest('base64');
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
        type: 'payment.succeeded',
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
    process.env.WHOP_SECRET_KEY = 'whsec_test'; // not used by Whop webhook but kept for compatibility
    process.env.WHOP_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.RESEND_API_KEY = 're_test_key';
    const mod = await import('../api/whop-webhook');
    return mod.default;
}

async function post(payload: object, headers: Record<string, string> = {}) {
    const handler = await importHandler();
    const { raw, signature } = makeEvent(payload);
    const res = makeRes();
    await handler(
        makeReq(raw, { 'whop-signature': headers['whop-signature'] ?? signature }),
        res
    );
    return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('whop-webhook reconcile hardening', () => {
    beforeEach(() => {
        mockSupabaseFrom.mockReset();
        mockSupabaseRpc.mockReset();
        mockResendSend.mockReset();
        mockResendSend.mockResolvedValue({ data: { id: 'email_x' }, error: null });
        delete process.env.ORDER_NOTIFICATION_EMAIL;
        delete process.env.ADMIN_ORDER_EMAIL;
    });

    afterEach(() => {
        delete process.env.WHOP_SECRET_KEY;
        delete process.env.WHOP_WEBHOOK_SECRET;
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

    it('missing order -> 500 (Whop retries), admin alerted as transient', async () => {
        stubOrderLookup({ data: null, error: null });

        const res = await post(piSucceeded());
        // The order write races this webhook: the client records the order only
        // after its payment resolves, so a missing row means "not yet" (measured
        // — the row for order_1790143801835_89acaacc landed 200ms after the
        // miss that declared it permanently unreconcilable). 500 lets Whop's
        // redelivery reconcile the race; 200 here silences the only mechanism
        // that ever can. A write that truly never comes exhausts Whop's
        // retries and keeps alerting — the escalation money-without-order wants.
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: 'Auto-reconciliation failed — will retry' });
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        const call = mockResendSend.mock.calls[0][0];
        expect(call.subject).toContain('webhook reconcile failed');
        expect(call.html).toContain('Triage order in Admin');
    });

    it('alert email carries Whop event ID and one-click triage links', async () => {
        stubOrderLookup({ data: null, error: null });

        await post(piSucceeded());
        const call = mockResendSend.mock.calls[0][0];
        // Whop event ID (from the signed envelope) is in the email body
        expect(call.html).toContain('evt_test_1');
        // Deep link into the admin orders view (full URL, HTML-escaped &)
        expect(call.html).toContain('Triage order in Admin');
        // Direct link to the payment in the Whop dashboard
        expect(call.html).toContain('https://dashboard.stripe.com/payments/pi_test_123');
    });

    it('DB outage during lookup -> 500 (Whop retries), transient alert', async () => {
        stubOrderLookup({ data: null, error: { message: 'connection reset' } });

        const res = await post(piSucceeded());
        expect(res.statusCode).toBe(500);
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        const call = mockResendSend.mock.calls[0][0];
        expect(call.html).toContain('Triage order in Admin');
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

    it('malformed metadata order_id -> 400 (Whop stops redelivering), no DB call, no alert', async () => {
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

    it('non-payment.succeeded events are accepted with 200 and ignored', async () => {
        const payload = {
            id: 'evt_other',
            object: 'event',
            type: 'dispute.created',
            data: { object: { id: 'ch_1' } },
        };
        const res = await post(payload);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ received: true }));
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('bad signature -> 400 before any reconciliation runs', async () => {
        const res = await post(piSucceeded(), { 'whop-signature': 't=1,v1=deadbeef' });
        expect(res.statusCode).toBe(400);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('v1 signature with a non-32-byte payload -> 400, not an uncaught throw', async () => {
        // timingSafeEqual throws RangeError when the buffers differ in length.
        // Before the length guard, a truncated `v1,` header crashed the whole
        // function (500) instead of rejecting the delivery (400).
        const short = await post(piSucceeded(), { 'whop-signature': 'v1,abc' });
        expect(short.statusCode).toBe(400);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();

        const fullLengthButWrong = await post(piSucceeded(), {
            'whop-signature': 'v1,' + Buffer.alloc(32).toString('base64'),
        });
        expect(fullLengthButWrong.statusCode).toBe(400);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('verification uses a module-scope node:crypto import, never require()', () => {
        // This package is ESM ("type": "module"), so require() is undefined in
        // the deployed Vercel function even though Vitest hands it to test
        // modules. A require() on the verification path 500s every real
        // `v1,<sig>` delivery while GET/OPTIONS keep the endpoint looking alive.
        const source = readFileSync(resolve(process.cwd(), 'api/whop-webhook.ts'), 'utf8');
        expect(source).not.toMatch(/\brequire\s*\(/);
        expect(source).toMatch(/from 'node:crypto'/);
    });
});