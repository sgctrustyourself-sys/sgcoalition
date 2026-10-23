// tests/verifySubscription.test.ts
//
// Unit tests for POST /api/verify-subscription — the VIP membership
// verification endpoint. The defect these pin: the handler's $15 welcome
// credit was an unconditional read-modify-write, so EVERY reload of the
// membership return URL added another $15 of store credit — pages/OrderSuccess
// posts here on mount whenever the URL carries session_id + type=membership,
// so one paid session minted credit for as long as the page was reloadable.
//
// The grant is now claimed by a compare-and-set on the membership transition
// (is_vip false/null -> true), observed with .select(): only the call that wins
// the transition writes the credit. The stateful profiles stub below arms that
// guard exactly when the handler does, so 'a reload cannot re-credit' goes red,
// by name, if the .or(...) claim is removed or weakened to something cosmetic.
//
// Follows the handler-test conventions of tests/createPaymentIntent.test.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock helpers — a stateful profiles table so the claim is really exercised
// ---------------------------------------------------------------------------

type ProfileRow = {
    id: string;
    is_vip: boolean | null;
    store_credit: number;
    updated_at?: string;
};

// The claim's guard predicate, order-insensitive: this is what arms the
// transition check in the update stub below. A guard that means something
// else (or none at all) leaves the update unconditional — the pre-fix
// behaviour — which is what makes the reload pin fail when it is reverted.
const CLAIM_GUARD = ['is_vip.eq.false', 'is_vip.is.null'].sort().join(',');

function armedGuard(pred: string | null) {
    return pred !== null && pred.split(',').map((p) => p.trim()).sort().join(',') === CLAIM_GUARD;
}

/**
 * The profiles table, modelling only what the handler touches:
 *
 *   • upsert({id}, {ignoreDuplicates: true}).select() — the ensure-row; like
 *     PostgREST with Prefer: resolution=ignore-duplicates it answers with the
 *     rows it INSERTED (empty when the row already existed).
 *   • select('store_credit').eq('id', …).single() — the credit read.
 *   • update(payload).eq('id', …).or(<claim guard>).select() — the claim: it
 *     applies (and only then answers with rows) while the profile has not yet
 *     joined. Answering with rows either way would make "a reload cannot
 *     re-credit" untestable; without the .or(...) the update applies
 *     unconditionally, which is the pre-fix behaviour the pin must catch.
 */
function profilesApi(state: Map<string, ProfileRow>) {
    return (table: string) => {
        if (table !== 'profiles') throw new Error(`unexpected table: ${table}`);

        const upsert = (payload: Partial<ProfileRow>) => ({
            select: () => ({
                then: (resolve: (v: unknown) => unknown) => {
                    if (state.has(payload.id!)) return resolve({ data: [], error: null });
                    const row = { is_vip: null, store_credit: 0, ...payload } as ProfileRow;
                    state.set(row.id, row);
                    return resolve({ data: [row], error: null });
                },
            }),
        });

        const select = (_cols: string) => ({
            eq: (_col: string, id: string) => ({
                single: () => Promise.resolve({ data: state.get(id) ?? null, error: null }),
            }),
        });

        const update = (payload: Partial<ProfileRow>) => {
            let guard: string | null = null;
            return {
                eq: (_col: string, id: string) => {
                    const apply = () => ({
                        then: (resolve: (v: unknown) => unknown) => {
                            const row = state.get(id);
                            if (!row) return resolve({ data: [], error: null });
                            if (armedGuard(guard) && row.is_vip === true) {
                                return resolve({ data: [], error: null });
                            }
                            const next = { ...row, ...payload } as ProfileRow;
                            state.set(id, next);
                            return resolve({ data: [next], error: null });
                        },
                    });
                    return {
                        or: (pred: string) => {
                            guard = pred;
                            return { select: apply };
                        },
                        select: apply,
                    };
                },
            };
        };

        return { upsert, select, update };
    };
}

// ---------------------------------------------------------------------------
// Mock external modules
// ---------------------------------------------------------------------------

const mockSupabaseFrom = vi.fn();
const mockSessionsRetrieve = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({ from: mockSupabaseFrom })),
}));

vi.mock('stripe', () => ({
    default: vi.fn(function (this: any) {
        this.checkout = { sessions: { retrieve: mockSessionsRetrieve } };
    }),
}));

// ---------------------------------------------------------------------------
// Helpers
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

function makeReq(body: any) {
    return { method: 'POST', body };
}

function paidSession(overrides: Record<string, unknown> = {}) {
    return {
        payment_status: 'paid',
        metadata: { userId: 'user-1', type: 'coalition_vip' },
        ...overrides,
    };
}

async function loadHandler() {
    process.env.STRIPE_SECRET_KEY = 'sk_test_stripe';
    process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
    const mod = await import('../api/_handlers/verify-subscription');
    return mod.default;
}

// =========================================================================
// Tests
// =========================================================================

describe('POST /api/verify-subscription', () => {
    let handler: (req: any, res: any) => Promise<void>;
    let state: Map<string, ProfileRow>;

    beforeEach(async () => {
        mockSupabaseFrom.mockReset();
        mockSessionsRetrieve.mockReset();
        state = new Map();
        mockSupabaseFrom.mockImplementation(profilesApi(state));
        // Dynamic import ensures env vars are set before module load
        handler = await loadHandler();
    });

    it('grants the $15 welcome credit once, on the join', async () => {
        // An existing, never-activated member: is_vip null is the row shape a
        // fresh profile has, and exercises the is-null half of the claim.
        state.set('user-1', { id: 'user-1', is_vip: null, store_credit: 8 });
        mockSessionsRetrieve.mockResolvedValue(paidSession());

        const res = makeRes();
        await handler(makeReq({ sessionId: 'cs_1' }), res);

        expect(res._status).toBe(200);
        expect(res._body).toEqual({ success: true, userId: 'user-1' });
        const row = state.get('user-1')!;
        expect(row.store_credit).toBe(23); // increment, not set-to-15
        expect(row.is_vip).toBe(true);
    });

    it('an unpaid session claims nothing', async () => {
        state.set('user-1', { id: 'user-1', is_vip: false, store_credit: 8 });
        mockSessionsRetrieve.mockResolvedValue(paidSession({ payment_status: 'unpaid' }));

        const res = makeRes();
        await handler(makeReq({ sessionId: 'cs_1' }), res);

        expect(res._status).toBe(400);
        expect(state.get('user-1')!.store_credit).toBe(8);
        expect(state.get('user-1')!.is_vip).toBe(false);
    });

    it('a reload of the membership return URL cannot re-credit', async () => {
        state.set('user-1', { id: 'user-1', is_vip: false, store_credit: 8 });
        mockSessionsRetrieve.mockResolvedValue(paidSession());

        const first = makeRes();
        await handler(makeReq({ sessionId: 'cs_1' }), first);
        const reload = makeRes();
        await handler(makeReq({ sessionId: 'cs_1' }), reload);
        const again = makeRes();
        await handler(makeReq({ sessionId: 'cs_1' }), again);

        expect(first._status).toBe(200);
        // Replays must keep answering the success the client keys on ...
        expect(reload._status, 'the reloaded verify must still answer 200').toBe(200);
        expect(reload._body).toEqual({ success: true, userId: 'user-1' });
        expect(again._status).toBe(200);
        // ... without minting another $15 per visit.
        expect(
            state.get('user-1')!.store_credit,
            'a reload of the membership return URL must not re-credit',
        ).toBe(23);
    });
});
