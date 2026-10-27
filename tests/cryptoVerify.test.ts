// tests/cryptoVerify.test.ts
//
// Handler tests for POST/GET /api/crypto-verify — the server side of
// direct-USDC checkout verification. Supabase is stubbed per-table with
// queued resolutions; the chain is a stubbed global fetch (no network).
// The pure match rule itself is covered in tests/cryptoWatcher.test.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FOUNDER_WALLET_FALLBACK, NATIVE_USDC_POLYGON } from '../services/cryptoWatcher';

const mockSupabaseFrom = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        from: mockSupabaseFrom,
    })),
}));

const ORDER_ID = 'order_test_1';
const TX_HASH = '0x' + 'cd'.repeat(32);
const NOW_SECS = String(Math.floor(Date.now() / 1000));

function cryptoOrder(overrides: Record<string, unknown> = {}) {
    return {
        id: ORDER_ID,
        order_number: 'ORD-TEST-1',
        payment_method: 'crypto',
        payment_status: 'pending',
        total: 45.5,
        // Created a minute ago: the stubbed chain transfer (stamped at
        // module load) must fall inside the payment window.
        created_at: new Date(Date.now() - 60_000).toISOString(),
        notes: '',
        payment_reference: null,
        ...overrides,
    };
}

// Per-table resolution queues: from('orders') shifts the next orders entry,
// from('payment_settings') the next settings entry. Each query object is
// thenable so `await update(...).eq(...)` resolves the queued outcome.
/** The chainable Supabase stub: each link a mock, plus a thenable leaf. */
type StubQuery = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
};

function mockDb(routes: Record<string, Array<{ data: unknown; error: unknown }>>) {
    const queues: Record<string, Array<{ data: unknown; error: unknown }>> = {};
    for (const [table, arr] of Object.entries(routes)) queues[table] = [...arr];
    mockSupabaseFrom.mockImplementation((table: string) => {
        const next = (queues[table] || []).shift() || { data: null, error: null };
        const q = {} as StubQuery;
        q.select = vi.fn(() => q);
        q.eq = vi.fn(() => q);
        q.limit = vi.fn(() => q);
        q.update = vi.fn(() => q);
        q.maybeSingle = vi.fn(async () => next);
        q.single = vi.fn(async () => next);
        q.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(next).then(onFulfilled);
        return q;
    });
}

function chainResult(valueBaseUnits: string) {
    return {
        status: '1',
        message: 'OK',
        result: [{
            hash: TX_HASH,
            from: '0x2222222222222222222222222222222222222222',
            // Lowercase on purpose: matching is case-insensitive.
            to: FOUNDER_WALLET_FALLBACK.toLowerCase(),
            contractAddress: NATIVE_USDC_POLYGON,
            value: valueBaseUnits,
            timeStamp: NOW_SECS,
            blockNumber: '70000000',
        }],
    };
}

function stubFetch(payload: unknown) {
    const fetchFn = vi.fn(async () => ({ ok: true, json: async () => payload }) as unknown as Response);
    vi.stubGlobal('fetch', fetchFn);
    return fetchFn;
}

function makeRes() {
    const res: Record<string, any> = {
        _status: 200,
        _body: null,
        setHeader: vi.fn(),
        status: vi.fn(function (s: number) { res._status = s; return res; }),
        json: vi.fn(function (body: unknown) { res._body = body; return res; }),
        end: vi.fn(function () { return res; }),
    };
    return res;
}

const ok = (data: unknown) => ({ data, error: null });

async function loadHandler() {
    process.env.ADMIN_API_TOKEN = 'admin-test-token';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    process.env.POLYGONSCAN_API_KEY = 'test-explorer-key';
    delete process.env.ETHERSCAN_API_KEY;
    delete process.env.VITE_POLYGONSCAN_API_KEY;
    process.env.NODE_ENV = 'test';
    const mod = await import('../api/_handlers/crypto-verify');
    return mod.default;
}

describe('POST /api/crypto-verify', () => {
    let handler: Awaited<ReturnType<typeof loadHandler>>;

    beforeEach(async () => {
        mockSupabaseFrom.mockReset();
        vi.unstubAllGlobals();
        handler = await loadHandler();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function postBody() {
        return { orderRef: ORDER_ID, txHash: TX_HASH };
    }

    it('confirms a matching transfer and flips the order to paid', async () => {
        mockDb({
            orders: [ok(cryptoOrder()), { data: [], error: null }, ok({ data: null, error: null })],
            payment_settings: [ok({ id: 1 })],
        });
        stubFetch(chainResult('45500000'));

        const res = makeRes();
        await handler({ method: 'POST', body: postBody(), query: {}, headers: {} }, res);

        expect(res._status).toBe(200);
        expect(res._body.status).toBe('confirmed');
        expect(res._body.receivedUsdc).toBe('45.500000');
        // The confirm write flips status + stamps the hash.
        const updateCall = mockSupabaseFrom.mock.results
            .map(r => r.value.update)
            .find((u: any) => u.mock.calls.length > 0);
        const written = updateCall.mock.calls[0][0];
        expect(written.payment_status).toBe('paid');
        expect(written.payment_reference).toBe(TX_HASH);
        expect(written.paid_at).toBeTruthy();
    });

    it('reports underpaid without flipping to paid', async () => {
        mockDb({
            orders: [ok(cryptoOrder()), { data: [], error: null }, ok({ data: null, error: null })],
            payment_settings: [ok({ id: 1 })],
        });
        stubFetch(chainResult('45499999'));

        const res = makeRes();
        await handler({ method: 'POST', body: postBody(), query: {}, headers: {} }, res);

        expect(res._status).toBe(200);
        expect(res._body.status).toBe('underpaid');
        expect(res._body.receivedUsdc).toBe('45.499999');
        const updateCall = mockSupabaseFrom.mock.results
            .map(r => r.value.update)
            .find((u: any) => u.mock.calls.length > 0);
        const written = updateCall.mock.calls[0][0];
        expect(written.payment_status).toBeUndefined();
        expect(written.payment_reference).toBeUndefined();
        expect(String(written.notes)).toContain('underpaid');
    });

    it('answers 202 awaiting when the hash is not among recent receipts', async () => {
        mockDb({
            orders: [ok(cryptoOrder()), { data: [], error: null }, ok({ data: null, error: null })],
            payment_settings: [ok({ id: 1 })],
        });
        stubFetch({ status: '1', message: 'OK', result: [] });

        const res = makeRes();
        await handler({ method: 'POST', body: postBody(), query: {}, headers: {} }, res);

        expect(res._status).toBe(202);
        expect(res._body.status).toBe('awaiting');
    });

    it('rejects a hash already recorded on another order (409)', async () => {
        mockDb({
            orders: [ok(cryptoOrder()), { data: [{ id: 'order_other' }], error: null }],
            payment_settings: [ok({ id: 1 })],
        });
        const fetchFn = stubFetch(chainResult('45500000'));

        const res = makeRes();
        await handler({ method: 'POST', body: postBody(), query: {}, headers: {} }, res);

        expect(res._status).toBe(409);
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('is idempotent: an already-paid order confirms without a chain call', async () => {
        mockDb({ orders: [ok(cryptoOrder({ payment_status: 'paid' }))], payment_settings: [] });
        const fetchFn = stubFetch(chainResult('45500000'));

        const res = makeRes();
        await handler({ method: 'POST', body: postBody(), query: {}, headers: {} }, res);

        expect(res._status).toBe(200);
        expect(res._body.status).toBe('confirmed');
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('rejects non-crypto orders (409) — Stripe paths never enter here', async () => {
        mockDb({ orders: [ok(cryptoOrder({ payment_method: 'stripe' }))], payment_settings: [] });

        const res = makeRes();
        await handler({ method: 'POST', body: postBody(), query: {}, headers: {} }, res);

        expect(res._status).toBe(409);
    });

    it('rejects a malformed hash (400) before touching the DB or chain', async () => {
        const fetchFn = stubFetch(chainResult('45500000'));

        const res = makeRes();
        await handler({ method: 'POST', body: { orderRef: ORDER_ID, txHash: '0x123' }, query: {}, headers: {} }, res);

        expect(res._status).toBe(400);
        expect(mockSupabaseFrom).not.toHaveBeenCalled();
        expect(fetchFn).not.toHaveBeenCalled();
    });

    it('fails closed without an explorer key (503, manual flow covers it)', async () => {
        delete process.env.POLYGONSCAN_API_KEY;
        mockDb({
            orders: [ok(cryptoOrder()), { data: [], error: null }],
            payment_settings: [ok({ id: 1 })],
        });
        const fetchFn = stubFetch(chainResult('45500000'));

        const res = makeRes();
        await handler({ method: 'POST', body: postBody(), query: {}, headers: {} }, res);

        expect(res._status).toBe(503);
        expect(fetchFn).not.toHaveBeenCalled();
        process.env.POLYGONSCAN_API_KEY = 'test-explorer-key';
    });

    it('falls back to notes markers when the crypto_* columns are absent', async () => {
        const columnError = { data: null, error: { code: '42703', message: 'column \"crypto_status\" of relation \"orders\" does not exist' } };
        mockDb({
            orders: [ok(cryptoOrder()), { data: [], error: null }, columnError, ok({ data: null, error: null })],
            payment_settings: [ok({ id: 1 })],
        });
        stubFetch(chainResult('45500000'));

        const res = makeRes();
        await handler({ method: 'POST', body: postBody(), query: {}, headers: {} }, res);

        expect(res._status).toBe(200);
        expect(res._body.status).toBe('confirmed');
        // Two order updates: full (failed on columns) then base markers.
        const updateCalls = mockSupabaseFrom.mock.results
            .map(r => r.value.update)
            .filter((u: any) => u.mock.calls.length > 0);
        expect(updateCalls.length).toBe(2);
        expect(updateCalls[1].mock.calls[0][0].payment_status).toBe('paid');
        expect(updateCalls[1].mock.calls[0][0].crypto_status).toBeUndefined();
    });
});

describe('GET /api/crypto-verify', () => {
    let handler: Awaited<ReturnType<typeof loadHandler>>;

    beforeEach(async () => {
        mockSupabaseFrom.mockReset();
        handler = await loadHandler();
    });

    it('derives the read-only status without writing', async () => {
        mockDb({
            orders: [ok(cryptoOrder({ payment_reference: TX_HASH }))],
            payment_settings: [ok({ id: 1 })],
        });

        const res = makeRes();
        await handler({ method: 'GET', query: { orderRef: ORDER_ID }, headers: {} }, res);

        expect(res._status).toBe(200);
        expect(res._body.status).toBe('submitted');
        expect(res._body.txHash).toBe(TX_HASH);
        expect(res._body.expectedUsdc).toBe('45.50');
        const wrote = mockSupabaseFrom.mock.results.some(r => r.value.update.mock.calls.length > 0);
        expect(wrote).toBe(false);
    });
});
