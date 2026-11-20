// tests/apiRateLimitWiring.test.ts
//
// withRateLimit is unit-tested in securityInfrastructureReadiness, but those
// tests call the helper directly. This suite goes through the real dispatcher
// (api/[...slug].ts) so it proves the limiter gates live requests: once a
// caller is over budget, the 429 is returned and the handler never runs.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const healthHandler = vi.hoisted(() => vi.fn((_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ ok: true });
}));

vi.mock('../api/_handlers/health.js', () => ({ default: healthHandler }));

import dispatch from '../api/[...slug]';
import { __forceRateLimitForTests, __resetRateLimitForTests } from '../api/_helpers';

function makeRes() {
    const headers: Record<string, string> = {};
    const state: { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
    return {
        headers,
        get statusCode() { return state.statusCode; },
        get body() { return state.body; },
        setHeader(key: string, value: string) { headers[key] = value; },
        status(code: number) {
            state.statusCode = code;
            return {
                json(body: unknown) { state.body = body; },
                end() { /* no body */ },
            };
        },
    };
}

function makeReq(ip: string) {
    return {
        method: 'POST',
        url: '/api/health',
        headers: { 'x-forwarded-for': ip },
        query: { slug: 'health' },
        body: {},
    } as never;
}

beforeEach(() => {
    __forceRateLimitForTests(true);
    __resetRateLimitForTests();
    healthHandler.mockClear();
});

afterEach(() => {
    __forceRateLimitForTests(false);
    __resetRateLimitForTests();
});

describe('api dispatcher enforces the per-slug rate limit', () => {
    it('lets requests through up to the budget, then 429s without calling the handler', async () => {
        const LIMIT = 60; // DEFAULT_LIMIT_PER_MINUTE; 'health' has no override
        const ip = '203.0.113.50';

        for (let i = 0; i < LIMIT; i++) {
            const res = makeRes();
            await dispatch(makeReq(ip), res);
            expect(res.statusCode).toBe(200);
        }
        expect(healthHandler).toHaveBeenCalledTimes(LIMIT);

        const blocked = makeRes();
        await dispatch(makeReq(ip), blocked);
        expect(blocked.statusCode).toBe(429);
        expect(blocked.headers['Retry-After']).toBeDefined();
        // The handler must not run for the blocked request.
        expect(healthHandler).toHaveBeenCalledTimes(LIMIT);
    });

    it('keeps a separate budget per caller IP', async () => {
        for (let i = 0; i < 60; i++) {
            await dispatch(makeReq('198.51.100.1'), makeRes());
        }
        const other = makeRes();
        await dispatch(makeReq('198.51.100.2'), other);
        expect(other.statusCode).toBe(200);
    });
});
