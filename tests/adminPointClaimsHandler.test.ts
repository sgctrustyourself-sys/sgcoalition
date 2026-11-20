// tests/adminPointClaimsHandler.test.ts
//
// Tests for GET/POST /api/admin-point-claims — the review queue and the two
// money-moving actions behind Admin → SGCoin Distribution → Point Claims.
//
// The contract under test:
//   - admin-only ('shared' policy): anonymous or wrong token -> 401, no read and
//     no RPC — approving a claim credits SGCoin, so the gate is the whole
//     authorization story (there is no Supabase user behind this session)
//   - a claim review is ONE RPC call: the handler never writes a balance itself,
//     and an override amount is the only number a client can influence
//   - the queue puts pending first regardless of recency, because the operator
//     works top-down and an old unreviewed claim must not fall off the page
//   - an unapplied migration is a 503 naming the file, not a 500 with
//     "schema cache" in it
//
// The Supabase client is mocked at the @supabase/supabase-js boundary so the
// handler's own `createClient(...)` call resolves to the shared chainable mock
// from tests/_helpers/supabaseClientMock.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@supabase/supabase-js', async () => {
    const { mockSupabase } = await import('./_helpers/supabaseClientMock');
    return { createClient: () => mockSupabase.client };
});

import { mockSupabase } from './_helpers/supabaseClientMock';
import type { ApiRequest, ApiResponse } from '../api/_types';
import adminPointClaimsHandler from '../api/_handlers/admin-point-claims';

const ADMIN_TOKEN = 'admin-token-point-claims-12345';

// Typed rather than `as any` like the older handler tests: this file is added
// while the lint budget is a ratchet, so it pays for its own warnings (zero).
function makeReq(
    opts: {
        method?: string;
        headers?: Record<string, string>;
        body?: unknown;
        query?: Record<string, string>;
    } = {},
): ApiRequest {
    return {
        method: opts.method ?? 'GET',
        headers: opts.headers ?? {},
        query: opts.query ?? {},
        url: '/api/admin-point-claims',
        body: opts.body ?? null,
    };
}

/** The response object under test, with the captured code and body readable. */
interface TestResponse extends ApiResponse {
    statusCode: number;
    body: unknown;
}

function makeRes(): TestResponse {
    const res: TestResponse = {
        statusCode: 0,
        body: undefined,
        setHeader: () => {},
        send: () => {},
        end: () => {},
        status(code: number) {
            res.statusCode = code;
            return res;
        },
        json(b: unknown) {
            res.body = b;
        },
    };
    return res;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

const pendingClaim = {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'u-1',
    claimant_email: 'new-member@example.com',
    order_id: 'order-1',
    order_number: 'ORD-1234',
    order_email: 'guest@example.com',
    matched: true,
    points: '84',
    proof_url: null,
    note: null,
    status: 'pending',
    granted_amount: null,
    review_note: null,
    reviewed_at: null,
    created_at: '2026-07-01T10:00:00Z',
};

const reviewedClaim = {
    ...pendingClaim,
    id: '22222222-2222-4222-8222-222222222222',
    order_number: 'ORD-1200',
    status: 'approved',
    granted_amount: '30',
    reviewed_at: '2026-07-02T10:00:00Z',
    // Newer than the pending claim, to prove the ordering is not just recency.
    created_at: '2026-07-03T10:00:00Z',
};

describe('/api/admin-point-claims', () => {
    beforeEach(() => {
        mockSupabase.setOutcomes([]);
        vi.clearAllMocks();
        process.env.ADMIN_API_TOKEN = ADMIN_TOKEN;
        delete process.env.ADMIN_PASSPHRASE;
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    });

    afterEach(() => {
        delete process.env.ADMIN_API_TOKEN;
        delete process.env.ADMIN_PASSPHRASE;
        delete process.env.SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it('OPTIONS preflight -> 200 without touching the queue', async () => {
        const res = makeRes();
        await adminPointClaimsHandler(makeReq({ method: 'OPTIONS' }), res);

        expect(res.statusCode).toBe(200);
        expect(mockSupabase.rpcSpy).not.toHaveBeenCalled();
    });

    it('anonymous -> 401 and no read', async () => {
        const res = makeRes();
        await adminPointClaimsHandler(makeReq(), res);

        expect(res.statusCode).toBe(401);
        expect(mockSupabase.fromSpy).not.toHaveBeenCalled();
    });

    it('wrong token -> 401', async () => {
        const res = makeRes();
        await adminPointClaimsHandler(makeReq({ headers: bearer('nope') }), res);

        expect(res.statusCode).toBe(401);
        expect(mockSupabase.fromSpy).not.toHaveBeenCalled();
    });

    it('PUT -> 405', async () => {
        const res = makeRes();
        await adminPointClaimsHandler(makeReq({ method: 'PUT', headers: bearer(ADMIN_TOKEN) }), res);

        expect(res.statusCode).toBe(405);
    });

    it('GET returns the queue with pending claims first, then reviewed', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [reviewedClaim, pendingClaim] } },
            { kind: 'resolve', value: { data: [{ id: 'u-1', full_name: 'Ada L', email: 'new-member@example.com' }] } },
        ]);

        const res = makeRes();
        await adminPointClaimsHandler(makeReq({ headers: bearer(ADMIN_TOKEN) }), res);

        expect(res.statusCode).toBe(200);
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('point_claims');
        const claims = (res.body as { claims: Array<Record<string, unknown>> }).claims;
        expect(claims.map((claim) => claim.orderNumber)).toEqual(['ORD-1234', 'ORD-1200']);
        // Numerics arrive as strings from PostgREST; the panel does arithmetic on them.
        expect(claims[0].points).toBe(84);
        expect(claims[0].memberName).toBe('Ada L');
    });

    it('GET ?status=bogus -> 400', async () => {
        const res = makeRes();
        await adminPointClaimsHandler(
            makeReq({ headers: bearer(ADMIN_TOKEN), query: { status: 'weird' } }),
            res,
        );

        expect(res.statusCode).toBe(400);
    });

    it('GET when the table is missing -> 503 naming the migration', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { error: { message: 'relation "public.point_claims" does not exist' } } },
        ]);

        const res = makeRes();
        await adminPointClaimsHandler(makeReq({ headers: bearer(ADMIN_TOKEN) }), res);

        expect(res.statusCode).toBe(503);
        expect((res.body as { error: string }).error).toContain('20261027_create_point_claims.sql');
    });

    it('POST approve without an amount pays what the order says (p_amount null)', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [{ claim_id: pendingClaim.id, granted: '84', balance: 210 }] } },
        ]);

        const res = makeRes();
        await adminPointClaimsHandler(
            makeReq({
                method: 'POST',
                headers: bearer(ADMIN_TOKEN),
                body: { action: 'approve', claimId: pendingClaim.id },
            }),
            res,
        );

        expect(res.statusCode).toBe(200);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('approve_point_claim', {
            p_claim_id: pendingClaim.id,
            p_amount: null,
            p_note: null,
        });
        expect(res.body).toMatchObject({ claimId: pendingClaim.id, status: 'approved', granted: 84, balanceAfter: 210 });
    });

    it('POST approve forwards an operator override', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [{ claim_id: pendingClaim.id, granted: '50', balance: 50 }] } },
        ]);

        const res = makeRes();
        await adminPointClaimsHandler(
            makeReq({
                method: 'POST',
                headers: bearer(ADMIN_TOKEN),
                body: { action: 'approve', claimId: pendingClaim.id, amount: 50, note: 'Goodwill top-up' },
            }),
            res,
        );

        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('approve_point_claim', {
            p_claim_id: pendingClaim.id,
            p_amount: 50,
            p_note: 'Goodwill top-up',
        });
        expect(res.statusCode).toBe(200);
    });

    it('POST approve rejects a non-whole amount before any RPC runs', async () => {
        for (const amount of [0, -5, 12.5, 'twelve']) {
            const res = makeRes();
            await adminPointClaimsHandler(
                makeReq({ method: 'POST', headers: bearer(ADMIN_TOKEN), body: { action: 'approve', claimId: pendingClaim.id, amount } }),
                res,
            );
            expect(res.statusCode, `amount ${String(amount)}`).toBe(400);
        }

        expect(mockSupabase.rpcSpy).not.toHaveBeenCalled();
    });

    it('POST approve on an already-reviewed claim -> 409, not a silent second credit', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { error: { message: 'That claim is already approved' } } },
        ]);

        const res = makeRes();
        await adminPointClaimsHandler(
            makeReq({ method: 'POST', headers: bearer(ADMIN_TOKEN), body: { action: 'approve', claimId: pendingClaim.id } }),
            res,
        );

        expect(res.statusCode).toBe(409);
    });

    it('POST approve when the RPC is missing -> 503 naming the migration', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { error: { message: 'Could not find the function public.approve_point_claim(p_claim_id) in the schema cache' } } },
        ]);

        const res = makeRes();
        await adminPointClaimsHandler(
            makeReq({ method: 'POST', headers: bearer(ADMIN_TOKEN), body: { action: 'approve', claimId: pendingClaim.id } }),
            res,
        );

        expect(res.statusCode).toBe(503);
        expect((res.body as { error: string }).error).toContain('20261027_create_point_claims.sql');
    });

    it('POST reject closes the claim without paying it', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [{ claim_id: pendingClaim.id, status: 'rejected' }] } },
        ]);

        const res = makeRes();
        await adminPointClaimsHandler(
            makeReq({
                method: 'POST',
                headers: bearer(ADMIN_TOKEN),
                body: { action: 'reject', claimId: pendingClaim.id, note: 'Order was refunded' },
            }),
            res,
        );

        expect(res.statusCode).toBe(200);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('reject_point_claim', {
            p_claim_id: pendingClaim.id,
            p_reason: 'Order was refunded',
        });
        expect(res.body).toMatchObject({ status: 'rejected', granted: 0 });
    });

    it('POST with an unknown action, or no claim id, -> 400 before any write', async () => {
        const badAction = makeRes();
        await adminPointClaimsHandler(
            makeReq({ method: 'POST', headers: bearer(ADMIN_TOKEN), body: { action: 'refund', claimId: pendingClaim.id } }),
            badAction,
        );
        expect(badAction.statusCode).toBe(400);

        const badId = makeRes();
        await adminPointClaimsHandler(
            makeReq({ method: 'POST', headers: bearer(ADMIN_TOKEN), body: { action: 'approve', claimId: 'not-a-uuid' } }),
            badId,
        );
        expect(badId.statusCode).toBe(400);

        expect(mockSupabase.rpcSpy).not.toHaveBeenCalled();
    });
});
