// tests/shippingWebhookHook.test.ts
//
// Tests for the label-purchase hook inside /api/stripe-webhook — the glue
// between "money moved" and "postage bought".
//
// The contract under test (HTTP statuses control Stripe redelivery):
//   - reconcile success + label purchased  -> 200
//   - reconcile success + label retryable  -> 500 (Stripe redelivers; the
//     shipments claim row makes the next attempt safe)
//   - reconcile success + label permanent  -> 200 + admin alert email
//     (retrying can never fix a bad address — don't burn redeliveries)
//   - reconcile success + label skipped    -> 200, no alert noise
//
// The events are pre-signed with Stripe's own test header generator (same
// scheme as tests/stripeWebhookReconcile.test.ts); services/shipping is
// mocked at the module boundary — its own contract is covered in
// tests/shippingLabel.test.ts.

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

const mockPurchaseLabel = vi.fn();
vi.mock('../services/shipping', () => ({
    purchaseLabelForOrder: (...args: unknown[]) => mockPurchaseLabel(...args),
}));

// ---------------------------------------------------------------------------
// Request/response stubs (mirrors stripeWebhookReconcile.test.ts)
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = 'whsec_test_label_hook';

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
    return { method: 'POST', headers, body: rawBody };
}

function makeEvent(payload: object): { raw: string; signature: string } {
    const raw = JSON.stringify(payload);
    const stripe = new Stripe('sk_test_signing');
    const signature = stripe.webhooks.generateTestHeaderString({ payload: raw, secret: WEBHOOK_SECRET });
    return { raw, signature };
}

function piSucceeded(orderId = 'order_label_1'): Record<string, unknown> {
    return {
        id: 'evt_label_1',
        object: 'event',
        api_version: '2024-06-20',
        created: Math.floor(Date.now() / 1000),
        data: {
            object: {
                id: 'pi_label_1',
                object: 'payment_intent',
                amount: 4500,
                currency: 'usd',
                status: 'succeeded',
                metadata: { order_id: orderId },
            },
        },
        livemode: false,
        pending_webhooks: 1,
        request: { id: null, idempotency_key: null },
        type: 'payment_intent.succeeded',
    };
}

/** Order already fully settled — reconcilePayment's early-exit success path. */
function stubSettledOrder() {
    mockSupabaseFrom.mockReturnValue(({
        select: () => ({
            eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: 'order_label_1', balance_due: 0, total: 45, payment_status: 'paid', paid_amount: 45 }, error: null }),
            }),
        }),
    }) as any);
}

async function importHandler() {
    process.env.STRIPE_SECRET_KEY = 'sk_test_hook';
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.RESEND_API_KEY = 're_test_key';
    const mod = await import('../api/stripe-webhook');
    return mod.default;
}

async function post(payload: object) {
    const handler = await importHandler();
    const { raw, signature } = makeEvent(payload);
    const res = makeRes();
    await handler(makeReq(raw, { 'stripe-signature': signature }), res);
    return res;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stripe-webhook label hook', () => {
    beforeEach(() => {
        mockSupabaseFrom.mockReset();
        mockSupabaseRpc.mockReset();
        mockResendSend.mockReset();
        mockResendSend.mockResolvedValue({ data: { id: 'email_x' }, error: null });
        mockPurchaseLabel.mockReset();
    });

    afterEach(() => {
        delete process.env.STRIPE_SECRET_KEY;
        delete process.env.STRIPE_WEBHOOK_SECRET;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.RESEND_API_KEY;
    });

    it('label purchased after reconcile success -> 200', async () => {
        stubSettledOrder();
        mockPurchaseLabel.mockResolvedValue({ outcome: 'purchased', reason: 'label_purchased' });

        const res = await post(piSucceeded());

        expect(res.statusCode).toBe(200);
        expect(mockPurchaseLabel).toHaveBeenCalledWith('order_label_1');
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('label failure (transient) -> 500 so Stripe redelivers', async () => {
        stubSettledOrder();
        mockPurchaseLabel.mockResolvedValue({ outcome: 'retryable', reason: 'shippo_500' });

        const res = await post(piSucceeded());

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual(expect.objectContaining({ error: 'Label purchase failed — will retry' }));
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('label failure (permanent) -> 200 + admin alert email', async () => {
        stubSettledOrder();
        mockPurchaseLabel.mockResolvedValue({ outcome: 'failed', reason: 'incomplete_shipping_address' });

        const res = await post(piSucceeded());

        expect(res.statusCode).toBe(200);
        expect(mockResendSend).toHaveBeenCalledTimes(1);
        const call = mockResendSend.mock.calls[0][0];
        expect(call.subject).toContain('label failed');
        expect(call.html).toContain('incomplete_shipping_address');
        expect(call.html).toContain('admin?tab=orders&q=order_label_1');
    });

    it('label skipped (not configured / already claimed) -> 200, no alert', async () => {
        stubSettledOrder();
        mockPurchaseLabel.mockResolvedValue({ outcome: 'skipped', reason: 'shippo_not_configured' });

        const res = await post(piSucceeded());

        expect(res.statusCode).toBe(200);
        expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('a redelivered event re-runs reconcile (no-op) and the label attempt again', async () => {
        stubSettledOrder();
        // First delivery bought the label; the service's claim row makes this
        // second call a skip — the webhook layer must still answer 200.
        mockPurchaseLabel.mockResolvedValue({ outcome: 'skipped', reason: 'already_claimed' });

        const res = await post(piSucceeded());

        expect(res.statusCode).toBe(200);
        expect(mockSupabaseRpc).not.toHaveBeenCalled(); // reconcile early-exited: order already paid
        expect(mockPurchaseLabel).toHaveBeenCalledTimes(1);
    });

    it('reconcile failure paths are untouched by the label hook', async () => {
        mockSupabaseFrom.mockReturnValue(({
            select: () => ({
                eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
            }),
        }) as any);
        mockSupabaseRpc.mockResolvedValue({ data: { success: false, error: 'Balance mismatch' }, error: null });

        const res = await post(piSucceeded());

        // The lookup returns null (no order row), and an absent order is
        // TRANSIENT by contract — the write this webhook races may not have
        // landed yet — so Stripe must redeliver (500), not accept a failure
        // that a second delivery could fix. The admin alert still fires and
        // the label hook never runs on a failed reconcile. The permanent
        // path (RPC business reject -> 200) is covered by
        // tests/stripeWebhookReconcile.test.ts.
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual(expect.objectContaining({ error: 'Auto-reconciliation failed — will retry' }));
        expect(mockPurchaseLabel).not.toHaveBeenCalled();
        const call = mockResendSend.mock.calls[0][0];
        expect(call.subject).toContain('webhook reconcile failed');
    });
});
