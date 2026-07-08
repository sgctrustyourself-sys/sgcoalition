import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted runs before vi.mock so the chain variable is in scope when the
// factory closure executes. Vitest specifically forbids capturing lexical
// variables that aren't mock-prefixed in vi.mock factories.
const { mockFromChain } = vi.hoisted(() => {
    const chain: any = {};
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.single = vi.fn(() => chain);
    chain.is = vi.fn(() => chain);
    return { mockFromChain: chain };
});

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: () => mockFromChain }),
}));

import handler from '../api/_handlers/credit-customer-reward';

type StubRes = {
    statusCode: number;
    body: any;
    status: (code: number) => StubRes;
    json: (data: unknown) => void;
    send: (data: string | Buffer) => void;
    setHeader: (name: string, value: string | string[]) => void;
    end: () => void;
};

function makeRes(): StubRes {
    const res: StubRes = {
        statusCode: 0,
        body: undefined,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
        },
        send(data) {
            this.body = data;
        },
        setHeader() { return; },
        end() { return; },
    };
    return res;
}

const TEST_ADMIN_TOKEN = 'test-admin-token';

function makeReq(body: unknown, method = 'POST'): any {
    return { method, body, headers: { authorization: `Bearer ${TEST_ADMIN_TOKEN}` }, query: {} };
}

beforeEach(() => {
    process.env.ADMIN_SESSION_TOKEN = TEST_ADMIN_TOKEN;
    mockFromChain.insert.mockReset().mockImplementation(() => mockFromChain);
    mockFromChain.update.mockReset().mockImplementation(() => mockFromChain);
    mockFromChain.select.mockReset().mockImplementation(() => mockFromChain);
    mockFromChain.eq.mockReset().mockImplementation(() => mockFromChain);
    // Do NOT set a fallback for .single() — a queued mockResolvedValueOnce
    // takes priority but if a test under-queues, an undefined return causes
    // the handler's IF checks to fire correctly (no false-positive 500).
    mockFromChain.single.mockReset();
    mockFromChain.is.mockReset().mockImplementation(() => mockFromChain);
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test-key';
});

afterEach(() => {
    vi.clearAllMocks();
    // Don't leak process.env.ADMIN_SESSION_TOKEN into the next test file --
    // vitest shares process state across suites and the auth-failure tests
    // set the test fixture in beforeEach.
    delete process.env.ADMIN_SESSION_TOKEN;
});

describe('/api/credit-customer-reward handler', () => {
    it('writes a customer_reward_credits audit row first, then bumps sg_coin_balance', async () => {
        // First .single() reads the profile (current balance 100).
        mockFromChain.single.mockResolvedValueOnce({ data: { id: 'profile-1', sg_coin_balance: 100 }, error: null });
        // Second .single() returns the audit row.
        mockFromChain.single.mockResolvedValueOnce({ data: { id: 'credit-row-1', created_at: '2026-07-02T15:00:00Z' }, error: null });
        mockFromChain.update.mockReturnValueOnce({ error: null, eq: () => ({ error: null }) });

        const res = makeRes();
        await handler(
            makeReq({ profileId: 'profile-1', amountSgc: 50, reason: 'Starrboii067 - wallet bonus' }),
            res as any
        );

        expect(res.statusCode).toBe(200);
        expect(res.body).toMatchObject({
            success: true,
            newSgCoinBalance: 150,
            creditId: 'credit-row-1',
        });
        expect(mockFromChain.insert).toHaveBeenCalledWith({
            profile_id: 'profile-1',
            order_id: null,
            amount_sgc: 50,
            amount_usd: null,
            awarded_by_user_id: 'profile-1',
            reason: 'Starrboii067 - wallet bonus',
        });
        expect(mockFromChain.update).toHaveBeenCalledWith({
            sg_coin_balance: 150,
            last_reward_credit_at: '2026-07-02T15:00:00Z',
            last_reward_credit_amount: 50,
            updated_at: expect.any(String),
        });
        // Audit (insert) must happen BEFORE the profile update.
        const insertOrder = mockFromChain.insert.mock.invocationCallOrder[0];
        const updateOrder = mockFromChain.update.mock.invocationCallOrder[0];
        expect(insertOrder).toBeLessThan(updateOrder);
    });

    it('returns 400 when amountSgc is zero or negative', async () => {
        const res = makeRes();
        await handler(makeReq({ profileId: 'profile-2', amountSgc: 0 }), res as any);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/amountSgc/);
        expect(mockFromChain.insert).not.toHaveBeenCalled();
    });

    it('returns 400 when amountSgc is missing', async () => {
        const res = makeRes();
        await handler(makeReq({ profileId: 'profile-2', reason: 'no amount' }), res as any);

        expect(res.statusCode).toBe(400);
    });

    it('returns 400 when profileId is missing', async () => {
        const res = makeRes();
        await handler(makeReq({ amountSgc: 10, reason: 'forgot profile' }), res as any);

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/profileId/);
    });

    it('returns 405 on non-POST methods', async () => {
        const res = makeRes();
        await handler(makeReq({}, 'GET'), res as any);

        expect(res.statusCode).toBe(405);
    });

    it('handles OPTIONS preflight with 200', async () => {
        const res = makeRes();
        await handler(makeReq({}, 'OPTIONS'), res as any);

        expect(res.statusCode).toBe(200);
    });

    // Batch B deferred-fix verification (flag (b), negative path #1):
    // audit-first contract requires that if the customer_reward_credits
    // audit insert fails, the profile update MUST NOT be attempted. A
    // future refactor that swapped the two steps would silently bump
    // balances without an audit row -- the test locks the order.
    it('returns 500 when the audit insert fails; profile update is NEVER attempted', async () => {
        mockFromChain.single.mockResolvedValueOnce({ data: { id: 'profile-3', sg_coin_balance: 100 }, error: null });
        mockFromChain.single.mockResolvedValueOnce({ data: null, error: { message: 'audit insert failed' } });

        const res = makeRes();
        await handler(
            makeReq({ profileId: 'profile-3', amountSgc: 50, reason: 'audit-step failure scenario' }),
            res as any
        );

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toMatch(/customer_reward_credits audit row/);
        expect(mockFromChain.update).not.toHaveBeenCalled();
    });

    // Batch B deferred-fix verification (flag (b), negative path #2):
    // partial-write surface. Audit row was committed (step 3) BEFORE the
    // profile update (step 4), so if step 4 fails the audit row is the
    // source of truth for reconciliation. The handler surfaces this in
    // the operator-readable 500 message so a manual reconcile can recover.
    // The test asserts (a) the partial-write message is returned, (b) the
    // update WAS called (so a future swap would NOT silently succeed),
    // and (c) invocation order stays insert < update.
    it('returns 500 with partial-write message when the balance update fails AFTER audit row was written', async () => {
        mockFromChain.single.mockResolvedValueOnce({ data: { id: 'profile-4', sg_coin_balance: 100 }, error: null });
        mockFromChain.single.mockResolvedValueOnce({ data: { id: 'credit-row-2', created_at: '2026-07-02T15:00:00Z' }, error: null });
        mockFromChain.update.mockReturnValueOnce({
            error: { message: 'balance update failed' },
            eq: () => ({ error: { message: 'balance update failed' } }),
        });

        const res = makeRes();
        await handler(
            makeReq({ profileId: 'profile-4', amountSgc: 50, reason: 'partial-write scenario' }),
            res as any
        );

        expect(res.statusCode).toBe(500);
        expect(res.body.error).toMatch(/Audit row written but balance update failed/);
        // The update WAS called (it just returned an error). The audit-first
        // contract is satisfied because the audit row precedes the update
        // attempt -- not because the update is skipped on failure.
        expect(mockFromChain.update).toHaveBeenCalledTimes(1);
        const insertOrder = mockFromChain.insert.mock.invocationCallOrder[0];
        const updateOrder = mockFromChain.update.mock.invocationCallOrder[0];
        expect(insertOrder).toBeLessThan(updateOrder);
    });

    // Admin auth gate (2026-07-07 hardening): withAdminAuth wrapper rejects
    // any caller that doesn't present a Bearer token matching
    // process.env.ADMIN_SESSION_TOKEN. The two negative cases below lock
    // the gate so a future regression that drops the wrapper is caught
    // immediately even though every positive test already exercises the
    // happy path implicitly.
    it('returns 401 when Authorization header is missing', async () => {
        const res = makeRes();
        const req = makeReq({ profileId: 'p1', amountSgc: 50, reason: 'missing-auth scenario' });
        delete req.headers.authorization;
        await handler(req, res as any);
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/Admin authorization required/);
        // The inner handler must NEVER be invoked when auth fails. Locking
        // this means a future regression that skips the gate cannot pass.
        expect(mockFromChain.single).not.toHaveBeenCalled();
        expect(mockFromChain.insert).not.toHaveBeenCalled();
        expect(mockFromChain.update).not.toHaveBeenCalled();
    });

    it('returns 401 when Bearer token does not match ADMIN_SESSION_TOKEN', async () => {
        const res = makeRes();
        const req = makeReq({ profileId: 'p1', amountSgc: 50, reason: 'wrong-token scenario' });
        req.headers.authorization = 'Bearer wrong-token';
        await handler(req, res as any);
        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/Admin authorization required/);
        expect(mockFromChain.single).not.toHaveBeenCalled();
    });
});
