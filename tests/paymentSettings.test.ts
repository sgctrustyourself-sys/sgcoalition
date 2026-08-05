// tests/paymentSettings.test.ts
//
// Handler tests for GET/PATCH /api/payment-settings — the owner-controlled
// checkout payment-option toggles (admin Command Center -> live on/off for
// Card / PayPal / Klarna / Crypto).
//
//   GET   public   -> { card_enabled, paypal_enabled, klarna_enabled, crypto_enabled }
//   PATCH admin    -> partial { <flag>_enabled: boolean }, Bearer token === ADMIN_API_TOKEN
//
// Failure semantics under test: a broken/missing DB read must return the
// all-enabled defaults so checkout can never be locked out.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock helpers — chainable Supabase query stubs (upsert/select/single/eq)
// ---------------------------------------------------------------------------

function chain(resolution: unknown) {
    const q: Record<string, any> = {};
    q.maybeSingle = vi.fn().mockResolvedValue(resolution);
    q.single = vi.fn().mockResolvedValue(resolution);
    q.select = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.in = vi.fn(() => q);
    q.upsert = vi.fn(() => q);
    q.then = vi.fn((onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(resolution).then(onFulfilled));
    return q;
}

function rejectingChain() {
    const q = chain(null);
    q.maybeSingle = vi.fn().mockRejectedValue(new Error('connection reset'));
    q.single = vi.fn().mockRejectedValue(new Error('connection reset'));
    q.then = vi.fn((onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.reject(new Error('connection reset')).then(onFulfilled, onRejected));
    return q;
}

// ---------------------------------------------------------------------------
// Mock external modules
// ---------------------------------------------------------------------------

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
        setHeader: vi.fn(),
        status: vi.fn(function (s: number) { res._status = s; return res; }),
        json: vi.fn(function (body: any) { res._body = body; return res; }),
        end: vi.fn(function () { return res; }),
    };
    return res;
}

function makeReq(method = 'GET', body: any = {}, headers: Record<string, string> = {}) {
    return { method, body, headers };
}

const DEFAULT_ROW = {
    id: 1,
    card_enabled: true,
    paypal_enabled: true,
    klarna_enabled: true,
    crypto_enabled: true,
};

async function loadHandler() {
    process.env.ADMIN_API_TOKEN = 'admin-test-token';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.NODE_ENV = 'test';
    const mod = await import('../api/_handlers/payment-settings');
    return mod.default;
}

// =========================================================================
// Tests
// =========================================================================

describe('GET/PATCH /api/payment-settings', () => {
    let handler: (req: any, res: any) => Promise<void>;

    beforeEach(async () => {
        mockSupabaseFrom.mockReset();
        handler = await loadHandler();
    });

    it('GET returns the enabled flags from the DB row', async () => {
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: { ...DEFAULT_ROW, card_enabled: false, crypto_enabled: false }, error: null }),
        );

        const res = makeRes();
        await handler(makeReq('GET'), res);

        expect(res._status).toBe(200);
        expect(res._body).toEqual({
            card_enabled: false,
            paypal_enabled: true,
            klarna_enabled: true,
            crypto_enabled: false,
        });
    });

    it('GET degrades to all-enabled when the table read returns an error', async () => {
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: null, error: new Error('relation payment_settings does not exist') }),
        );

        const res = makeRes();
        await handler(makeReq('GET'), res);

        expect(res._status).toBe(200);
        expect(res._body).toEqual({
            card_enabled: true,
            paypal_enabled: true,
            klarna_enabled: true,
            crypto_enabled: true,
        });
    });

    it('GET degrades to all-enabled when the DB read rejects (outage-safe)', async () => {
        mockSupabaseFrom.mockReturnValueOnce(rejectingChain());

        const res = makeRes();
        await handler(makeReq('GET'), res);

        expect(res._status).toBe(200);
        expect(res._body.card_enabled).toBe(true);
        expect(res._body.paypal_enabled).toBe(true);
    });

    it('PATCH requires the admin Bearer token (401 without it)', async () => {
        const res = makeRes();
        await handler(makeReq('PATCH', { klarna_enabled: false }), res);

        expect(res._status).toBe(401);
        expect(res._body.error).toBe('Admin authorization required.');
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('PATCH upserts a boolean flag with a valid admin token', async () => {
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: { ...DEFAULT_ROW, klarna_enabled: false }, error: null }),
        );

        const res = makeRes();
        await handler(
            makeReq('PATCH', { klarna_enabled: false }, { authorization: 'Bearer admin-test-token' }),
            res,
        );

        expect(res._status).toBe(200);
        expect(res._body.klarna_enabled).toBe(false);
        expect(res._body.card_enabled).toBe(true);
        // Wrote to the singleton row.
        expect(mockSupabaseFrom).toHaveBeenCalledWith('payment_settings');
        const query = mockSupabaseFrom.mock.results[0].value;
        expect(query.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ id: 1, klarna_enabled: false }),
            { onConflict: 'id' },
        );
    });

    it('PATCH supports partial updates (only the sent flag changes)', async () => {
        mockSupabaseFrom.mockReturnValueOnce(
            chain({ data: { ...DEFAULT_ROW, paypal_enabled: false }, error: null }),
        );

        const res = makeRes();
        await handler(
            makeReq('PATCH', { paypal_enabled: false }, { authorization: 'Bearer admin-test-token' }),
            res,
        );

        expect(res._status).toBe(200);
        const query = mockSupabaseFrom.mock.results[0].value;
        expect(query.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ id: 1, paypal_enabled: false }),
            { onConflict: 'id' },
        );
        expect(query.upsert.mock.calls[0][0].card_enabled).toBeUndefined();
        expect(query.upsert.mock.calls[0][0].klarna_enabled).toBeUndefined();
    });

    it('PATCH rejects non-boolean flag values', async () => {
        const res = makeRes();
        await handler(
            makeReq('PATCH', { klarna_enabled: 'yes' }, { authorization: 'Bearer admin-test-token' }),
            res,
        );

        expect(res._status).toBe(400);
        expect(res._body.error).toContain('must be a boolean');
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('PATCH rejects an empty body', async () => {
        const res = makeRes();
        await handler(
            makeReq('PATCH', {}, { authorization: 'Bearer admin-test-token' }),
            res,
        );

        expect(res._status).toBe(400);
        expect(res._body.error).toContain('At least one payment option flag');
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it('OPTIONS preflight returns 200 without auth', async () => {
        const res = makeRes();
        await handler(makeReq('OPTIONS'), res);
        expect(res._status).toBe(200);
    });

    it('returns 405 for unsupported methods', async () => {
        const res = makeRes();
        await handler(makeReq('DELETE'), res);
        expect(res._status).toBe(405);
    });
});
