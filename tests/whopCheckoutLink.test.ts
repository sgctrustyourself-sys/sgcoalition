// tests/whopCheckoutLink.test.ts
//
// Tests for POST /api/create-whop-checkout-link — the PROMOTER channel.
//
// A promoter sells a Coalition piece through their own Whop link and keeps
// 30% of that sale. The buyer on this path pays the NORMAL price: it is a
// revenue split, not a customer discount, and it never replaces the Stripe
// site checkout.
//
// What this suite pins:
//   1. AUTH — the endpoint is admin-gated. It holds the account's Whop API
//      key, so an open "mint me a link" endpoint is an affiliate-fraud
//      surface.
//   2. PRICE — the amount comes from the site's products table, never from
//      the request body. A caller-chosen price is a way to sell Coalition
//      product at any number.
//   3. ATTRIBUTION — the promoter's code travels as Whop's affiliate_code.
//   4. THE CHANNEL — the owner's whop payment toggle gates the whole thing.
//
// The Whop API shape is the real one:
//   POST https://api.whop.com/api/v1/checkout_configurations
//   { account_id, mode, plan: { product_id, plan_type, currency,
//     initial_price, title }, affiliate_code?, metadata?, redirect_url? }

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function chain(resolution: unknown) {
    const q: Record<string, any> = {};
    q.maybeSingle = vi.fn().mockResolvedValue(resolution);
    q.single = vi.fn().mockResolvedValue(resolution);
    q.select = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.in = vi.fn(() => q);
    q.then = vi.fn((onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(resolution).then(onFulfilled));
    return q;
}

const mockSupabaseFrom = vi.fn();
const mockFetch = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({ from: mockSupabaseFrom })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRes() {
    const res: Record<string, any> = {
        _status: 200,
        _body: null,
        setHeader: vi.fn(),
        status: vi.fn(function (s: number) { res._status = s; return res; }),
        json: vi.fn(function (b: any) { res._body = b; return res; }),
        end: vi.fn(function () { return res; }),
    };
    return res;
}

function makeReq(body: any = {}, headers: Record<string, string> = {}) {
    return { method: 'POST', body, headers };
}

const ADMIN_HEADERS = { authorization: 'Bearer admin-test-token' };

/** The payment_settings row — `whop` ON so the channel is reachable. */
const WHOP_ON_ROW = {
    id: 1, card_enabled: true, klarna_enabled: false,
    cashapp_enabled: true, crypto_enabled: true, whop_enabled: true,
};
/** The same row with the promoter channel switched off. */
const WHOP_OFF_ROW = { ...WHOP_ON_ROW, whop_enabled: false };

const TEE = { id: 'prod_tee_above_as_below', name: 'Above as Below Tee', price: 75, archived: false };

/** Point the Supabase mock at the settings row and the products table. */
function stubDb(settingsRow: unknown, product: unknown = TEE) {
    mockSupabaseFrom.mockImplementation((table: string) =>
        table === 'payment_settings'
            ? chain({ data: settingsRow, error: null })
            : chain({ data: product, error: null }),
    );
}

/** The fetch stub for the Whop API call. */
function stubWhop(ok = true, body: any = { id: 'ch_abc123', url: 'https://whop.com/checkout/ch_abc123' }) {
    mockFetch.mockResolvedValue({
        ok,
        status: ok ? 200 : 400,
        json: async () => body,
        text: async () => JSON.stringify(body),
    });
}

async function loadHandler() {
    process.env.ADMIN_API_TOKEN = 'admin-test-token';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.WHOP_API_KEY = 'whop_test_key';
    process.env.WHOP_ACCOUNT_ID = 'biz_test_company';
    process.env.WHOP_PRODUCT_MAP = JSON.stringify({ prod_tee_above_as_below: 'prod_whop_tee' });
    process.env.NODE_ENV = 'test';
    const mod = await import('../api/_handlers/create-whop-checkout-link');
    return mod.default;
}

/** The JSON body the handler sent to Whop. */
function whopRequestBody(): any {
    const call = mockFetch.mock.calls[0];
    return JSON.parse(call[1].body);
}

// =========================================================================
// Tests
// =========================================================================

describe('POST /api/create-whop-checkout-link', () => {
    let handler: Awaited<ReturnType<typeof loadHandler>>;

    beforeEach(async () => {
        mockSupabaseFrom.mockReset();
        mockFetch.mockReset();
        // The handler calls the global fetch — stub it, or the test hits the
        // real Whop API with a fake key.
        vi.stubGlobal('fetch', mockFetch);
        handler = await loadHandler();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete process.env.WHOP_API_KEY;
        delete process.env.WHOP_ACCOUNT_ID;
        delete process.env.WHOP_PRODUCT_MAP;
        delete process.env.WHOP_DEFAULT_PRODUCT_ID;
        delete process.env.WHOP_AFFILIATE_CODE;
    });

    // ---- auth -----------------------------------------------------------

    it('refuses an unauthenticated caller (the account API key is behind it)', async () => {
        stubDb(WHOP_ON_ROW);
        stubWhop();
        const res = makeRes();
        await handler(makeReq({ productId: 'prod_tee_above_as_below' }), res);
        expect(res._status).toBe(401);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    // ---- the owner toggle -----------------------------------------------

    it('refuses while the promoter channel is switched off', async () => {
        stubDb(WHOP_OFF_ROW);
        stubWhop();
        const res = makeRes();
        await handler(makeReq({ productId: 'prod_tee_above_as_below' }, ADMIN_HEADERS), res);
        expect(res._status).toBe(409);
        expect(res._body.error).toMatch(/turned off/i);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    // ---- the price comes from the catalog, never the caller --------------

    it('prices the link from the products table, not from the request body', async () => {
        stubDb(WHOP_ON_ROW);
        stubWhop();
        const res = makeRes();
        await handler(makeReq({
            productId: 'prod_tee_above_as_below',
            quantity: 2,
            price: 0.01,       // a caller trying to name their own price
            initial_price: 0.01,
        }, ADMIN_HEADERS), res);

        expect(res._status).toBe(200);
        const body = whopRequestBody();
        expect(body.plan.initial_price).toBe(150);   // $75 x 2
        expect(res._body.priceCents).toBe(15000);
    });

    it('rejects a product that is not in the catalog', async () => {
        stubDb(WHOP_ON_ROW, null);
        stubWhop();
        const res = makeRes();
        await handler(makeReq({ productId: 'nope' }, ADMIN_HEADERS), res);
        expect(res._status).toBe(404);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('rejects an archived product', async () => {
        stubDb(WHOP_ON_ROW, { ...TEE, archived: true });
        stubWhop();
        const res = makeRes();
        await handler(makeReq({ productId: TEE.id }, ADMIN_HEADERS), res);
        expect(res._status).toBe(409);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    // ---- the promoter attribution ---------------------------------------

    it("carries the promoter's code as Whop's affiliate_code", async () => {
        stubDb(WHOP_ON_ROW);
        stubWhop();
        const res = makeRes();
        await handler(makeReq({
            productId: 'prod_tee_above_as_below',
            affiliateCode: 'PROMO-JAY',
        }, ADMIN_HEADERS), res);

        expect(res._status).toBe(200);
        expect(whopRequestBody().affiliate_code).toBe('PROMO-JAY');
        expect(res._body.affiliateCode).toBe('PROMO-JAY');
    });

    it('falls back to the default affiliate code when none is given', async () => {
        process.env.WHOP_AFFILIATE_CODE = 'PROMO-DEFAULT';
        stubDb(WHOP_ON_ROW);
        stubWhop();
        const res = makeRes();
        await handler(makeReq({ productId: 'prod_tee_above_as_below' }, ADMIN_HEADERS), res);
        expect(whopRequestBody().affiliate_code).toBe('PROMO-DEFAULT');
    });

    // ---- the Whop call ---------------------------------------------------

    it('calls the real endpoint and returns the shareable URL', async () => {
        stubDb(WHOP_ON_ROW);
        stubWhop();
        const res = makeRes();
        await handler(makeReq({ productId: 'prod_tee_above_as_below' }, ADMIN_HEADERS), res);

        expect(res._status).toBe(200);
        const [url, init] = mockFetch.mock.calls[0];
        expect(url).toBe('https://api.whop.com/api/v1/checkout_configurations');
        expect(init.headers.Authorization).toBe('Bearer whop_test_key');
        const body = JSON.parse(init.body);
        expect(body.mode).toBe('payment');
        expect(body.plan.product_id).toBe('prod_whop_tee');
        expect(body.plan.plan_type).toBe('one_time');
        expect(body.plan.currency).toBe('usd');
        expect(body.metadata.product_id).toBe('prod_tee_above_as_below');
        expect(res._body.whopCheckoutUrl).toBe('https://whop.com/checkout/ch_abc123');
    });

    it('surfaces a Whop API failure instead of pretending a link was made', async () => {
        stubDb(WHOP_ON_ROW);
        stubWhop(false, { error: 'plan not found' });
        const res = makeRes();
        await handler(makeReq({ productId: 'prod_tee_above_as_below' }, ADMIN_HEADERS), res);
        expect(res._status).toBe(502);
        expect(res._body.error).toMatch(/whop api error/i);
    });

    it('fails loudly when Whop returns no checkout URL', async () => {
        stubDb(WHOP_ON_ROW);
        stubWhop(true, { id: 'ch_abc123' });
        const res = makeRes();
        await handler(makeReq({ productId: 'prod_tee_above_as_below' }, ADMIN_HEADERS), res);
        expect(res._status).toBe(502);
        expect(res._body.error).toMatch(/checkout url/i);
    });

    it('refuses a product with no Whop mapping', async () => {
        stubDb(WHOP_ON_ROW);
        stubWhop();
        const res = makeRes();
        await handler(makeReq({ productId: 'prod-unmapped' }, ADMIN_HEADERS), res);
        expect(res._status).toBe(400);
        expect(res._body.error).toMatch(/no whop product/i);
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
