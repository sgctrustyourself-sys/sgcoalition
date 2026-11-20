// tests/sgcoinGrant.test.ts
//
// The two endpoints behind the admin SGCoin Distribution tab:
//
//   GET  /api/admin-sgcoin-members  — the member roster the picker reads
//   POST /api/admin-sgcoin-grant    — the write that mints SGCoin
//
// Both are money-adjacent, so they are driven through the real dispatcher
// (api/[...slug].ts) rather than called directly: that is the only way to prove
// the slugs are routed, the admin gate runs first, and a correct-length-but-wrong
// token is rejected. The old implementation would have passed a "no header"
// test; it accepted any 43-character string.
//
// The grant's database half is one RPC — this suite asserts the handler calls it
// with the validated inputs and maps its errors, and pins the migration's
// privilege lockdown (service_role only, RLS on, anon revoked).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const db = vi.hoisted(() => ({
    rpc: vi.fn(),
    from: vi.fn(),
    select: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    in: vi.fn(),
}));

// A tiny PostgREST chain: select() offers the two terminals these handlers use
// — order().limit() for a page, and in() for the label lookup.
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        from: (table: string) => {
            db.from(table);
            return {
                select: (columns: string) => {
                    db.select(table, columns);
                    return {
                        order: (column: string, options: unknown) => {
                            db.order(table, column, options);
                            return { limit: (count: number) => db.limit(table, count) };
                        },
                        in: (column: string, values: unknown) => db.in(table, column, values),
                    };
                },
            };
        },
        rpc: (name: string, args: unknown) => db.rpc(name, args),
    }),
}));

import dispatch from '../api/[...slug]';
import { __forceRateLimitForTests, __resetRateLimitForTests } from '../api/_helpers';
import { ADMIN_UNAUTHORIZED_ERROR } from '../api/_adminAuth';

const ADMIN_TOKEN = 'configured-admin-token-for-sgcoin-grant-tests';
const MEMBER_ID = '3f8a1c2e-4b5d-6e7f-8a9b-0c1d2e3f4a5b';

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
    body?: unknown;
    ip?: string;
}) {
    const headers: Record<string, string> = { 'x-forwarded-for': opts.ip ?? '203.0.113.20' };
    if (opts.token !== null && opts.token !== undefined) {
        headers.authorization = `Bearer ${opts.token}`;
    }
    return {
        method: opts.method ?? 'GET',
        url: `/api/${opts.slug}`,
        headers,
        query: { slug: opts.slug },
        body: opts.body ?? null,
    } as never;
}

const len43 = () => 'a'.repeat(43);

beforeEach(() => {
    __forceRateLimitForTests(true);
    __resetRateLimitForTests();
    process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
    process.env.ADMIN_PASSPHRASE = '';
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    db.rpc.mockReset();
    db.from.mockReset();
    db.select.mockReset();
    db.order.mockReset();
    db.limit.mockReset();
    db.in.mockReset();
    db.limit.mockResolvedValue({ data: [], error: null });
    db.in.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
    __forceRateLimitForTests(false);
    __resetRateLimitForTests();
    for (const key of [
        'ADMIN_API_TOKEN',
        'ADMIN_PASSPHRASE',
        'SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
    ]) {
        delete process.env[key];
    }
});

describe('GET /api/admin-sgcoin-members', () => {
    it('rejects a correct-length token — the shape the old auth accepted', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-members', token: len43() }), res);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: ADMIN_UNAUTHORIZED_ERROR });
        expect(db.select).not.toHaveBeenCalled();
    });

    it('rejects a caller with no credential', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-members', token: null }), res);

        expect(res.statusCode).toBe(401);
        expect(db.select).not.toHaveBeenCalled();
    });

    it('returns the roster, mapping profiles columns to the picker shape', async () => {
        db.limit.mockResolvedValue({
            data: [
                { id: MEMBER_ID, full_name: 'Derron Byrd', email: 'd@example.com', sg_coin_balance: '1250' },
                { id: '11111111-2222-3333-4444-555555555555', full_name: null, email: null, sg_coin_balance: null },
            ],
            error: null,
        });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-members', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({
            members: [
                { userId: MEMBER_ID, name: 'Derron Byrd', email: 'd@example.com', sgCoinBalance: 1250 },
                { userId: '11111111-2222-3333-4444-555555555555', name: null, email: null, sgCoinBalance: 0 },
            ],
        });
        // Named columns only — profiles carries operator-only fields.
        expect(db.select).toHaveBeenCalledWith('profiles', 'id, full_name, email, sg_coin_balance');
    });

    it('answers 503 when Supabase is unconfigured', async () => {
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;

        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-members', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(503);
    });

    it('surfaces a query failure as 500', async () => {
        db.limit.mockResolvedValue({ data: null, error: { message: 'permission denied' } });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-members', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(500);
        expect((res.body as { error: string }).error).toBe('permission denied');
    });
});

describe('POST /api/admin-sgcoin-grant', () => {
    const grantReq = (body: unknown, token: string | null = ADMIN_TOKEN) =>
        makeReq({ slug: 'admin-sgcoin-grant', method: 'POST', token, body });

    it('rejects a 43-character token', async () => {
        const res = makeRes();
        await dispatch(grantReq({ userId: MEMBER_ID, amount: 500 }, len43()), res);

        expect(res.statusCode).toBe(401);
        expect(db.rpc).not.toHaveBeenCalled();
    });

    it('calls the RPC with the validated inputs and returns the committed balance', async () => {
        db.rpc.mockResolvedValue({
            data: [{ grant_id: 'grant-1', balance: '1750' }],
            error: null,
        });

        const res = makeRes();
        await dispatch(grantReq({ userId: MEMBER_ID, amount: 500, note: ' launch bonus ' }, ADMIN_TOKEN), res);

        expect(res.statusCode).toBe(200);
        expect(db.rpc).toHaveBeenCalledWith('grant_sgcoin', {
            p_user_id: MEMBER_ID,
            p_amount: 500,
            p_note: 'launch bonus',
        });
        expect(res.body).toEqual({
            userId: MEMBER_ID,
            amount: 500,
            grantId: 'grant-1',
            balanceAfter: 1750,
        });
    });

    it('passes an empty note as null rather than an empty string', async () => {
        db.rpc.mockResolvedValue({ data: [{ grant_id: 'g', balance: 10 }], error: null });

        await dispatch(grantReq({ userId: MEMBER_ID, amount: 10, note: '   ' }, ADMIN_TOKEN), makeRes());

        expect(db.rpc).toHaveBeenCalledWith('grant_sgcoin', {
            p_user_id: MEMBER_ID,
            p_amount: 10,
            p_note: null,
        });
    });

    it.each([
        ['a non-UUID member', { userId: 'not-a-uuid', amount: 10 }],
        ['a zero amount', { userId: MEMBER_ID, amount: 0 }],
        ['a fractional amount', { userId: MEMBER_ID, amount: 1.5 }],
        ['a non-numeric amount', { userId: MEMBER_ID, amount: '10abc' }],
        ['an oversized amount', { userId: MEMBER_ID, amount: 1_000_000_001 }],
        ['an over-long note', { userId: MEMBER_ID, amount: 10, note: 'x'.repeat(281) }],
    ])('rejects %s without touching the RPC', async (_label, body) => {
        const res = makeRes();
        await dispatch(grantReq(body), res);

        expect(res.statusCode).toBe(400);
        expect(db.rpc).not.toHaveBeenCalled();
    });

    it('maps an unknown member to 404', async () => {
        db.rpc.mockResolvedValue({ data: null, error: { message: 'Member profile not found' } });

        const res = makeRes();
        await dispatch(grantReq({ userId: MEMBER_ID, amount: 10 }), res);

        expect(res.statusCode).toBe(404);
    });

    it('tells the operator to apply the migration when the RPC is absent', async () => {
        db.rpc.mockResolvedValue({
            data: null,
            error: { message: 'Could not find the function public.grant_sgcoin(p_amount, p_note, p_user_id) in the schema cache' },
        });

        const res = makeRes();
        await dispatch(grantReq({ userId: MEMBER_ID, amount: 10 }), res);

        expect(res.statusCode).toBe(503);
        expect((res.body as { error: string }).error).toMatch(/20261023_sgcoin_admin_grants\.sql/);
    });

    it('answers 405 for a GET from an authorized caller', async () => {
        const res = makeRes();
        await dispatch(
            makeReq({ slug: 'admin-sgcoin-grant', method: 'GET', token: ADMIN_TOKEN }),
            res,
        );

        expect(res.statusCode).toBe(405);
        expect(res.headers.allow).toBe('POST');
    });
});

describe('GET /api/admin-sgcoin-grants', () => {
    const GRANT_ID = '0b9f6c55-1111-4222-8333-444455556666';

    it('rejects a 43-character token', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-grants', token: len43() }), res);

        expect(res.statusCode).toBe(401);
        expect(db.from).not.toHaveBeenCalled();
    });

    it('returns the ledger newest-first with the member label joined', async () => {
        db.limit.mockResolvedValue({
            data: [
                {
                    id: GRANT_ID,
                    user_id: MEMBER_ID,
                    amount: '500',
                    note: 'launch bonus',
                    balance_after: '1750',
                    created_at: '2026-10-23T10:00:00.000Z',
                },
            ],
            error: null,
        });
        db.in.mockResolvedValue({
            data: [{ id: MEMBER_ID, full_name: 'Derron Byrd', email: 'd@example.com' }],
            error: null,
        });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-grants', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(200);
        expect(db.order).toHaveBeenCalledWith('sgcoin_admin_grants', 'created_at', { ascending: false });
        expect(db.limit).toHaveBeenCalledWith('sgcoin_admin_grants', 50);
        expect(db.in).toHaveBeenCalledWith('profiles', 'id', [MEMBER_ID]);
        expect(res.body).toMatchObject({
            grants: [
                {
                    id: GRANT_ID,
                    userId: MEMBER_ID,
                    memberName: 'Derron Byrd',
                    memberEmail: 'd@example.com',
                    amount: 500,
                    note: 'launch bonus',
                    balanceAfter: 1750,
                    createdAt: '2026-10-23T10:00:00.000Z',
                },
            ],
        });
    });

    it('answers an empty ledger without a second query', async () => {
        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-grants', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({ grants: [] });
        expect(db.in).not.toHaveBeenCalled();
    });

    it('still returns the ledger when the label lookup fails', async () => {
        db.limit.mockResolvedValue({
            data: [
                {
                    id: GRANT_ID,
                    user_id: MEMBER_ID,
                    amount: 25,
                    note: null,
                    balance_after: 25,
                    created_at: '2026-10-23T10:00:00.000Z',
                },
            ],
            error: null,
        });
        db.in.mockResolvedValue({ data: null, error: { message: 'profiles unavailable' } });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-grants', token: ADMIN_TOKEN }), res);

        // The grant row is the money record; a missing name is decoration.
        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({
            grants: [{ id: GRANT_ID, memberName: null, memberEmail: null, amount: 25 }],
        });
    });

    it('surfaces a ledger read failure as 500', async () => {
        db.limit.mockResolvedValue({ data: null, error: { message: 'relation does not exist' } });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-grants', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(500);
        expect((res.body as { error: string }).error).toBe('relation does not exist');
    });

    it('answers 405 for a POST', async () => {
        const res = makeRes();
        await dispatch(
            makeReq({ slug: 'admin-sgcoin-grants', method: 'POST', token: ADMIN_TOKEN }),
            res,
        );

        expect(res.statusCode).toBe(405);
        expect(res.headers.allow).toBe('GET');
    });
});

describe('the grant migration keeps the mint off the anon key', () => {
    const sql = fs.readFileSync(
        path.join(__dirname, '..', 'supabase', 'migrations', '20261023_sgcoin_admin_grants.sql'),
        'utf8',
    );

    it('creates the ledger and the RPC', () => {
        expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.sgcoin_admin_grants/);
        expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.grant_sgcoin/);
    });

    it('enables RLS with no write policy', () => {
        expect(sql).toMatch(/ALTER TABLE public\.sgcoin_admin_grants ENABLE ROW LEVEL SECURITY/);
        expect(sql).not.toMatch(/ON public\.sgcoin_admin_grants FOR INSERT/);
        expect(sql).not.toMatch(/ON public\.sgcoin_admin_grants FOR UPDATE/);
    });

    it('grants execution to service_role only', () => {
        expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.grant_sgcoin\([^)]*\) FROM anon, authenticated/);
        expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.grant_sgcoin\([^)]*\) TO service_role/);
        expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.grant_sgcoin\([^)]*\) TO (anon|authenticated|PUBLIC)/);
    });

    it('pins the search_path on the SECURITY DEFINER function', () => {
        expect(sql).toMatch(/SECURITY DEFINER/);
        expect(sql).toMatch(/SET search_path = public, pg_temp/);
    });
});
