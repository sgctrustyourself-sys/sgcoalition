// tests/createPaymentIntent.test.ts
//
// Integration tests for /api/create-payment-intent — calls the real handler
// with mock Supabase + Stripe boundaries. Uses dynamic import() so env vars
// are set before the handler's module-level STRIPE_SECRET_KEY check fires.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock helpers — chainable Supabase query stubs
// ---------------------------------------------------------------------------

function chain(resolution: unknown) {
    const q: Record<string, any> = {};
    q.maybeSingle = vi.fn().mockResolvedValue(resolution);
    q.single = vi.fn().mockResolvedValue(resolution);
    q.select = vi.fn(() => q);
    q.in = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    // Make the chain thenable so `await sb().from('t').select().in()` works
    q.then = vi.fn((onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(resolution).then(onFulfilled));
    return q;
}

// ---------------------------------------------------------------------------
// Mock external modules
// ---------------------------------------------------------------------------

const mockSupabaseFrom = vi.fn();
const mockStripeCreate = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: mockSupabaseFrom,
    })),
}));

vi.mock('stripe', () => ({
    default: vi.fn(function (this: any) {
        this.paymentIntents = { create: mockStripeCreate };
    }),
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

function stubProduct(id: string, name: string, price: number, category = 'shirt') {
    return { id, name, price, category, archived: false, size_inventory: { M: 10 } };
}

// The payment_settings singleton row. The handler reads it first (owner
// toggles), so every test that reaches pricing must stub it before the
// product/profile chains.
const DEFAULT_SETTINGS_ROW = { id: 1, card_enabled: true, paypal_enabled: true, klarna_enabled: true, crypto_enabled: true };

function stubSettings(overrides: Partial<typeof DEFAULT_SETTINGS_ROW> = {}) {
    mockSupabaseFrom.mockReturnValueOnce(
        chain({ data: { ...DEFAULT_SETTINGS_ROW, ...overrides }, error: null }),
    );
}

async function loadHandler() {
    process.env.STRIPE_SECRET_KEY = 'sk_test_stripe';
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    const mod = await import('../api/_handlers/create-payment-intent');
    return mod.default;
}

// =========================================================================
// Tests
// =========================================================================

describe('POST /api/create-payment-intent', () => {
    let handler: (req: any, res: any) => Promise<void>;

    beforeEach(async () => {
        mockSupabaseFrom.mockReset();
        mockStripeCreate.mockReset();
        mockStripeCreate.mockResolvedValue({ client_secret: 'pi_test_secret_abc' });
        // Dynamic import ensures env vars are set before module load
        handler = await loadHandler();
    });

    // ---- Pricing correctness -------------------------------------------

    it('returns server-computed amount for single item + shipping', async () => {
        stubSettings();
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: [stubProduct('prod-1', 'Test Tee', 25)], error: null }),
        );

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.clientSecret).toBe('pi_test_secret_abc');
        expect(res._body.finalAmount).toBe(30);
        expect(res._body.creditApplied).toBe(0);
        expect(res._body.pricing.itemTotalCents).toBe(2500);
        expect(res._body.pricing.shippingCents).toBe(500);
        expect(res._body.pricing.totalCents).toBe(3000);
    });

    it('restricts the PaymentIntent to card + Klarna only (no automatic_payment_methods, no Link/CashApp/Amazon Pay)', async () => {
        stubSettings();
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: [stubProduct('prod-1', 'Test Tee', 25)], error: null }),
        );

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(mockStripeCreate).toHaveBeenCalledTimes(1);
        const intentPayload = mockStripeCreate.mock.calls[0][0];
        // Explicit allow-list — the PaymentElement renders exactly these.
        expect(intentPayload.payment_method_types).toEqual(['card', 'klarna']);
        // automatic_payment_methods must NOT be present (mutually exclusive
        // with payment_method_types; without this guard the dashboard-enabled
        // Link/Cash App/Amazon Pay would leak back into checkout).
        expect(intentPayload.automatic_payment_methods).toBeUndefined();
        expect(intentPayload.amount).toBe(3000);
    });

    it('honors a client-requested card-only intent (primary checkout path)', async () => {
        stubSettings();
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: [stubProduct('prod-1', 'Test Tee', 25)], error: null }),
        );

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
            paymentMethodTypes: ['card'],
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(mockStripeCreate.mock.calls[0][0].payment_method_types).toEqual(['card']);
    });

    it("honors a client-requested Klarna-only intent (secondary 'More payment options' path)", async () => {
        stubSettings();
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: [stubProduct('prod-1', 'Test Tee', 25)], error: null }),
        );

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
            paymentMethodTypes: ['klarna'],
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(mockStripeCreate.mock.calls[0][0].payment_method_types).toEqual(['klarna']);
    });

    it('rejects paymentMethodTypes outside the checkout allow-list (never silently expands)', async () => {
        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
            paymentMethodTypes: ['card', 'link'], // link is hidden on purpose
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(400);
        expect(res._body.error).toBe('Invalid payment method types.');
        expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('rejects an empty paymentMethodTypes array', async () => {
        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
            paymentMethodTypes: [],
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(400);
        expect(res._body.error).toBe('Invalid payment method types.');
        expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('applies Above-as-Below set bonus for tee + shorts combo', async () => {
        stubSettings();
        mockSupabaseFrom.mockReturnValueOnce(
            chain({
                data: [
                    stubProduct('prod_tee_above_as_below', 'Above as Below Tee', 25),
                    stubProduct('prod_shorts_above_as_below', 'Above as Below Shorts', 25),
                ],
                error: null,
            }),
        );

        const req = makeReq('POST', {
            items: [
                { productId: 'prod_tee_above_as_below', selectedSize: 'M', quantity: 1 },
                { productId: 'prod_shorts_above_as_below', selectedSize: 'L', quantity: 1 },
            ],
            shippingCost: 5,
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        // itemTotal: 2500+2500=5000, shipping: 500, setBonus: 3000
        // total = 5000+500-3000 = 2500 ($25)
        expect(res._body.pricing.itemTotalCents).toBe(5000);
        expect(res._body.pricing.shippingCents).toBe(500);
        expect(res._body.pricing.discountCents).toBe(3000);
        expect(res._body.pricing.totalCents).toBe(2500);
        expect(res._body.finalAmount).toBe(25);
        expect(mockStripeCreate).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 2500 }),
        );
    });

    // ---- Store credit deduction ----------------------------------------

    it('deducts store credit and returns creditApplied + reduced amount', async () => {
        stubSettings();
        // profiles lookup second (store credit)
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: { store_credit: 10 }, error: null }),
        );
        // products lookup second (resolvePricing)
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: [stubProduct('prod-1', 'Test Tee', 25)], error: null }),
        );

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
            userId: 'user-1',
            useStoreCredit: true,
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        // itemTotal: 2500, shipping: 500, storeCredit: 1000
        // total = 2500+500-1000 = 2000 ($20)
        expect(res._body.pricing.totalCents).toBe(2000);
        expect(res._body.pricing.storeCreditCents).toBe(1000);
        expect(res._body.creditApplied).toBe(10);
        expect(res._body.finalAmount).toBe(20);
        expect(mockStripeCreate).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 2000 }),
        );
    });

    it('returns zeroAmount:true when store credit covers entire order', async () => {
        stubSettings();
        // profiles lookup: $35 credit
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: { store_credit: 35 }, error: null }),
        );
        // products lookup
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: [stubProduct('prod-1', 'Test Tee', 25)], error: null }),
        );

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
            userId: 'user-1',
            useStoreCredit: true,
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.zeroAmount).toBe(true);
        expect(res._body.clientSecret).toBeNull();
        // $35 credit but only $30 pre-credit total — capped to 3000
        expect(res._body.pricing.storeCreditCents).toBe(3000);
        expect(res._body.pricing.totalCents).toBe(0);
        expect(res._body.creditApplied).toBe(30);
    });

    // ---- Error paths ---------------------------------------------------

    it('returns 400 for empty items array', async () => {
        const req = makeReq('POST', { items: [], shippingCost: 0 });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(400);
        expect(res._body.error).toBe('At least one item required.');
    });

    it('returns 405 for GET method', async () => {
        const req = makeReq('GET');
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(405);
        expect(res._body.error).toBe('Method not allowed');
    });

    it('returns 200 for OPTIONS preflight', async () => {
        const req = makeReq('OPTIONS');
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
    });

    // ---- Pricing error propagation -------------------------------------

    it('returns 409 when product is not found in DB', async () => {
        stubSettings();
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: [], error: null }),
        );

        const req = makeReq('POST', {
            items: [{ productId: 'prod-missing', selectedSize: 'M', quantity: 1 }],
            shippingCost: 0,
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(409);
        expect(res._body.error).toContain('Unavailable');
    });

    // ---- Without store credit ------------------------------------------

    it('ignores store credit when userId is missing', async () => {
        stubSettings();
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: [stubProduct('prod-1', 'Test Tee', 25)], error: null }),
        );

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
            useStoreCredit: true,
            // no userId
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.creditApplied).toBe(0);
        expect(res._body.pricing.storeCreditCents).toBe(0);
        // Two .from() calls — payment_settings + products (no profiles)
        expect(mockSupabaseFrom).toHaveBeenCalledTimes(2);
    });

    it('does not query profiles when useStoreCredit is false', async () => {
        stubSettings();
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: [stubProduct('prod-1', 'Test Tee', 25)], error: null }),
        );

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 0,
            userId: 'user-1',
            useStoreCredit: false,
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.creditApplied).toBe(0);
        expect(res._body.pricing.storeCreditCents).toBe(0);
        // Two .from() calls — payment_settings + products
        expect(mockSupabaseFrom).toHaveBeenCalledTimes(2);
    });

    // ---- Owner-controlled visibility (payment_settings toggles) --------

    it('default allow-list silently filters out an owner-disabled method (klarna off -> card only)', async () => {
        stubSettings({ klarna_enabled: false });
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: [stubProduct('prod-1', 'Test Tee', 25)], error: null }),
        );

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
            // no paymentMethodTypes -> default allow-list ['card','klarna']
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        // Klarna was filtered out before the intent was created.
        expect(mockStripeCreate.mock.calls[0][0].payment_method_types).toEqual(['card']);
    });

    it('rejects a client-requested method the owner disabled (klarna off)', async () => {
        stubSettings({ klarna_enabled: false });

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
            paymentMethodTypes: ['klarna'],
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(409);
        expect(res._body.error).toContain('currently unavailable');
        expect(mockStripeCreate).not.toHaveBeenCalled();
    });

    it('returns 409 when the owner disabled every Stripe method', async () => {
        stubSettings({ card_enabled: false, klarna_enabled: false });

        const req = makeReq('POST', {
            items: [{ productId: 'prod-1', selectedSize: 'M', quantity: 1 }],
            shippingCost: 5,
        });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(409);
        expect(res._body.error).toContain('No payment options are currently available');
        expect(mockStripeCreate).not.toHaveBeenCalled();
    });
});
