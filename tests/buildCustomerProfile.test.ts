// tests/buildCustomerProfile.test.ts
//
// REGRESSION CATCH: locks the contracts of utils/customerProfile.ts:
//   * buildCustomerProfile(): empty-userId returns null, MetaMask users get a
//     partial profile with zero from() calls, authenticated users get an
//     aggregate of profile + orders + socials + referral_stats + payouts,
//     paid-only order filter, favoriteCategories top-5 by frequency,
//     payoutStats 4-card aggregate + raw payoutRequests array.
//   * buildCustomerProfileByEmail(): isVerifiedBuyer flag, paid-only filter,
//     oldest/newest date computation.
//
// Mock strategy mirrors tests/referralFlows.test.ts:
//   * mockSupabase singleton from tests/_helpers/supabaseClientMock.ts.
//   * vi.mock('../services/supabase') wires the singleton's stable .client.
//   * buildCustomerProfile relies on Promise.all of 5 from() chains in
//     registration order (matters! V8 microtask FIFO consumes outcomes in
//     the same registration order under this synchronous mock setup):
//       (1) profiles                 .select.maybeSingle
//       (2) orders                   .select.eq.order
//       (3) socials                  .select.eq
//       (4) referral_stats           .select.maybeSingle
//       (5) sgcoin_payout_requests   .select.eq.order    (new in 2026-07-16 scope)
//
// Any change to the Promise.all shape MUST come with a paired test update here.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { buildCustomerProfile, buildCustomerProfileByEmail } from '../utils/customerProfile';

vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));

// Synthetic fixtures reused across describe blocks.
const AUTH_USER_ID = 'auth-uuid-12345';
const META_MASK_USER_ID = 'user_eth_0x1234567890abcdef1234567890abcdef12345678';
const GUEST_EMAIL = 'guest@example.com';

const PROFILE_ROW = {
    is_vip: true,
    store_credit: 50.0,
    sg_coin_balance: 1000,
    lifetime_spend_usd: 250,
    lifetime_orders: 5,
    customer_notes: 'VIP since 2026',
};

const ORDERS_MIXED = [
    { id: 'ord-paid-1', total: 100, created_at: '2026-07-10T12:00:00Z', payment_status: 'paid', user_id: AUTH_USER_ID, items: [{ productId: 'prod-grey-wave' }, { productId: 'prod-tee-above' }] },
    { id: 'ord-completed-2', total: 200, created_at: '2026-06-15T08:00:00Z', payment_status: 'completed', user_id: AUTH_USER_ID, items: [{ productId: 'prod-grey-wave' }] },
    { id: 'ord-shipped-3', total: 50, created_at: '2026-05-01T14:00:00Z', payment_status: 'shipped', user_id: AUTH_USER_ID, items: [{ productId: 'prod-tee-above' }] },
    { id: 'ord-cancelled-4', total: 75, created_at: '2026-04-01T10:00:00Z', payment_status: 'cancelled', user_id: AUTH_USER_ID, items: [] },
    { id: 'ord-failed-5', total: 999, created_at: '2026-03-01T09:00:00Z', payment_status: 'failed', user_id: AUTH_USER_ID, items: [] },
];

const SOCIAL_ROWS = [
    { platform: 'instagram', username: 'coolbuyer', verified: true },
    { platform: 'twitter', username: 'coolbuyer_x', verified: false },
];

const REFERRAL_ROW = {
    referral_code: 'SG-ABC123',
    total_referrals: 3,
    successful_referrals: 1,
    total_earnings: 15,
    current_tier: 2,
};

// NEW: synthetic payout rows in snake_case DB form for the 2 dedicated payout tests.
// Schema mirrors supabase/migrations/20260716_create_sgcoin_payout_requests.sql so any
// future column change there propagates here first (test red-flags the drift).
const COMPLETED_PAYOUT_ROW = {
    id: 'pr-comp-1',
    user_id: AUTH_USER_ID,
    email: 'buyer@example.com',
    wallet_address: '0xabc123def456abc123def456abc123def456abcd',
    amount: 8000,
    status: 'completed',
    tx_hash: '0xtxhashcompleted1234567890abcdef',
    rejection_reason: null,
    admin_id: 'admin-1',
    admin_notes: 'Processed via Polygon',
    created_at: '2026-07-15T10:00:00Z',
    updated_at: '2026-07-16T08:00:00Z',
    processed_at: '2026-07-16T08:00:00Z',
};
const REJECTED_PAYOUT_ROW = {
    id: 'pr-rej-1',
    user_id: AUTH_USER_ID,
    email: 'buyer@example.com',
    wallet_address: '0xabc123def456abc123def456abc123def456abcd',
    amount: 5000,
    status: 'rejected',
    tx_hash: null,
    rejection_reason: 'Wallet address could not be verified',
    admin_id: 'admin-1',
    admin_notes: null,
    created_at: '2026-07-10T12:00:00Z',
    updated_at: '2026-07-12T09:00:00Z',
    processed_at: '2026-07-12T09:00:00Z',
};

beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton queue so each test starts empty. Without this,
    // tests that DON'T make any DB calls (e.g. early-return on empty userId
    // or MetaMask short-circuit) would inherit the makeSupabaseClient()
    // default of 1 queued resolve and fail `getRemainingOutcomes() === 0`.
    mockSupabase.setOutcomes([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ============================================================================
// 1. Early-return contracts
// ============================================================================
describe('buildCustomerProfile - early-return contracts', () => {
    it('returns null for an empty userId WITHOUT any supabase calls', async () => {
        const result = await buildCustomerProfile('');
        expect(result).toBeNull();
        expect(mockSupabase.fromSpy).not.toHaveBeenCalled();
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('returns null when an inner query throws (outer try/catch swallows)', async () => {
        // The Promise.all rejects on the first rejected chain; the function's
        // outer try/catch in buildCustomerProfile swallows it and returns null.
        mockSupabase.setOutcomes([
            { kind: 'reject', error: new Error('rls denied') },
        ]);
        const result = await buildCustomerProfile(AUTH_USER_ID);
        expect(result).toBeNull();
    });
});

// ============================================================================
// 2. MetaMask partial-profile path
// ============================================================================
describe('buildCustomerProfile - MetaMask partial profile', () => {
    it('returns a partial profile for MetaMask users WITHOUT calling supabase', async () => {
        // 5 Promise.resolve() shortcuts inside Promise.all mean ZERO from() calls.
        mockSupabase.setOutcomes([]);

        const result = await buildCustomerProfile(META_MASK_USER_ID);

        expect(result).not.toBeNull();
        expect(result!.userId).toBe(META_MASK_USER_ID);
        expect(result!.walletAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
        expect(result!.displayName).toContain('Wallet');

        // All profile-derived fields are zeroed for MetaMask users because
        // there is no profiles row.
        expect(result!.isVIP).toBe(false);
        expect(result!.storeCredit).toBe(0);
        expect(result!.sgCoinBalance).toBe(0);
        expect(result!.lifetimeSpendUsd).toBe(0);
        expect(result!.lifetimeOrders).toBe(0);
        expect(result!.customerNotes).toBeNull();
        expect(result!.referralCode).toBeNull();
        expect(result!.referralStats).toBeNull();
        expect(result!.orderCount).toBe(0);
        expect(result!.totalSpend).toBe(0);
        expect(result!.firstOrderDate).toBeNull();
        expect(result!.lastOrderDate).toBeNull();
        expect(result!.favoriteCategories).toEqual([]);
        expect(result!.socialAccounts).toEqual([]);

        // NEW (2026-07-16): payout fields are zeroed defaults for MetaMask (no DB rows).
        expect(result!.payoutStats.totalRequested).toBe(0);
        expect(result!.payoutStats.pendingCount).toBe(0);
        expect(result!.payoutStats.completedCount).toBe(0);
        expect(result!.payoutStats.rejectedCount).toBe(0);
        expect(result!.payoutStats.lastStatus).toBeNull();
        expect(result!.payoutStats.lastAmount).toBeNull();
        expect(result!.payoutStats.lastDate).toBeNull();
        expect(result!.payoutRequests).toEqual([]);

        // CRITICAL: zero from() calls fired (the early short-circuit).
        expect(mockSupabase.fromSpy).not.toHaveBeenCalled();
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});

// ============================================================================
// 3. Authenticated user aggregation
// ============================================================================
describe('buildCustomerProfile - authenticated user aggregation', () => {
    it('aggregates a full profile (VIP, store credit, totals, socials, referral code, payouts)', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: PROFILE_ROW, error: null } },        // 1) profiles
            { kind: 'resolve', value: { data: ORDERS_MIXED, error: null } },          // 2) orders
            { kind: 'resolve', value: { data: SOCIAL_ROWS, error: null } },           // 3) socials
            { kind: 'resolve', value: { data: REFERRAL_ROW, error: null } },          // 4) referral_stats
            { kind: 'resolve', value: { data: [], error: null } },                     // 5) payouts (none)
        ]);

        const result = await buildCustomerProfile(AUTH_USER_ID);

        expect(result).toBeTruthy();
        // Profile-derived fields (from outcome[0]).
        expect(result!.isVIP).toBe(true);
        expect(result!.storeCredit).toBe(50.0);
        expect(result!.sgCoinBalance).toBe(1000);
        expect(result!.lifetimeSpendUsd).toBe(250);
        expect(result!.lifetimeOrders).toBe(5);
        expect(result!.customerNotes).toBe('VIP since 2026');
        // Order-derived fields (from outcome[1]): filter drops cancelled/failed.
        expect(result!.orderCount).toBe(3);
        expect(result!.totalSpend).toBe(350);
        // Social-derived fields (from outcome[2]).
        expect(result!.socialAccounts).toEqual([
            { platform: 'instagram', username: 'coolbuyer', verified: true },
            { platform: 'twitter', username: 'coolbuyer_x', verified: false },
        ]);
        // Referral-derived fields (from outcome[3]).
        expect(result!.referralCode).toBe('SG-ABC123');
        expect(result!.referralStats).toEqual({
            totalReferrals: 3, successfulReferrals: 1, totalEarnings: 15, currentTier: 2,
        });
        // NEW: payout fields default to zero/empty when outcome[4] is [].
        expect(result!.payoutRequests).toEqual([]);
        expect(result!.payoutStats.totalRequested).toBe(0);
        expect(result!.payoutStats.lastStatus).toBeNull();

        // NEW: fromSpy count is now 5 (was 4 pre-payouts).
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(5);
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('sgcoin_payout_requests');
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('drops cancelled / failed / refunded / pending orders from orderCount + totalSpend', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: PROFILE_ROW, error: null } },
            { kind: 'resolve', value: { data: ORDERS_MIXED, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        const result = await buildCustomerProfile(AUTH_USER_ID);

        // ORDERS_MIXED has 3 paid + 1 cancelled + 1 failed. Only 3 counted.
        expect(result!.orderCount).toBe(3);
        // Sum of paid: 100 + 200 + 50 = 350. Failed (999) excluded.
        expect(result!.totalSpend).toBe(350);
        // oldest paid = ord-shipped-3 (2026-05-01)
        expect(result!.firstOrderDate).toBe('2026-05-01T14:00:00Z');
        // newest paid = ord-paid-1 (2026-07-10)
        expect(result!.lastOrderDate).toBe('2026-07-10T12:00:00Z');
    });

    it('computes favoriteCategories from items array, sorted by frequency desc, top 5', async () => {
        // Counts across the 7 orders:
        //   pA = 3 (o1, o2, o3)
        //   pF = 2 (o6, o7)
        //   pB = 2 (o1, o4)
        //   pC = 2 (o2, o5)
        //   pD = 1 (o6)
        //   pE = 1 (o6)
        //   pG = 1 (o7)
        // Map insertion order (first-seen-wins tie): pA, pB, pC, pD, pE, pF, pG.
        // After stable sort by count desc and slice(0,5):
        //   ['pA', 'pB', 'pC', 'pF', 'pD']
        // (pB, pC, pF are 3-way tied at count 2; insertion order yields pB, pC, pF.)
        const ordersForFreq = [
            { id: 'o1', total: 10, created_at: '2026-01-01', payment_status: 'paid', user_id: AUTH_USER_ID, items: [{ productId: 'pA' }, { productId: 'pB' }] },
            { id: 'o2', total: 20, created_at: '2026-02-01', payment_status: 'paid', user_id: AUTH_USER_ID, items: [{ productId: 'pA' }, { productId: 'pC' }] },
            { id: 'o3', total: 30, created_at: '2026-03-01', payment_status: 'paid', user_id: AUTH_USER_ID, items: [{ productId: 'pA' }] },
            { id: 'o4', total: 40, created_at: '2026-04-01', payment_status: 'paid', user_id: AUTH_USER_ID, items: [{ productId: 'pB' }] },
            { id: 'o5', total: 50, created_at: '2026-05-01', payment_status: 'paid', user_id: AUTH_USER_ID, items: [{ productId: 'pC' }] },
            { id: 'o6', total: 60, created_at: '2026-06-01', payment_status: 'paid', user_id: AUTH_USER_ID, items: [{ productId: 'pD' }, { productId: 'pE' }, { productId: 'pF' }] },
            { id: 'o7', total: 70, created_at: '2026-07-01', payment_status: 'paid', user_id: AUTH_USER_ID, items: [{ productId: 'pF' }, { productId: 'pG' }] },
        ];

        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: ordersForFreq, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        const result = await buildCustomerProfile(AUTH_USER_ID);

        // Length 5 (slice(0, 5)).
        expect(result!.favoriteCategories.length).toBe(5);
        // pA is the unambiguous top with count 3.
        expect(result!.favoriteCategories[0]).toBe('pA');
        // Entries 1-4 (the four "rest" slots after pA): pB, pC, pF are all
        // tied at count 2 in their Map insertion order; pD slips in as the
        // best of the count-1 entries.
        expect(result!.favoriteCategories.slice(1)).toEqual(['pB', 'pC', 'pF', 'pD']);
        // Sanity check on the lowest-frequency entry that snuck into the top 5.
        expect(result!.favoriteCategories[4]).toBe('pD');
        // Identical input -> identical aggregation so the assertion order is locked.
        expect(result!.favoriteCategories).toEqual(['pA', 'pB', 'pC', 'pF', 'pD']);
    });

    it('handles missing socials + missing referral_stats rows gracefully ([] + null)', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: PROFILE_ROW, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },          // no orders
            { kind: 'resolve', value: { data: null, error: null } },         // no socials
            { kind: 'resolve', value: { data: null, error: null } },         // no referral_stats
            { kind: 'resolve', value: { data: [], error: null } },            // no payouts
        ]);

        const result = await buildCustomerProfile(AUTH_USER_ID);

        expect(result).toBeTruthy();
        expect(result!.socialAccounts).toEqual([]);
        expect(result!.referralStats).toBeNull();
        expect(result!.referralCode).toBeNull();
        expect(result!.orderCount).toBe(0);
        expect(result!.totalSpend).toBe(0);
        expect(result!.favoriteCategories).toEqual([]);
        expect(result!.firstOrderDate).toBeNull();
        expect(result!.lastOrderDate).toBeNull();
    });
});

// ============================================================================
// 4. Idempotency
// ============================================================================
describe('buildCustomerProfile - idempotency', () => {
    it('two back-to-back calls with same input produce identical shapes (10 from() calls)', async () => {
        mockSupabase.setOutcomes([
            // First invocation (5 outcomes).
            { kind: 'resolve', value: { data: PROFILE_ROW, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            // Second invocation (5 outcomes, identical shape).
            { kind: 'resolve', value: { data: PROFILE_ROW, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        const first = await buildCustomerProfile(AUTH_USER_ID);
        const second = await buildCustomerProfile(AUTH_USER_ID);

        expect(first).toBeTruthy();
        expect(second).toBeTruthy();

        // Both calls must produce identical shape and values.
        expect(second!.isVIP).toBe(first!.isVIP);
        expect(second!.storeCredit).toBe(first!.storeCredit);
        expect(second!.lifetimeSpendUsd).toBe(first!.lifetimeSpendUsd);
        expect(second!.lifetimeOrders).toBe(first!.lifetimeOrders);
        expect(second!.orderCount).toBe(first!.orderCount);
        expect(second!.totalSpend).toBe(first!.totalSpend);
        expect(second!.socialAccounts).toEqual(first!.socialAccounts);
        expect(second!.referralStats).toEqual(first!.referralStats);
        // NEW (2026-07-16): payout fields lock the same shape across the 2 calls.
        expect(second!.payoutStats).toEqual(first!.payoutStats);
        expect(second!.payoutRequests).toEqual(first!.payoutRequests);

        // Each call made 5 from() queries -> 10 total (was 8 pre-payouts).
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(10);
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});

// ============================================================================
// 5. Defensive `|| N` defaults on sparse referral_stats
// ============================================================================
describe('buildCustomerProfile - defensive defaults on sparse referral_stats', () => {
    it('fills defensive defaults when only referral_code is populated (other fields absent)', async () => {
        // The referral_stats row from Supabase is sparse — only referral_code
        // is populated. The four numerically-defaulted sibling fields
        // (`current_tier`, `total_earnings`, `total_referrals`,
        // `successful_referrals`) MUST fall back to their defensive defaults
        // so the /admin UI never renders NaN / null in slots that demand an
        // integer. Without this lock, a future refactor that drops a `|| N`
        // guard would let `undefined` leak into:
        //   - currentTier: column type is number; React renders NaN
        //   - totalEarnings / totalReferrals / successfulReferrals: same NaN risk
        //   - the AdminCustomerProfile `Tier N` markdown becomes "Tier undefined".
        // The `current_tier | 1` fallback is the load-bearing one because
        // the SQL v2 trigger is the authoritative source for tier — a row
        // without it is a real post-migration-drift failure mode.
        const sparseReferralStats = {
            referral_code: 'SG-NEW01',
            // current_tier, total_earnings, total_referrals, successful_referrals all NOT present.
        };

        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: PROFILE_ROW, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: sparseReferralStats, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        const result = await buildCustomerProfile(AUTH_USER_ID);

        expect(result).toBeTruthy();
        // The one populated field passes through unchanged.
        expect(result!.referralCode).toBe('SG-NEW01');
        expect(result!.referralStats).not.toBeNull();
        // The two user-specified defensive defaults — current_tier | 1, total_earnings | 0.
        expect(result!.referralStats!.currentTier).toBe(1);
        expect(result!.referralStats!.totalEarnings).toBe(0);
        // The co-located defensive defaults in the same `referralStats ? { ... } : null` branch.
        expect(result!.referralStats!.totalReferrals).toBe(0);
        expect(result!.referralStats!.successfulReferrals).toBe(0);

        // No extra defensive-default math leaked into the outer profile fields.
        expect(result!.orderCount).toBe(0);
        expect(result!.totalSpend).toBe(0);
        expect(result!.socialAccounts).toEqual([]);

        // NEW (2026-07-16): now 5 from() calls per buildCustomerProfile.
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(5);
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});

// ============================================================================
// 6. Guest-by-email lookup (buildCustomerProfileByEmail)
// ============================================================================
describe('buildCustomerProfileByEmail - guest buyer lookup', () => {
    it('returns isVerifiedBuyer=false when no orders exist for the email', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        const result = await buildCustomerProfileByEmail(GUEST_EMAIL);

        expect(result.email).toBe(GUEST_EMAIL);
        expect(result.orderCount).toBe(0);
        expect(result.totalSpend).toBe(0);
        expect(result.isVerifiedBuyer).toBe(false);
        expect(result.firstOrderDate).toBeNull();
        expect(result.lastOrderDate).toBeNull();
    });

    it('returns isVerifiedBuyer=true and aggregates only paid orders for an email with mixed-status orders', async () => {
        mockSupabase.setOutcomes([
            {
                kind: 'resolve', value: {
                    data: [
                        { id: 'g1', total: 75, created_at: '2026-06-01T00:00:00Z', payment_status: 'paid' },
                        { id: 'g2', total: 25, created_at: '2026-05-01T00:00:00Z', payment_status: 'shipped' },
                        { id: 'g3', total: 999, created_at: '2026-04-01T00:00:00Z', payment_status: 'failed' }, // dropped
                    ],
                    error: null,
                },
            },
        ]);

        const result = await buildCustomerProfileByEmail(GUEST_EMAIL);

        expect(result.orderCount).toBe(2);
        expect(result.totalSpend).toBe(100); // 75 + 25, 999 dropped
        expect(result.isVerifiedBuyer).toBe(true);
        // Orders are sorted desc by created_at in the implementation, so
        // firstOrderDate is the OLDEST paid -> ord-shipped (2026-05-01).
        expect(result.firstOrderDate).toBe('2026-05-01T00:00:00Z');
        // lastOrderDate is the NEWEST paid -> ord-paid (2026-06-01).
        expect(result.lastOrderDate).toBe('2026-06-01T00:00:00Z');
    });
});

// ============================================================================
// 7. NEW (2026-07-16): SGCoin payout aggregation
// ============================================================================
describe('buildCustomerProfile - SGCoin payout aggregation', () => {

    it('with 1 completed payout row: populates payoutRequests + payoutStats with completedCount=1 + totalRequested=8000 + last fields reflect the row', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: PROFILE_ROW, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: [COMPLETED_PAYOUT_ROW], error: null } },
        ]);

        const result = await buildCustomerProfile(AUTH_USER_ID);

        expect(result).toBeTruthy();

        // Raw rows: 1 entry, camelCase mapped from snake_case.
        expect(result!.payoutRequests).toHaveLength(1);
        expect(result!.payoutRequests![0]).toMatchObject({
            id: 'pr-comp-1',
            userId: AUTH_USER_ID,
            status: 'completed',
            amount: 8000,
            walletAddress: COMPLETED_PAYOUT_ROW.wallet_address,
            txHash: COMPLETED_PAYOUT_ROW.tx_hash,
            rejectionReason: null,
            adminNotes: 'Processed via Polygon',
            createdAt: '2026-07-15T10:00:00Z',
            processedAt: '2026-07-16T08:00:00Z',
        });

        // Aggregates.
        expect(result!.payoutStats.totalRequested).toBe(8000);
        expect(result!.payoutStats.pendingCount).toBe(0);
        expect(result!.payoutStats.completedCount).toBe(1);
        expect(result!.payoutStats.rejectedCount).toBe(0);
        expect(result!.payoutStats.lastStatus).toBe('completed');
        expect(result!.payoutStats.lastAmount).toBe(8000);
        expect(result!.payoutStats.lastDate).toBe('2026-07-15T10:00:00Z');

        // from() spy count + assertion that we DID query the payouts table.
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(5);
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('sgcoin_payout_requests');
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('with 1 rejected payout row: populates payoutRequests + payoutStats with rejectedCount=1 + rejectionReason preserved', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: [REJECTED_PAYOUT_ROW], error: null } },
        ]);

        const result = await buildCustomerProfile(AUTH_USER_ID);

        expect(result).toBeTruthy();

        expect(result!.payoutRequests).toHaveLength(1);
        expect(result!.payoutRequests![0]).toMatchObject({
            id: 'pr-rej-1',
            status: 'rejected',
            amount: 5000,
            rejectionReason: 'Wallet address could not be verified',
            txHash: null,
        });

        // Aggregates.
        expect(result!.payoutStats.totalRequested).toBe(5000);
        expect(result!.payoutStats.pendingCount).toBe(0);
        expect(result!.payoutStats.completedCount).toBe(0);
        expect(result!.payoutStats.rejectedCount).toBe(1);
        expect(result!.payoutStats.lastStatus).toBe('rejected');
        expect(result!.payoutStats.lastAmount).toBe(5000);
        expect(result!.payoutStats.lastDate).toBe('2026-07-10T12:00:00Z');

        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(5);
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('with payoutsRes.data === null (RLS denied / zero-row): falls back to empty payoutRequests + zeroed payoutStats via the `|| []` guard', async () => {
        // The other tests use `data: []` or `data: [row]` — this one locks
        // the `null` case which is the shape that flows through when a Supabase
        // query resolves to no rows under maybeSingle / single semantics. If
        // a future refactor drops the `|| []` fallback, this test red-flags
        // the change by forcing a runtime TypeError on `.map(null)`.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: null, error: null } }, // *** payoutsRes.data === null
        ]);

        const result = await buildCustomerProfile(AUTH_USER_ID);

        expect(result).toBeTruthy();
        expect(result!.payoutRequests).toEqual([]);
        expect(result!.payoutStats.totalRequested).toBe(0);
        expect(result!.payoutStats.pendingCount).toBe(0);
        expect(result!.payoutStats.completedCount).toBe(0);
        expect(result!.payoutStats.rejectedCount).toBe(0);
        expect(result!.payoutStats.lastStatus).toBeNull();
        expect(result!.payoutStats.lastAmount).toBeNull();
        expect(result!.payoutStats.lastDate).toBeNull();

        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(5);
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});
