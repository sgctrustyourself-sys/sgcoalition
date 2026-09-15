// tests/pricingPreview.test.ts
//
// Regression tests for /api/pricing-preview — specifically the line-splitting
// contract the order summary relies on:
//
//   discountCents  = setBonus + otherDisc + couponDiscountCents + storeCredit
//   cryptoDiscountCents must be ONLY the method-specific remainder (otherDisc),
//   NOT the coupon — otherwise a card payment with a coupon renders a fake
//   "Crypto Discount (10%)" line showing the coupon amount (the bug this
//   suite locks down).
//
// Calls the real handler with mock Supabase boundaries (products + coupons
// lookups are the only chains resolvePricing touches — the preview handler
// does NOT read payment_settings).

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mock helpers — chainable Supabase query stubs (mirrors createPaymentIntent.test.ts)
// ---------------------------------------------------------------------------

function chain(resolution: unknown) {
    const q: Record<string, any> = {};
    q.maybeSingle = vi.fn().mockResolvedValue(resolution);
    q.single = vi.fn().mockResolvedValue(resolution);
    q.select = vi.fn(() => q);
    q.in = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.then = vi.fn((onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(resolution).then(onFulfilled));
    return q;
}

const mockSupabaseFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: mockSupabaseFrom,
    })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes() {
    const res: Record<string, any> = {
        _status: 200,
        _body: null,
        _headers: {} as Record<string, string>,
        setHeader: vi.fn(function (k: string, v: string) { res._headers[k] = v; }),
        status: vi.fn(function (s: number) { res._status = s; return res; }),
        json: vi.fn(function (body: any) { res._body = body; return res; }),
        end: vi.fn(function () { return res; }),
    };
    return res;
}

function makeReq(method = 'POST', body: any = {}) {
    return { method, body };
}

const TEE = { id: 'prod_tee_above_as_below', name: 'COALITION ABOVE AS BELOW TEE', price: 75, category: 'shirt', archived: false, size_inventory: { M: 10 } };
const PERCENT_COUPON = {
    id: 'cp-qa', code: 'QA-SAVE25', discount_type: 'percent', discount_value: 25,
    min_order_value: 50, max_uses: 10, used_count: 0, start_date: null, end_date: null, is_active: true,
};

// products lookup resolves first (loadProducts), then the coupons lookup.
function stubProductAndCoupon(couponRow: unknown) {
    mockSupabaseFrom.mockReturnValueOnce(chain({ data: [TEE], error: null }));          // products
    mockSupabaseFrom.mockReturnValueOnce(chain({ data: couponRow, error: null }));      // coupons
}

let handler: any;

// Load the handler exactly once. Importing it inside each test re-evaluates
// the module graph within vitest's 5s default timeout, which intermittently
// fails under full-suite parallel load ("Test timed out in 5000ms") even
// though the file passes when run alone. The mocked Supabase factory reads
// mockSupabaseFrom at import time, so the import has to happen after this
// file's top-level code — i.e. in a hook, not a static import (which would
// throw on the not-yet-initialised const).
beforeAll(async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    handler = (await import('../api/_handlers/pricing-preview')).default;
}, 30000);

beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseFrom.mockReset();
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    // Pin the SGCoin incentive OFF: these fixtures assert discount-line
    // SPLITTING (coupon vs crypto vs set bonus), not the crypto amount.
    // Vercel exposes VITE_* vars to functions, so a real deployment env
    // would otherwise flip the crypto line on and break these totals.
    delete process.env.VITE_SGCOIN_DISCOUNT_ENABLED;
});

afterEach(() => {
    delete process.env.VITE_SGCOIN_DISCOUNT_ENABLED;
});

describe('/api/pricing-preview line-splitting contract', () => {
    it('card + coupon: cryptoDiscountCents is 0 (coupon must NOT leak into the crypto line)', async () => {
        stubProductAndCoupon(PERCENT_COUPON);
        const req = makeReq('POST', {
            items: [{ productId: 'prod_tee_above_as_below', selectedSize: 'M', quantity: 1 }],
            shippingCost: 0,
            paymentMethod: 'card',
            couponCode: 'QA-SAVE25',
        });
        const res = makeRes();
        await handler(req, res);
        expect(res._status).toBe(200);
        expect(res._body.couponDiscountCents).toBe(1875);   // 25% of $75
        expect(res._body.discountCents).toBe(1875);
        expect(res._body.cryptoDiscountCents).toBe(0);      // the regression
        expect(res._body.totalCents).toBe(5625);
    });

    it('card without coupon: no crypto line, no coupon line, full total', async () => {
        stubProductAndCoupon(null);
        const req = makeReq('POST', {
            items: [{ productId: 'prod_tee_above_as_below', selectedSize: 'M', quantity: 1 }],
            shippingCost: 0,
            paymentMethod: 'card',
        });
        const res = makeRes();
        await handler(req, res);
        expect(res._status).toBe(200);
        expect(res._body.couponDiscountCents).toBe(0);
        expect(res._body.cryptoDiscountCents).toBe(0);
        expect(res._body.totalCents).toBe(7500);
    });

    it('crypto + coupon: crypto line comes from the shared SGCoin helper (0 while the incentive flag is off)', async () => {
        stubProductAndCoupon(PERCENT_COUPON);
        const req = makeReq('POST', {
            items: [{ productId: 'prod_tee_above_as_below', selectedSize: 'M', quantity: 1 }],
            shippingCost: 0,
            paymentMethod: 'crypto',
            couponCode: 'QA-SAVE25',
        });
        const res = makeRes();
        await handler(req, res);
        expect(res._status).toBe(200);
        // The preview handler never passes clientDiscountDollars, so otherDisc
        // is 0 even for crypto — the coupon is the only discount.
        expect(res._body.cryptoDiscountCents).toBe(0);
        expect(res._body.couponDiscountCents).toBe(1875);
        expect(res._body.totalCents).toBe(5625);
    });

    it('rejects empty item lists with 400', async () => {
        const req = makeReq('POST', { items: [], shippingCost: 0, paymentMethod: 'card' });
        const res = makeRes();
        await handler(req, res);
        expect(res._status).toBe(400);
        expect(res._body.error).toMatch(/At least one item required/);
    });
});
