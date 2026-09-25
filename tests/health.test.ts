// tests/health.test.ts
//
// Unit tests for GET /api/health — the Stripe readiness probe. Covers:
//   - healthy path (valid key, payment-method flags read from the configuration)
//   - both configuration shapes Stripe has returned, current and legacy
//   - a method left "on" that the account cannot use (affirm in production)
//   - restricted-key path (configuration unreadable → empty, still healthy)
//   - expired/revoked key (503 degraded, error code surfaced, key redacted)
//   - missing key (503 degraded, configured:false)
//   - method gating (405 POST, 200 OPTIONS)
//
// The probe must stay READ-ONLY. The mocked Stripe client counts every read of
// client.paymentIntents and afterEach fails the test if the handler touched it
// at all. That is the pin for the defect this replaced: the handler created and
// cancelled a draft PaymentIntent on EVERY call — writing real objects to the
// live account from an uptime monitor's polling and every admin card load — and
// because the configuration shape it tested for never matched, it took that path
// even for a full production key.
//
// Follows the Stripe-mock conventions from tests/createPaymentIntent.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Stripe at the module boundary
// ---------------------------------------------------------------------------

const mockBalanceRetrieve = vi.fn();
const mockConfigsList = vi.fn();
// Every read of client.paymentIntents is counted here; afterEach requires 0.
let paymentIntentAccesses = 0;

vi.mock('stripe', () => ({
    default: vi.fn(function (this: any) {
        this.balance = { retrieve: mockBalanceRetrieve };
        this.paymentMethodConfigurations = { list: mockConfigsList };
        Object.defineProperty(this, 'paymentIntents', {
            get() {
                paymentIntentAccesses += 1;
                return {
                    create: () => {
                        throw new Error('health must not create a PaymentIntent');
                    },
                    cancel: () => {
                        throw new Error('health must not cancel a PaymentIntent');
                    },
                };
            },
        });
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

/** on = usable and switched on · off = usable but hidden · unavailable = the account cannot use it. */
type MethodState = 'on' | 'off' | 'unavailable';

/** Stripe's CURRENT section shape: availability plus display preference. */
function currentConfig(states: Record<string, MethodState>) {
    const config: Record<string, any> = { id: 'pmc_test', is_default: true };
    for (const [method, state] of Object.entries(states)) {
        config[method] = {
            available: state !== 'unavailable',
            display_preference: { value: state === 'on' ? 'on' : 'off' },
        };
    }
    return config;
}

/** Stripe's LEGACY section shape, still accepted. */
function legacyConfig(methods: Record<string, boolean>) {
    const config: Record<string, any> = { id: 'pmc_legacy', is_default: true };
    for (const [method, enabled] of Object.entries(methods)) {
        config[method] = { enabled };
    }
    return config;
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
        paymentIntentAccesses = 0;

        mockBalanceRetrieve.mockResolvedValue({ available: [{ amount: 100 }] });
        // The production account's real shape: card, klarna and link on.
        mockConfigsList.mockResolvedValue({
            data: [currentConfig({ card: 'on', klarna: 'on', link: 'on', afterpay_clearpay: 'off' })],
        });

        process.env.STRIPE_SECRET_KEY = 'sk_test_health_key';
        handler = await loadHandler();
    });

    afterEach(() => {
        // The pin: no path through this handler may reach the paymentIntents API.
        expect(paymentIntentAccesses, 'health must never read client.paymentIntents').toBe(0);

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
        expect(res._body.stripe.methodFlags.card).toBe(true);
        expect(res._body.stripe.methodFlags.klarna).toBe(true);
        expect(res._body.stripe.methodFlags.afterpay_clearpay).toBe(false);
        // Enabled flags become the offered method list.
        expect(res._body.stripe.paymentMethods).toEqual(expect.arrayContaining(['card', 'klarna', 'link']));
        expect(res._body.stripe.paymentMethods).not.toContain('afterpay_clearpay');
        // Checkout allow-list is reported separately + nothing missing.
        expect(res._body.stripe.checkoutMethods).toEqual(['card', 'klarna']);
        expect(res._body.stripe.checkoutMethodsMissing).toEqual([]);
    });

    it('reads the legacy { enabled } section shape too', async () => {
        mockConfigsList.mockResolvedValue({ data: [legacyConfig({ card: true, klarna: false })] });

        const req = makeReq('GET');
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.stripe.methodFlags.card).toBe(true);
        expect(res._body.stripe.methodFlags.klarna).toBe(false);
        expect(res._body.stripe.paymentMethods).toEqual(['card']);
    });

    it('excludes a method switched on but unusable by the account (affirm in production)', async () => {
        // Measured on the live account: affirm is display_preference 'on' with
        // available:false, and the method list Stripe resolves does not include it.
        mockConfigsList.mockResolvedValue({
            data: [currentConfig({ card: 'on', klarna: 'on', affirm: 'unavailable' })],
        });

        const req = makeReq('GET');
        const res = makeRes();
        await handler(req, res);

        expect(res._body.stripe.methodFlags.affirm).toBe(false);
        expect(res._body.stripe.paymentMethods).not.toContain('affirm');
    });

    it('treats an unreadable configuration as empty, not all-disabled, and stays healthy', async () => {
        // Restricted keys return configs with the method fields stripped.
        mockConfigsList.mockResolvedValue({ data: [{ id: 'pmc_rk', is_default: true }] });

        const req = makeReq('GET');
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.checkoutWorking).toBe(true);
        expect(res._body.stripe.keyValid).toBe(true);
        expect(res._body.stripe.methodFlags).toEqual({});
        expect(res._body.stripe.paymentMethods).toEqual([]);
        // Nothing is claimed missing when nothing could be read.
        expect(res._body.stripe.checkoutMethodsMissing).toEqual([]);
    });

    it('no longer writes for ?probe=1 — the draft-intent probe is gone', async () => {
        // The operator-forced probe used to create a PaymentIntent. It now
        // reports from the configuration like every other request; the
        // afterEach tripwire proves nothing reached the paymentIntents API.
        const req = makeReq('GET', { probe: '1' });
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.stripe.paymentMethods.length).toBeGreaterThan(0);
    });

    it('flags checkoutMethodsMissing when an allow-list method is disabled in the dashboard', async () => {
        // Account has card enabled but NOT klarna (code expects klarna).
        mockConfigsList.mockResolvedValue({ data: [currentConfig({ card: 'on', klarna: 'off' })] });

        const req = makeReq('GET');
        const res = makeRes();
        await handler(req, res);

        expect(res._status).toBe(200);
        expect(res._body.stripe.paymentMethods).toEqual(['card']);
        expect(res._body.stripe.checkoutMethods).toEqual(['card', 'klarna']);
        // Klarna is configured in code but disabled on the account — the
        // code-before-dashboard footgun that would fail the whole intent.
        expect(res._body.stripe.checkoutMethodsMissing).toEqual(['klarna']);
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
