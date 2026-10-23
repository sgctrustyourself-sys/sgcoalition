// tests/adminBuyLabel.test.ts
//
// Tests for POST /api/admin-buy-label — the one-click label purchase in
// Admin → Orders for orders the Stripe webhook does not cover (crypto,
// Cash App cashtag, cash, Venmo).
//
// The contract under test:
//   - admin-only ('shared' policy): anonymous/wrong-token -> 401, no purchase
//   - outcome-to-HTTP mapping: purchased/skipped -> 200, failed -> 422,
//     retryable -> 503 (the operator just clicks again)
//   - the service boundary is purchaseLabelForOrder verbatim — this endpoint
//     adds only the gate and the mapping, never its own purchase logic
//
// services/shipping is mocked at the module boundary; its own contract is
// covered in tests/shippingLabel.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPurchaseLabel = vi.fn();
vi.mock('../services/shipping', () => ({
    purchaseLabelForOrder: (...args: unknown[]) => mockPurchaseLabel(...args),
}));

// withAdminAuth's 'shared' policy is a synchronous secret compare; the Supabase
// client is only needed for the union/supabase policies. Mocked defensively so
// the module import never touches the network.
vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({})),
}));

import adminBuyLabelHandler from '../api/_handlers/admin-buy-label';

const ADMIN_TOKEN = 'admin-token-buy-label-12345';

function makeReq(opts: { method?: string; headers?: Record<string, string>; body?: unknown } = {}) {
    return {
        method: opts.method ?? 'POST',
        headers: opts.headers ?? {},
        query: {},
        url: '/api/admin-buy-label',
        body: opts.body ?? null,
    } as any;
}

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

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('POST /api/admin-buy-label', () => {
    beforeEach(() => {
        mockPurchaseLabel.mockReset();
        process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
        delete process.env.ADMIN_PASSPHRASE;
    });

    afterEach(() => {
        delete process.env.ADMIN_API_TOKEN;
        delete process.env.ADMIN_PASSPHRASE;
    });

    it('OPTIONS preflight -> 200 and no purchase attempt', async () => {
        const res = makeRes();
        await adminBuyLabelHandler(makeReq({ method: 'OPTIONS' }), res);

        expect(res.statusCode).toBe(200);
        expect(mockPurchaseLabel).not.toHaveBeenCalled();
    });

    it('anonymous -> 401, no purchase attempt', async () => {
        const res = makeRes();
        await adminBuyLabelHandler(makeReq({ body: { orderId: 'order_1' } }), res);

        expect(res.statusCode).toBe(401);
        expect(mockPurchaseLabel).not.toHaveBeenCalled();
    });

    it('wrong token -> 401', async () => {
        const res = makeRes();
        await adminBuyLabelHandler(makeReq({ headers: bearer('not-the-token'), body: { orderId: 'order_1' } }), res);

        expect(res.statusCode).toBe(401);
        expect(mockPurchaseLabel).not.toHaveBeenCalled();
    });

    it('non-POST -> 405', async () => {
        const res = makeRes();
        await adminBuyLabelHandler(makeReq({ method: 'GET', headers: bearer(ADMIN_TOKEN) }), res);

        expect(res.statusCode).toBe(405);
        expect(mockPurchaseLabel).not.toHaveBeenCalled();
    });

    it('missing orderId -> 400', async () => {
        const res = makeRes();
        await adminBuyLabelHandler(makeReq({ headers: bearer(ADMIN_TOKEN), body: {} }), res);

        expect(res.statusCode).toBe(400);
        expect(mockPurchaseLabel).not.toHaveBeenCalled();
    });

    it('purchased -> 200 with the shipment payload', async () => {
        mockPurchaseLabel.mockResolvedValue({
            outcome: 'purchased',
            reason: 'label_purchased',
            shipment: {
                trackingNumber: '9400111899560000000000',
                trackingUrl: 'https://tools.usps.com/track',
                labelUrl: 'https://shippo-delivery.s3.amazonaws.com/label.pdf',
                rateCents: 568,
                carrier: 'USPS',
                service: 'USPS Ground Advantage',
            },
        });

        const res = makeRes();
        await adminBuyLabelHandler(makeReq({ headers: bearer(ADMIN_TOKEN), body: { orderId: 'order_1' } }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual(expect.objectContaining({ ok: true, outcome: 'purchased' }));
        expect(res.body.shipment.trackingNumber).toBe('9400111899560000000000');
        expect(mockPurchaseLabel).toHaveBeenCalledWith('order_1');
    });

    it('skipped (already claimed / not paid) -> 200 with skipped:true shape, not an error', async () => {
        mockPurchaseLabel.mockResolvedValue({ outcome: 'skipped', reason: 'already_claimed' });

        const res = makeRes();
        await adminBuyLabelHandler(makeReq({ headers: bearer(ADMIN_TOKEN), body: { orderId: 'order_1' } }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ ok: false, outcome: 'skipped', reason: 'already_claimed' });
    });

    it('failed (permanent) -> 422 with the carrier reason', async () => {
        mockPurchaseLabel.mockResolvedValue({ outcome: 'failed', reason: 'incomplete_shipping_address' });

        const res = makeRes();
        await adminBuyLabelHandler(makeReq({ headers: bearer(ADMIN_TOKEN), body: { orderId: 'order_1' } }), res);

        expect(res.statusCode).toBe(422);
        expect(res.body).toEqual({ ok: false, outcome: 'failed', reason: 'incomplete_shipping_address' });
    });

    it('retryable (transient) -> 503 so the operator clicks again', async () => {
        mockPurchaseLabel.mockResolvedValue({ outcome: 'retryable', reason: 'shippo_500' });

        const res = makeRes();
        await adminBuyLabelHandler(makeReq({ headers: bearer(ADMIN_TOKEN), body: { orderId: 'order_1' } }), res);

        expect(res.statusCode).toBe(503);
        expect(res.body).toEqual({ ok: false, outcome: 'retryable', reason: 'shippo_500' });
    });
});
