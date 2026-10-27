// tests/sgcoinGrantReversal.test.ts
//
// POST /api/admin-sgcoin-reverse — the clawback behind "Reverse" in the admin
// SGCoin Distribution tab.
//
// Same method as tests/sgcoinGrant.test.ts: drive the real dispatcher so the
// slug is proven routed and the admin gate is proven first, then assert the RPC
// is called with validated inputs and that its refusals arrive as distinguishable
// statuses. The SQL half is pinned by reading the migration, because this suite
// cannot execute DDL.
//
// The properties that matter, and the test that states each:
//   * a 43-character token is not a credential          -> rejects a 43-char token
//   * only a real, unreversed grant can be clawed back  -> 404 / 409 cases
//   * a member who spent the SGCoin is refused          -> 409 balance too low
//   * the ledger keeps both rows                        -> migration: no UPDATE/DELETE policy
//   * one reversal per grant, enforced in the database  -> migration: unique index
//   * anon cannot call the RPC                          -> migration: REVOKE anon, authenticated

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

const ADMIN_TOKEN = 'configured-admin-token-for-sgcoin-reversal-tests';
const MEMBER_ID = '3f8a1c2e-4b5d-6e7f-8a9b-0c1d2e3f4a5b';
const GRANT_ID = '0b9f6c55-1111-4222-8333-444455556666';
const OTHER_GRANT_ID = '1c0a7d66-2222-4333-8444-555566667777';

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
}) {
    const headers: Record<string, string> = { 'x-forwarded-for': '203.0.113.31' };
    if (opts.token !== null && opts.token !== undefined) {
        headers.authorization = `Bearer ${opts.token}`;
    }
    return {
        method: opts.method ?? 'POST',
        url: `/api/${opts.slug}`,
        headers,
        query: { slug: opts.slug },
        body: opts.body ?? null,
    } as never;
}

const len43 = () => 'a'.repeat(43);

const reversalReq = (body: unknown, token: string | null = ADMIN_TOKEN) =>
    makeReq({ slug: 'admin-sgcoin-reverse', method: 'POST', token, body });

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

describe('POST /api/admin-sgcoin-reverse', () => {
    it('rejects a caller with no credential', async () => {
        const res = makeRes();
        await dispatch(reversalReq({ grantId: GRANT_ID }, null), res);

        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: ADMIN_UNAUTHORIZED_ERROR });
        expect(db.rpc).not.toHaveBeenCalled();
    });

    it('rejects a 43-character token — the shape the old admin files accepted', async () => {
        const res = makeRes();
        await dispatch(reversalReq({ grantId: GRANT_ID }, len43()), res);

        expect(res.statusCode).toBe(401);
        expect(db.rpc).not.toHaveBeenCalled();
    });

    it('calls the RPC and returns the reversal it committed', async () => {
        db.rpc.mockResolvedValue({
            data: [{ reversal_id: 'reversal-1', new_balance: '249', reversed_amount: '1' }],
            error: null,
        });

        const res = makeRes();
        await dispatch(reversalReq({ grantId: GRANT_ID, note: ' sent to the wrong member ' }), res);

        expect(res.statusCode).toBe(200);
        expect(db.rpc).toHaveBeenCalledWith('reverse_sgcoin_grant', {
            p_grant_id: GRANT_ID,
            p_note: 'sent to the wrong member',
        });
        expect(res.body).toEqual({
            grantId: GRANT_ID,
            reversalId: 'reversal-1',
            reversedAmount: 1,
            balanceAfter: 249,
        });
    });

    it('passes an empty note as null', async () => {
        db.rpc.mockResolvedValue({
            data: [{ reversal_id: 'r', new_balance: 5, reversed_amount: 1 }],
            error: null,
        });

        await dispatch(reversalReq({ grantId: GRANT_ID, note: '   ' }), makeRes());

        expect(db.rpc).toHaveBeenCalledWith('reverse_sgcoin_grant', {
            p_grant_id: GRANT_ID,
            p_note: null,
        });
    });

    it.each([
        ['a missing grant id', {}],
        ['a non-UUID grant id', { grantId: 'grant-1' }],
        ['an over-long note', { grantId: GRANT_ID, note: 'x'.repeat(281) }],
    ])('rejects %s without touching the RPC', async (_label, body) => {
        const res = makeRes();
        await dispatch(reversalReq(body), res);

        expect(res.statusCode).toBe(400);
        expect(db.rpc).not.toHaveBeenCalled();
    });

    it('maps an unknown grant to 404', async () => {
        db.rpc.mockResolvedValue({ data: null, error: { message: 'Grant not found' } });

        const res = makeRes();
        await dispatch(reversalReq({ grantId: GRANT_ID }), res);

        expect(res.statusCode).toBe(404);
        expect(res.body).toEqual({ error: 'Grant not found.' });
    });

    it('maps a second reversal to 409', async () => {
        db.rpc.mockResolvedValue({ data: null, error: { message: 'This grant was already reversed' } });

        const res = makeRes();
        await dispatch(reversalReq({ grantId: GRANT_ID }), res);

        expect(res.statusCode).toBe(409);
        expect(res.body).toEqual({ error: 'This grant was already reversed.' });
    });

    it('refuses to reverse a reversal, which would be a re-mint', async () => {
        db.rpc.mockResolvedValue({ data: null, error: { message: 'Only a grant can be reversed' } });

        const res = makeRes();
        await dispatch(reversalReq({ grantId: GRANT_ID }), res);

        expect(res.statusCode).toBe(409);
    });

    it('reports a spent balance as 409 with the numbers from the database', async () => {
        db.rpc.mockResolvedValue({
            data: null,
            error: {
                message:
                    'Member balance is too low to reverse this grant: 3 SGCoin held, 500 required',
            },
        });

        const res = makeRes();
        await dispatch(reversalReq({ grantId: GRANT_ID }), res);

        expect(res.statusCode).toBe(409);
        expect((res.body as { error: string }).error).toContain('3 SGCoin held, 500 required');
    });

    it('maps a vanished member to 404, not a conflict', async () => {
        db.rpc.mockResolvedValue({ data: null, error: { message: 'Member profile not found' } });

        const res = makeRes();
        await dispatch(reversalReq({ grantId: GRANT_ID }), res);

        expect(res.statusCode).toBe(404);
    });

    it('tells the operator to apply the migration when the RPC is absent', async () => {
        db.rpc.mockResolvedValue({
            data: null,
            error: {
                message:
                    'Could not find the function public.reverse_sgcoin_grant(p_grant_id, p_note) in the schema cache',
            },
        });

        const res = makeRes();
        await dispatch(reversalReq({ grantId: GRANT_ID }), res);

        expect(res.statusCode).toBe(503);
        expect((res.body as { error: string }).error).toMatch(
            /20261024_sgcoin_grant_reversals\.sql/,
        );
    });

    it('does not disguise an outage as bad input', async () => {
        db.rpc.mockResolvedValue({ data: null, error: { message: 'connection reset by peer' } });

        const res = makeRes();
        await dispatch(reversalReq({ grantId: GRANT_ID }), res);

        expect(res.statusCode).toBe(500);
    });

    it('answers 405 for a GET from an authorized caller', async () => {
        const res = makeRes();
        await dispatch(
            makeReq({ slug: 'admin-sgcoin-reverse', method: 'GET', token: ADMIN_TOKEN }),
            res,
        );

        expect(res.statusCode).toBe(405);
        expect(res.headers.allow).toBe('POST');
    });
});

describe('GET /api/admin-sgcoin-grants exposes both sides of a correction', () => {
    it('selects and returns kind and the grant a reversal undoes', async () => {
        db.limit.mockResolvedValue({
            data: [
                {
                    id: 'reversal-row',
                    user_id: MEMBER_ID,
                    amount: '-1',
                    note: 'wrong member',
                    balance_after: '0',
                    created_at: '2026-10-24T09:00:00.000Z',
                    kind: 'reversal',
                    reverses_grant_id: GRANT_ID,
                },
                {
                    id: GRANT_ID,
                    user_id: MEMBER_ID,
                    amount: '1',
                    note: null,
                    balance_after: '1',
                    created_at: '2026-10-23T09:00:00.000Z',
                    kind: 'grant',
                    reverses_grant_id: null,
                },
            ],
            error: null,
        });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-grants', method: 'GET', token: ADMIN_TOKEN }), res);

        expect(res.statusCode).toBe(200);
        expect(db.select).toHaveBeenCalledWith(
            'sgcoin_admin_grants',
            expect.stringContaining('reverses_grant_id'),
        );
        expect(res.body).toMatchObject({
            grants: [
                {
                    id: 'reversal-row',
                    amount: -1,
                    kind: 'reversal',
                    reversesGrantId: GRANT_ID,
                },
                { id: GRANT_ID, amount: 1, kind: 'grant', reversesGrantId: null },
            ],
        });
    });

    it('reads a pre-reversal row (NULL kind) as a plain grant', async () => {
        db.limit.mockResolvedValue({
            data: [
                {
                    id: OTHER_GRANT_ID,
                    user_id: MEMBER_ID,
                    amount: 50,
                    note: null,
                    balance_after: 50,
                    created_at: '2026-10-23T09:00:00.000Z',
                    kind: null,
                    reverses_grant_id: null,
                },
            ],
            error: null,
        });

        const res = makeRes();
        await dispatch(makeReq({ slug: 'admin-sgcoin-grants', method: 'GET', token: ADMIN_TOKEN }), res);

        expect(res.body).toMatchObject({
            grants: [{ kind: 'grant', reversesGrantId: null }],
        });
    });
});

describe('the reversal migration keeps the clawback auditable and gated', () => {
    const read = (file: string) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const sql = read('supabase/migrations/20261024_sgcoin_grant_reversals.sql');

    it('adds the reversal columns without rewriting existing rows', () => {
        expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'grant'/);
        expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS reverses_grant_id UUID/);
        // The original `amount > 0` check has to be gone, or a negative reversal
        // row can never be inserted. Dropped by definition, since the inline
        // check's name is generated.
        // Anchored to "the whole definition starts with CHECK ((amount > ".
        // Postgres renders the literal as `(0)::numeric` for a NUMERIC column,
        // so matching `amount > 0` exactly drops nothing and the first
        // reversal then trips the old constraint at runtime.
        expect(sql).toContain(String.raw`pg_get_constraintdef(oid) ~ '^CHECK \(\(amount > '`);
        expect(sql).toContain('DROP CONSTRAINT %I');
    });

    it('makes the row shape enforce kind, sign and target together', () => {
        expect(sql).toMatch(/CHECK \(\s*\(kind = 'grant'    AND amount > 0 AND reverses_grant_id IS NULL\)/);
        expect(sql).toMatch(/OR \(kind = 'reversal' AND amount < 0 AND reverses_grant_id IS NOT NULL\)/);
    });

    it('allows a grant to be reversed once, in the database and not just in code', () => {
        expect(sql).toMatch(
            /CREATE UNIQUE INDEX IF NOT EXISTS uq_sgcoin_admin_grants_reverses\s+ON public\.sgcoin_admin_grants \(reverses_grant_id\)\s+WHERE reverses_grant_id IS NOT NULL/,
        );
    });

    it('keeps the ledger append-only: no write policy is added', () => {
        expect(sql).not.toMatch(/ON public\.sgcoin_admin_grants FOR INSERT/);
        expect(sql).not.toMatch(/ON public\.sgcoin_admin_grants FOR UPDATE/);
        expect(sql).not.toMatch(/ON public\.sgcoin_admin_grants FOR DELETE/);
        expect(sql).not.toMatch(/DROP POLICY/);
    });

    it('refuses to push a balance negative and says why', () => {
        expect(sql).toMatch(/AND COALESCE\(sg_coin_balance, 0\) >= v_grant\.amount/);
        expect(sql).toMatch(/Member balance is too low to reverse this grant/);
    });

    it('serializes concurrent reversals on the grant row', () => {
        expect(sql).toMatch(/FROM public\.sgcoin_admin_grants\s+WHERE id = p_grant_id\s+FOR UPDATE/);
        expect(sql).toMatch(/This grant was already reversed/);
    });

    it('writes the reversal as a negative row in the same transaction', () => {
        expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.reverse_sgcoin_grant/);
        expect(sql).toMatch(/\(v_grant\.user_id, -v_grant\.amount/);
        expect(sql).toMatch(/'reversal', p_grant_id/);
    });

    it('grants execution to service_role only, with a pinned search_path', () => {
        expect(sql).toMatch(/SECURITY DEFINER/);
        expect(sql).toMatch(/SET search_path = public, pg_temp/);
        expect(sql).toMatch(
            /REVOKE ALL ON FUNCTION public\.reverse_sgcoin_grant\([^)]*\) FROM anon, authenticated/,
        );
        expect(sql).toMatch(
            /GRANT EXECUTE ON FUNCTION public\.reverse_sgcoin_grant\([^)]*\) TO service_role/,
        );
        expect(sql).not.toMatch(
            /GRANT EXECUTE ON FUNCTION public\.reverse_sgcoin_grant\([^)]*\) TO (anon|authenticated|PUBLIC)/,
        );
    });
});
