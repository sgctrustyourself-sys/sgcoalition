// tests/health.test.ts
//
// Unit tests for GET /api/health — the Stripe readiness probe. Covers:
//   - healthy path (valid key, payment methods enumerated)
//   - restricted-key fallback (configs stripped → draft-intent probe)
//   - expired/revoked key (503 degraded, error code surfaced)
//   - missing key (503 degraded, configured:false)
//   - method gating (405 POST, 200 OPTIONS)
//
// Follows the Stripe-mock conventions from tests/createPaymentIntent.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Stripe at the module boundary
// ---------------------------------------------------------------------------

const mockBalanceRetrieve = vi.fn();
const mockConfigsList = vi.fn();
const mockIntentCreate = vi.fn();
const mockIntentCancel = vi.fn();

vi.mock('stripe', () => ({
    default: vi.fn(function (this: any) {
        this.balance = { retrieve: mockBalanceRetrieve };
        this.paymentMethodConfigurations = { list: mockConfigsList };
        this.paymentIntents = { create: mockIntentCreate, cancel: mockIntentCancel };
    }),
}));

// ---------------------------------------------------------------------------
// Request/response harness (same shape as createPaymentIntent.test.ts)
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

function makeReq(method = 'GET', query: any = {}) {
    return { method, query };
}

function configWith(methods: Partial<Record<string, { enabled: boolean }>>) {
    return {
        id: 'pmc_test',
        is_default: true,
        card: { enabled: true },
        klarna: { enabled: false },
        ...methods,
    };
}

async function loadHandler() {
    const mod = await import('../api/_handlers/health');
    return mod.default;
}

// =========================================================================
// Tests
// =========================================================================

describe('GET /api/health', () => {
    let handler: (req: any, res: any) => Promise<void>;
    const originalKey = process.env.STRIPE_SECRET_KEY;

    beforeEach(async () => {
        mockBalanceRetrieve.mockReset();
        mockConfigsList.mockReset();
        mockIntentCreate.mockReset();
        mockIntentCancel.mockReset();

        mockBalanceRetrieve.mockResolvedValue({ available: [{ amount: 100 }] });
        // Default: a full (non-restricted) key — configs expose enabled flags.
        mockConfigsList.mockResolvedValue({
            data: [
                configWith({ klarna: { enabled: true }, afterpay_clearpay: { enabled: false } }),
            ],
        });
        mockIntentCreate.mockResolvedValue({
            id: 'pi_probe_1',
            payment_method_types: ['card', 'klarna'],
        });
        mockIntentCancel.mockResolvedValue({ status: 'canceled' });

        process.env.STRIPE_SECRET_KEY = 'sk_test_health_key';
        handler = await loadHandler();
    });

    afterEach(() => {
        if (originalKey === undefined) {
            delete process.env.STRIPE_SECRET_KEY;
        } else {
            process.env.STRIPE_SECRET_KEY = originalKey;
        }
    });

    it('returns 200 ok with keyValid and method flags from configurations', async () => {
        const req = makeReq('GET');
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.status).toBe('ok');
        expect(res._body.checkoutWorking).toBe(true);
        expect(res._body.stripe.configured).toBe(true);
        expect(res._body.stripe.keyValid).toBe(true);
        expect(res._body.stripe.error).toBeNull();
        // Flags were readable → no draft-intent probe needed.
        expect(res._body.stripe.methodFlags.card).toBe(true);
        expect(res._body.stripe.methodFlags.klarna).toBe(true);
        expect(res._body.stripe.methodFlags.afterpay_clearpay).toBe(false);
        expect(mockIntentCreate).not.toHaveBeenCalled();
        // Enabled flags become the offered method list.
        expect(res._body.stripe.paymentMethods).toContain('card');
        expect(res._body.stripe.paymentMethods).toContain('klarna');
        expect(res._body.stripe.paymentMethods).not.toContain('afterpay_clearpay');
    });

    it('falls back to a draft-intent probe when config flags are stripped (restricted key)', async () => {
        // Restricted keys return configs without the enabled fields.
        mockConfigsList.mockResolvedValue({ data: [{ id: 'pmc_rk', is_default: true }] });

        const req = makeReq('GET');
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(mockIntentCreate).toHaveBeenCalledTimes(1);
        expect(mockIntentCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                amount: 500,
                automatic_payment_methods: { enabled: true },
            }),
        );
        expect(mockIntentCancel).toHaveBeenCalledWith('pi_probe_1');
        expect(res._body.stripe.paymentMethods).toEqual(['card', 'klarna']);
        expect(res._body.stripe.error).toBeNull();
    });

    it('returns 503 degraded when the key is expired/revoked, without leaking the key', async () => {
        // Use Stripe's real-world masked form (asterisks) for the secret.
        mockBalanceRetrieve.mockRejectedValue(
            Object.assign(new Error('Expired API Key provided: sk_live_****abcd1234'), {
                code: 'api_key_expired',
                type: 'StripeAuthenticationError',
            }),
        );

        const req = makeReq('GET');
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(503);
        expect(res._body.status).toBe('degraded');
        expect(res._body.checkoutWorking).toBe(false);
        expect(res._body.stripe.keyValid).toBe(false);
        expect(res._body.stripe.error).toContain('api_key_expired');
        // The key-shaped token must be redacted — masked (sk_live_****) and
        // restricted (rk_live_) forms alike.
        expect(res._body.stripe.error).not.toMatch(/[sr]k_live_[A-Za-z0-9*]+/);
        // No method enumeration attempted on a dead key.
        expect(mockConfigsList).not.toHaveBeenCalled();
        expect(mockIntentCreate).not.toHaveBeenCalled();
    });

    it('returns 503 configured:false when STRIPE_SECRET_KEY is missing', async () => {
        delete process.env.STRIPE_SECRET_KEY;

        const req = makeReq('GET');
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(503);
        expect(res._body.status).toBe('degraded');
        expect(res._body.stripe.configured).toBe(false);
        expect(res._body.stripe.keyValid).toBe(false);
        expect(mockBalanceRetrieve).not.toHaveBeenCalled();
    });

    it('returns 503 degraded when a REQUIRED probe fails (checkout would break)', async () => {
        // Configs stripped (restricted key) AND intent creation is denied —
        // this is exactly the silent checkout outage the endpoint must catch.
        mockConfigsList.mockResolvedValue({ data: [{ id: 'pmc_rk', is_default: true }] });
        mockIntentCreate.mockRejectedValue(
            Object.assign(new Error('Permission denied'), { code: 'permission_required' }),
        );

        const req = makeReq('GET');
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(503);
        expect(res._body.status).toBe('degraded');
        expect(res._body.checkoutWorking).toBe(false);
        expect(res._body.stripe.keyValid).toBe(true); // key itself is fine
        expect(res._body.stripe.error).toContain('permission_required');
        expect(res._body.stripe.paymentMethods).toEqual([]);
    });

    it('keeps 200 ok when a FORCED probe fails but flags are readable', async () => {
        // Full key (flags readable) + ?probe=1 + probe denied: the operator
        // forced the diagnostic, but configs prove the account is healthy.
        mockIntentCreate.mockRejectedValue(
            Object.assign(new Error('Permission denied'), { code: 'permission_required' }),
        );

        const req = makeReq('GET', { probe: '1' });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.checkoutWorking).toBe(true);
        expect(res._body.stripe.keyValid).toBe(true);
        expect(res._body.stripe.error).toContain('permission_required');
    });

    it('forcibly runs the probe with ?probe=1 even when config flags are readable', async () => {
        const req = makeReq('GET', { probe: '1' });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(mockIntentCreate).toHaveBeenCalledTimes(1);
    });

    it('returns 405 for POST and 200 for OPTIONS preflight', async () => {
        const post = makeReq('POST');
        const resPost = makeRes();
        await handler(post, resPost);
        expect(resPost._status).toBe(405);
        expect(resPost._body.error).toBe('Method not allowed');

        const preflight = makeReq('OPTIONS');
        const resOptions = makeRes();
        await handler(preflight, resOptions);
        expect(resOptions._status).toBe(200);
    });
});
