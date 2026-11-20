// tests/sgcoinAdminEndpoints.test.ts
//
// GET /api/sgcoin-allocation and GET /api/sgcoin-v2-rate.
//
// These two endpoints shipped as api/admin/*.ts, where "admin auth" was a
// token LENGTH check — `token.length !== 43 && token.length !== 11` — so any
// 43-character string was accepted. The allocation endpoint reads the orders
// table with SUPABASE_SERVICE_ROLE_KEY and returns total revenue, so that was
// a financial read for anyone who guessed the path.
//
// The regression this file pins is the one a normal 401 test misses: a request
// carrying a CORRECT-LENGTH but WRONG token must still be rejected. Testing
// only "no header -> 401" would have passed against the broken version, because
// the broken version rejected absent headers too.
//
// Everything here goes through the real dispatcher (api/[...slug].ts), so it
// also proves both slugs are routed — a handler that exists but is not in the
// route table answers 404, not 401.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockOrdersResult = vi.fn();
const mockOrder = vi.fn();
const mockSelect = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: mockSelect.mockReturnValue({
                order: mockOrder.mockReturnValue(mockOrdersResult()),
            }),
        })),
    })),
}));

import dispatch from '../api/[...slug]';
import { __forceRateLimitForTests, __resetRateLimitForTests } from '../api/_helpers';
import { ADMIN_UNAUTHORIZED_ERROR } from '../api/_adminAuth';

const ADMIN_TOKEN = 'configured-admin-token-for-sgcoin-tests';

function makeRes() {
    const headers: Record<string, string> = {};
    const state: { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
    return {
        headers,
        get statusCode() { return state.statusCode; },
        get body() { return state.body; },
        setHeader(key: string, value: string) { headers[key.toLowerCase()] = value; },
        status(code: number) {
            state.statusCode = code;
            return {
                json(body: unknown) { state.body = body; },
                end() { /* no body */ },
            };
        },
    };
}

function makeReq(opts: {
    slug: string;
    method?: string;
    token?: string | null;
    ip?: string;
} = { slug: 'sgcoin-allocation' }) {
    const headers: Record<string, string> = { 'x-forwarded-for': opts.ip ?? '203.0.113.10' };
    if (opts.token !== null && opts.token !== undefined) {
        headers.authorization = `Bearer ${opts.token}`;
    }
    return {
        method: opts.method ?? 'GET',
        url: `/api/${opts.slug}`,
        headers,
        query: { slug: opts.slug },
        body: null,
    } as never;
}

/** A token of exactly the length the old length check accepted. */
const len43 = (fill = 'a') => fill.repeat(43);
const len11 = (fill = 'b') => fill.repeat(11);

beforeEach(() => {
    __forceRateLimitForTests(true);
    __resetRateLimitForTests();
    process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
    process.env.ADMIN_PASSPHRASE = '';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    // Default the rate to the documented 100 and the allocation to 1%; the
    // tests that care override them explicitly.
    delete process.env.SGCOIN_V2_PER_USD;
    delete process.env.VITE_SGCOIN_ALLOCATION_PERCENTAGE;
    mockOrdersResult.mockReset().mockReturnValue({ data: [], error: null });
    mockOrder.mockReset();
    mockSelect.mockReset();
});

afterEach(() => {
    __forceRateLimitForTests(false);
    __resetRateLimitForTests();
    for (const key of [
        'ADMIN_API_TOKEN',
        'ADMIN_PASSPHRASE',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SGCOIN_V2_PER_USD',
        'VITE_SGCOIN_ALLOCATION_PERCENTAGE',
    ]) {
        delete process.env[key];
    }
});

describe('GET /api/sgcoin-allocation is gated by the admin wrapper', () => {
    it('rejects a caller with no credential', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', token: null }), res);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: ADMIN_UNAUTHORIZED_ERROR });
        // The gate runs before the body: no service-role read happened.
        expect(mockSelect).not.toHaveBeenCalled();
    });

    it('rejects a 43-character token — the length check this endpoint used to accept', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', token: len43() }), res);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: ADMIN_UNAUTHORIZED_ERROR });
        expect(mockSelect).not.toHaveBeenCalled();
    });

    it('rejects an 11-character token — the legacy length the old check also accepted', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', token: len11() }), res);

        expect(res.statusCode).toBe(401);
        expect(mockSelect).not.toHaveBeenCalled();
    });

    it('answers preflight without a credential', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', method: 'OPTIONS', token: null }), res);

        expect(res.statusCode).toBe(200);
    });

    it('returns the allocation to the configured admin', async () => {
        mockOrdersResult.mockReturnValue({
            data: [
                { total: 10000, payment_status: 'paid' },
                { total_amount: 2500, status: 'paid' },
                { total: 500, status: 'completed' },
                { total: 999, status: 'pending' },
                { total: 123, status: 'cancelled' },
            ],
            error: null,
        });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({
            totalSales: 13000,
            totalOrders: 3,
            sgcoinAllocationCents: 130,
            allocationPercentage: 1,
        });
        expect((res.body as { note: string }).note).toContain('$130');
    });

    it('honours the configured allocation percentage', async () => {
        process.env.VITE_SGCOIN_ALLOCATION_PERCENTAGE = '2.5';
        mockOrdersResult.mockReturnValue({
            data: [{ total: 40000, payment_status: 'paid' }],
            error: null,
        });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', token: ADMIN_TOKEN }), res);

        expect(res.body).toMatchObject({ totalSales: 40000, sgcoinAllocationCents: 1000, allocationPercentage: 2.5 });
    });

    it('falls back to 1% when the configured percentage is unusable', async () => {
        // The value reaches `.toFixed(1)` in the admin UI, so NaN is not a
        // harmless answer — it is a thrown render.
        process.env.VITE_SGCOIN_ALLOCATION_PERCENTAGE = 'not-a-number';
        mockOrdersResult.mockReturnValue({ data: [{ total: 10000, status: 'paid' }], error: null });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', token: ADMIN_TOKEN }), res);

        expect(res.body).toMatchObject({ allocationPercentage: 1, sgcoinAllocationCents: 100 });
    });

    it('answers 405 for a non-GET request from an authorized caller', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', method: 'POST', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(405);
        expect(res.headers.allow).toBe('GET');
    });

    it('answers 503, not an import-time crash, when Supabase is unconfigured', async () => {
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(503);
        expect((res.body as { error: string }).error).toMatch(/not configured/i);
    });

    it('answers 500 when the orders read fails', async () => {
        mockOrdersResult.mockReturnValue({ data: null, error: { message: 'permission denied' } });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(500);
        expect((res.body as { error: string }).error).toBe('permission denied');
    });
});

describe('GET /api/sgcoin-v2-rate is gated by the admin wrapper', () => {
    it('rejects a 43-character token', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-v2-rate', token: len43() }), res);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: ADMIN_UNAUTHORIZED_ERROR });
    });

    it('rejects a caller with no credential', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-v2-rate', token: null }), res);

        expect(res.statusCode).toBe(401);
    });

    it('returns the documented default rate to the configured admin', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-v2-rate', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
            v2PerUsd: 100,
            usdPerV2: 0.01,
            note: '1 V2 = $0.01 (rate: 100 V2 per $1)',
        });
    });

    it('reads SGCOIN_V2_PER_USD per request', async () => {
        process.env.SGCOIN_V2_PER_USD = '250';

        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-v2-rate', token: ADMIN_TOKEN }), res);

        expect(res.body).toMatchObject({ v2PerUsd: 250, usdPerV2: 0.004 });
    });

    it('falls back to the default when the configured rate is zero', async () => {
        // 0 makes the reciprocal Infinity, which JSON turns into null, which
        // the admin UI calls `.toFixed()` on.
        process.env.SGCOIN_V2_PER_USD = '0';

        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-v2-rate', token: ADMIN_TOKEN }), res);

        expect(res.body).toMatchObject({ v2PerUsd: 100, usdPerV2: 0.01 });
    });

    it('does not need Supabase at all', async () => {
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        const res = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-v2-rate', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(200);
    });
});

describe('the shared limiter actually meters these reads', () => {
    // withRateLimit exempts GET by design. These slugs opt back in, because an
    // admin read that scans orders is not the cheap read that exemption assumes.
    it('429s after the per-slug budget on a GET, and stops reaching the handler', async () => {
        const LIMIT = 60; // DEFAULT_LIMIT_PER_MINUTE; neither slug has an override
        const ip = '203.0.113.99';

        for (let i = 0; i < LIMIT; i++) {
            const res = makeRes();
            await dispatch(makeReq({ slug: 'sgcoin-allocation', token: ADMIN_TOKEN, ip }), res);
            expect(res.statusCode).toBe(200);
        }
        expect(mockSelect).toHaveBeenCalledTimes(LIMIT);

        const blocked = makeRes();
        await dispatch(makeReq({ slug: 'sgcoin-allocation', token: ADMIN_TOKEN, ip }), blocked);

        expect(blocked.statusCode).toBe(429);
        expect(blocked.headers['retry-after']).toBeDefined();
        // The limiter runs before the loader: the handler never executed.
        expect(mockSelect).toHaveBeenCalledTimes(LIMIT);
    });
});

describe('the SGCoin slugs are routed, not orphaned files', () => {
    it('serves both from the catch-all route table (404 would mean unrouted)', async () => {
        for (const slug of ['sgcoin-allocation', 'sgcoin-v2-rate']) {
            const res = makeRes();
            await dispatch(makeReq({ slug, token: null }), res);
            expect(res.statusCode, `${slug} is not in api/[...slug].ts`).toBe(401);
        }
    });
});
