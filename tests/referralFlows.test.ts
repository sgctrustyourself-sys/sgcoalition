// tests/referralFlows.test.ts
//
// REGRESSION CATCH: locks the contracts of three referral/profile flow
// helpers added during the 2026-07-14 disconnection-fix pass:
//
//   1. utils/referralSystem.processReferralOnPurchase
//      \— idempotent: completed/paid referral for (referrer, buyer) skips.
//   2. utils/referralSystem.trackSignupReferral
//      \— duplicate guard: pending referral for (referrer, buyer) skips.
//   3. utils/customerProfile.updateLifetimeStats
//      \— increments profiles.lifetime_spend_usd + lifetime_orders.
//
// Each describe block is its own contract; the tests use setOutcomes
// queues to control the precise interleaving of supabase.from() and
// supabase.rpc() awaits, and getRemainingOutcomes() to assert that an
// early-return path consumed no additional database roundtrips.
//
// Mocking strategy:
//   - mockSupabase singleton from tests/_helpers/supabaseClientMock.ts.
//   - vi.mock('../services/supabase') wires the singleton's stable .client.
//   - Local analytics helper `trackReferralEvent` calls supabase.rpc, so
//     the rpcSpy + rpcThenable path added in the mock helper is essential;
//     the referrer-stats + referral rows are read via the chainable from().

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { processReferralOnPurchase, trackSignupReferral } from '../utils/referralSystem';
import { updateLifetimeStats } from '../utils/customerProfile';

vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));

// Synthetic fixtures reused across describe blocks.
const REFERRER_ID = 'ref-uuid-referrer';
const REFERRER_STATS = {
    user_id: REFERRER_ID,
    referral_code: 'SG-CODE01',
    total_referrals: 0,
    successful_referrals: 0,
    current_tier: 1,
    current_commission_rate: 5,
    total_earnings: 0,
    pending_earnings: 0,
    paid_earnings: 0,
    updated_at: '2026-07-16T00:00:00Z',
};

const BUYER_ID = 'buyer-uuid-001';
const ORDER_ID = 'order-test-001';

// Suppress the spammy console.log / console.error that these helpers emit
// so test output stays quiet \— same pattern as retryQueue.test.ts.
beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset the mockSupabase singleton's outcome queue so tests can't inherit
    // leftover state from a prior test's `setOutcomes(...)`. Tests still
    // overwrite the queue at the top of their body, so this is purely a safety
    // net — a future test that forgets to call `setOutcomes` would see the
    // empty default resolve `{ data: null, error: null }` instead of mystery
    // carries from the previous describe or case.
    mockSupabase.setOutcomes([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ============================================================================
// 1. processReferralOnPurchase - idempotency contract
// ============================================================================
describe('processReferralOnPurchase - idempotency', () => {
    it('SKIPS when a COMPLETED referral already exists for (referrer, buyer)', async () => {
        // Outcome queue:
        //   1) getReferralStatsByCode      -> returns referrer stats
        //   2) existing completed/paid     -> returns {status:'completed'}
        //   EARLY RETURN => no trackReferral, no completeReferral,
        //                  no updateReferralStats. Queue should be empty.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: REFERRER_STATS, error: null } },
            { kind: 'resolve', value: { data: { id: 'ref-existing-completed', status: 'completed' }, error: null } },
        ]);

        const result = await processReferralOnPurchase('SG-CODE01', BUYER_ID, ORDER_ID, 100);

        expect(result.success).toBe(false);
        // CRITICAL: queue exhausted means NO further from() calls fired.
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        // Two from() calls: stats + completed/paid check. NO insert, NO update.
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(2);
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
        expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
        // The completed/paid check uses .in('status', ['completed','paid']).
        expect(mockSupabase.inSpy).toHaveBeenCalledWith('status', ['completed', 'paid']);
    });

    it('SKIPS when a PAID referral already exists for (referrer, buyer)', async () => {
        // Same shape as above, but the existing row is 'paid'. The .in() filter
        // accepts both 'completed' and 'paid', so the skip path is identical.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: REFERRER_STATS, error: null } },
            { kind: 'resolve', value: { data: { id: 'ref-existing-paid', status: 'paid' }, error: null } },
        ]);

        const result = await processReferralOnPurchase('SG-CODE01', BUYER_ID, ORDER_ID, 100);

        expect(result.success).toBe(false);
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(2);
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
        expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
    });

    it('USES the existing PENDING referral instead of creating a new one', async () => {
        // Outcome queue:
        //   1) stats fetch
        //   2) completed/paid check -> null (no completed/paid)
        //   3) pending check -> returns existing pending id (NO trackReferral)
        //   4) completeReferral select (referrals by id with inner join)
        //   5) completeReferral update (referrals status=completed)
        //   6) updateReferralStats select (referrals by status)
        //   7) updateReferralStats update (referral_stats earnings)
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: REFERRER_STATS, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: { id: 'ref-existing-pending' }, error: null } },
            { kind: 'resolve', value: { data: { id: 'ref-existing-pending', referrer_id: REFERRER_ID, referral_stats: REFERRER_STATS }, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
        ]);

        const result = await processReferralOnPurchase('SG-CODE01', BUYER_ID, ORDER_ID, 100);

        // Success returns the commissionEarned figure from completeReferral.
        expect(result.success).toBe(true);
        expect(result.commissionEarned).toBe(5); // 5% of $100 = $5
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        // 3 lookups + 4 mutations = 7 from() calls. No INSERT because pending
        // row already existed (duplicate guard prevents over-incrementing
        // total_referrals when the pending row was created at signup time).
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(7);
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
        expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(2);

        // HARDENED: pin the completeReferral UPDATE payload contract.
        // Use `find` on payload shape (NOT hardcoded call index) so the test stays
        // valid even if the internal call order shifts between completeReferral and
        // updateReferralStats. Distinct payload keys are the discriminators:
        //   - completeReferral.update(referrals, { order_*, commission_*, status='completed', completed_at })
        //   - updateReferralStats.update(referral_stats, { earnings_* })
        const completeReferralUpdate = mockSupabase.updateSpy.mock.calls.find(
            (c) => Array.isArray(c) && c[0] && typeof c[0] === 'object' && 'order_id' in c[0]
        );
        const statsUpdate = mockSupabase.updateSpy.mock.calls.find(
            (c) => Array.isArray(c) && c[0] && typeof c[0] === 'object' && 'pending_earnings' in c[0]
        );

        // Use `toEqual` (strict) so adding an extra field to the payload fails the
        // test. `toMatchObject` would silently accept extras and let the contract
        // drift without a CI failure.
        expect(completeReferralUpdate?.[0]).toEqual({
            order_id: ORDER_ID,
            order_total: 100,
            commission_earned: 5,
            commission_rate: 5, // REFERRER_STATS.current_commission_rate
            status: 'completed',
            completed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        });

        // Sanity: updateReferralStats does NOT mix in any of these fields, so the
        // strict `toEqual` above can't accidentally match the stats UPDATE.
        expect(statsUpdate?.[0]).not.toHaveProperty('order_id');
        expect(statsUpdate?.[0]).not.toHaveProperty('commission_earned');
        expect(statsUpdate?.[0]).not.toHaveProperty('completed_at');
    });

    it('CREATES a new pending referral + completes it when no existing row', async () => {
        // Outcome queue:
        //   1) initial stats fetch
        //   2) completed/paid check -> null
        //   3) pending check -> null
        //   4) trackReferral: gets stats (recount)
        //   5) trackReferral: insert referrals (returns new id)
        //   6) trackReferral: update referral_stats total_referrals
        //   7) completeReferral: select with inner join
        //   8) completeReferral: update referrals status=completed
        //   9) updateReferralStats: select by status
        //  10) updateReferralStats: update referral_stats earnings
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: REFERRER_STATS, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: REFERRER_STATS, error: null } },
            { kind: 'resolve', value: { data: { id: 'ref-new', referrer_id: REFERRER_ID, referred_user_id: BUYER_ID, status: 'pending' }, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: { id: 'ref-new', referrer_id: REFERRER_ID, referral_stats: REFERRER_STATS }, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
        ]);

        const result = await processReferralOnPurchase('SG-CODE01', BUYER_ID, ORDER_ID, 100);

        expect(result.success).toBe(true);
        expect(result.commissionEarned).toBe(5);
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        // 3 lookups + trackReferral(3) + completeReferral(4) = 10 from() calls.
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(10);
        // INSERT fired exactly once (trackReferral creates the pending row).
        expect(mockSupabase.insertSpy).toHaveBeenCalledTimes(1);
        expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(3);

        // HARDENED: pin the completeReferral UPDATE payload via payload-shape
        // (find), not call index. This path runs THREE UPDATEs:
        //   - trackReferral.update(referral_stats, { total_referrals })
        //   - completeReferral.update(referrals, { order_*, commission_*, status='completed', completed_at })
        //   - updateReferralStats.update(referral_stats, { earnings_* })
        // The order_id key uniquely identifies completeReferral.
        const completeReferralUpdate = mockSupabase.updateSpy.mock.calls.find(
            (c) => Array.isArray(c) && c[0] && typeof c[0] === 'object' && 'order_id' in c[0]
        );
        expect(completeReferralUpdate?.[0]).toEqual({
            order_id: ORDER_ID,
            order_total: 100,
            commission_earned: 5,
            commission_rate: 5, // REFERRER_STATS.current_commission_rate
            status: 'completed',
            completed_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
        });
    });

    it('returns success:false on self-referral (referrer_id === buyerUserId)', async () => {
        // Only 1 from() call before the guard fires (stats fetch).
        const selfReferralStats = { ...REFERRER_STATS, user_id: BUYER_ID };
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: selfReferralStats, error: null } },
        ]);

        const result = await processReferralOnPurchase('SG-CODE01', BUYER_ID, ORDER_ID, 100);

        expect(result.success).toBe(false);
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
    });

    it('returns success:false when the referral code has no matching stats row', async () => {
        // Only 1 from() call (stats returns null, early return).
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: new Error('PGRST116') } },
        ]);

        const result = await processReferralOnPurchase('SG-DELETED', BUYER_ID, ORDER_ID, 100);

        expect(result.success).toBe(false);
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
        expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
    });
});

// ============================================================================
// 2. trackSignupReferral - duplicate guard contract
// ============================================================================
//
// Every test below MUST start the queue with an rpc outcome because
// trackReferralEvent (called first inside trackSignupReferral) uses
// supabase.rpc('track_referral_event', ...). If the rpc outcome is missing
// the chain will resolve with the empty default { data: null, error: null }
// and the test will pass spuriously for the wrong reason.
//
// TrackSignupReferral contract:
//   1) fires rpc('track_referral_event') for analytics (always)
//   2) getReferralStatsByCode from()
//   3) if no stats || self-referral => EARLY RETURN (2 outcomes consumed)
//   4) existing pending from() => if exists, EARLY RETURN (3 outcomes)
//   5) else => trackReferral which is 3 more from() calls (6 total)
describe('trackSignupReferral - duplicate guard', () => {
    it('SKIPS trackReferral when a PENDING referral already exists for (referrer, buyer)', async () => {
        // Outcomes:
        //   1) rpc track_referral_event     -> ok
        //   2) getReferralStatsByCode      -> stats
        //   3) pending check (referrals)    -> returns EXISTING pending row
        //   EARLY RETURN: no trackReferral.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: REFERRER_STATS, error: null } },
            { kind: 'resolve', value: { data: { id: 'ref-existing-pending-signup' }, error: null } },
        ]);

        await trackSignupReferral('SG-CODE01', BUYER_ID);

        // CRITICAL: only the 3 outcomes consumed. trackReferral's 3
        // from() calls (stats recurse + insert + update) MUST NOT fire.
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledTimes(1);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('track_referral_event', expect.objectContaining({
            p_referral_code: 'SG-CODE01',
            p_event_type: 'signup',
            p_user_id: BUYER_ID,
        }));
        // The duplicate guard fires BEFORE trackReferral: only 2 from()
        // calls (stats + pending check). NO insert, NO referral_stats update.
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(2);
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
        expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
        // The duplicate guard's filter chain: referrer_id, referred_user_id, status='pending'.
        expect(mockSupabase.eqSpy).toHaveBeenCalledWith('referrer_id', REFERRER_ID);
        expect(mockSupabase.eqSpy).toHaveBeenCalledWith('referred_user_id', BUYER_ID);
        expect(mockSupabase.eqSpy).toHaveBeenCalledWith('status', 'pending');
    });

    it('CALLS trackReferral when no existing pending row exists', async () => {
        // Outcomes:
        //   1) rpc track_referral_event     -> ok
        //   2) getReferralStatsByCode      -> stats
        //   3) pending check               -> null (no existing pending)
        //   4) trackReferral: stats re-fetch
        //   5) trackReferral: insert referrals -> new row
        //   6) trackReferral: update referral_stats total_referrals
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: REFERRER_STATS, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: REFERRER_STATS, error: null } },
            { kind: 'resolve', value: { data: { id: 'ref-newly-tracked', referrer_id: REFERRER_ID, referred_user_id: BUYER_ID, status: 'pending' }, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
        ]);

        await trackSignupReferral('SG-CODE01', BUYER_ID);

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledTimes(1);
        // 2 from() calls before trackReferral (stats + pending check) +
        // 3 from() calls inside trackReferral (stats + insert + update).
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(5);
        // trackReferral's insert fired exactly once.
        expect(mockSupabase.insertSpy).toHaveBeenCalledTimes(1);
        // trackReferral's update of total_referrals fired exactly once.
        expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(1);
    });

    it('SKIPS after stats fetch when referrer_id === userId (self-referral guard)', async () => {
        // Outcomes:
        //   1) rpc track_referral_event  -> ok (always fires before stats check)
        //   2) getReferralStatsByCode    -> returns stats where user_id === buyer
        //   EARLY RETURN (no pending check, no trackReferral).
        const selfStats = { ...REFERRER_STATS, user_id: BUYER_ID };
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: selfStats, error: null } },
        ]);

        await trackSignupReferral('SG-CODE01', BUYER_ID);

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledTimes(1);
        // Self-referral guard fires AFTER stats, so only 1 from() call.
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
        // The pending-check from() MUST NOT fire.
        expect(mockSupabase.maybeSingleSpy).not.toHaveBeenCalled();
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
    });

    it('SKIPS after stats fetch when no referrer stats row exists for the code', async () => {
        // Outcomes:
        //   1) rpc track_referral_event  -> ok
        //   2) getReferralStatsByCode    -> null (no row for SG-DELETED)
        //   EARLY RETURN (no pending check, no trackReferral).
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: null, error: new Error('PGRST116') } },
        ]);

        await trackSignupReferral('SG-DELETED', BUYER_ID);

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledTimes(1);
        // Missing-stats guard: only 1 from() call. No pending check.
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
        expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
    });

    it('silently swallows errors thrown by trackReferral (does not rethrow)', async () => {
        // The analytics rpc throws. The function catches and logs, no rethrow.
        mockSupabase.setOutcomes([
            { kind: 'reject', error: new Error('rpc transport failure') },
        ]);

        // Must NOT throw \— the function's try/catch compromises gracefully.
        await expect(trackSignupReferral('SG-CODE01', BUYER_ID)).resolves.toBeUndefined();
        // After the rpc rejection, the function early-returns from the catch.
        // (The original closure in AppContext kept the same contract.)
    });
});

// ============================================================================
// 3. updateLifetimeStats - increment logic contract
// ============================================================================
describe('updateLifetimeStats - increment logic', () => {
    it('READS current values then WRITES incremented values', async () => {
        // Two outcomes: SELECT then UPDATE.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: { lifetime_spend_usd: 250, lifetime_orders: 5 }, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
        ]);

        await updateLifetimeStats(BUYER_ID, 75);

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(2);
        expect(mockSupabase.fromSpy).toHaveBeenNthCalledWith(1, 'profiles');
        expect(mockSupabase.fromSpy).toHaveBeenNthCalledWith(2, 'profiles');
        // SELECT .eq('id', userId)
        expect(mockSupabase.selectSpy).toHaveBeenCalledWith('lifetime_spend_usd, lifetime_orders');
        expect(mockSupabase.eqSpy).toHaveBeenCalledWith('id', BUYER_ID);
        // UPDATE writes (250 + 75 = 325 spend, 5 + 1 = 6 orders).
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({
            lifetime_spend_usd: 325,
            lifetime_orders: 6,
        });
    });

    it('treats a MISSING profile row as zero baseline (still increments correctly)', async () => {
        // No profile row yet -> SELECT returns null. The function reads
        // (0 || 0) and writes (0 + order) and (0 + 1).
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
        ]);

        await updateLifetimeStats('brand-new-user-uuid', 42.50);

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({
            lifetime_spend_usd: 42.50,
            lifetime_orders: 1,
        });
    });

    it('SKIPS entirely for a MetaMask user (userId starts with user_eth_)', async () => {
        // No outcomes. The function returns before any database call.
        mockSupabase.setOutcomes([]);

        await updateLifetimeStats('user_eth_0x1234abcd5678ef901234567890abcdef12345678', 1000);

        // CRITICAL: no from() calls fired (no SELECT, no UPDATE).
        expect(mockSupabase.fromSpy).not.toHaveBeenCalled();
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
        expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
    });

    it('SKIPS entirely for an empty / null userId', async () => {
        // No outcomes.
        mockSupabase.setOutcomes([]);

        await updateLifetimeStats('', 100);

        expect(mockSupabase.fromSpy).not.toHaveBeenCalled();
        expect(mockSupabase.updateSpy).not.toHaveBeenCalled();

        // Also test null.
        await updateLifetimeStats(null as unknown as string, 100);
        expect(mockSupabase.fromSpy).not.toHaveBeenCalled();
        expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
    });

    it('silently returns when the SELECT itself returns an error', async () => {
        // Two outcomes queued but only the first is consumed: SELECT throws,
        // function logs and returns, so the UPDATE outcome is never consumed.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: new Error('rls policy violation') } },
            { kind: 'resolve', value: { data: null, error: null } }, // never consumed
        ]);

        await updateLifetimeStats(BUYER_ID, 100);

        // No UPDATE write fired \— SELECT error short-circuits the increment.
        expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
        // Only the SELECT fired (1 from() call), UPDATE was never attempted.
        expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
        // The queued UPDATE outcome remains (proves the function never advanced).
        expect(mockSupabase.getRemainingOutcomes()).toBe(1);
    });

    it('silently returns when the UPDATE itself returns an error', async () => {
        // Both outcomes consumed. UPDATE failed. Function logs and returns;
        // we do NOT throw.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: { lifetime_spend_usd: 50, lifetime_orders: 2 }, error: null } },
            { kind: 'resolve', value: { data: null, error: new Error('network blip') } },
        ]);

        await expect(updateLifetimeStats(BUYER_ID, 25)).resolves.toBeUndefined();

        // Function still attempted the UPDATE (1 update call) but did not throw.
        expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(1);
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});
