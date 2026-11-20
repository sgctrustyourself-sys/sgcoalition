// tests/trackReferralEvent.test.ts
//
// REGRESSION CATCH: locks the rpc() contract that utils/referralAnalytics.trackReferralEvent
// uses to record click / view / signup / purchase analytics events into Supabase.
// The RPC name + 6-key param shape are the only thing the supabase/migrations/*.sql
// `track_referral_event` SQL function sees from the client, so any drift in the
// argument names or types breaks the analytics pipeline silently.
//
// Event types (all four route to the same RPC, just different p_event_type):
//   * click    \u2014 cold-open of ?ref=CODE
//   * view     \u2014 page that contains a referral link rendered
//   * signup   \u2014 new user authenticated with stored ?ref=CODE
//   * purchase \u2014 buyer completed checkout with referral code
//
// Mock strategy (mirrors tests/referralFlows.test.ts):
//   * mockSupabase singleton from tests/_helpers/supabaseClientMock.ts (rpcSpy +
//     rpcThenable added in the prior task).
//   * vi.mock('../services/supabase') wires the singleton's stable .client.
//   * rpcSpy reads from THE SAME outcomes queue as from() chains \u2014 so
//     setOutcomes() controls rpc resolution/rejection for these tests.
//   * Empty queue + one rpc call => resolves { data: null, error: null }
//     (since rpcThenable coalesces empty queue shifts to a default success).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { trackReferralEvent } from '../utils/referralAnalytics';

vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));

const REFERRAL_CODE = 'SG-TESTCODE';
const USER_ID = 'user-uuid-abc';

beforeEach(() => {
    vi.clearAllMocks();
    // Each test starts with an empty outcomes queue so the rpc default
    // resolves to a success unless the test explicitly queues a reject /
    // server-error outcome via setOutcomes().
    mockSupabase.setOutcomes([]);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

// ============================================================================
// 1. Per-event-type RPC contracts
// ============================================================================
describe('trackReferralEvent - RPC contract per event type', () => {
    it('click event: fires rpc(\'track_referral_event\') once with click type + null user_id', async () => {
        await trackReferralEvent(REFERRAL_CODE, 'click');

        expect(mockSupabase.rpcSpy).toHaveBeenCalledTimes(1);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('track_referral_event', expect.objectContaining({
            p_referral_code: REFERRAL_CODE,
            p_event_type: 'click',
            p_user_id: null, // omitted userId collapses to null via `userId || null`
        }));
        // trackReferralEvent never touches from() chains.
        expect(mockSupabase.fromSpy).not.toHaveBeenCalled();
        // Queue exhausted: rpc consumed the empty queue default.
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('view event: fires rpc with view type + null user_id', async () => {
        await trackReferralEvent(REFERRAL_CODE, 'view');
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('track_referral_event', expect.objectContaining({
            p_event_type: 'view',
            p_user_id: null,
        }));
    });

    it('signup event: fires rpc with signup type + the userId passed in', async () => {
        await trackReferralEvent(REFERRAL_CODE, 'signup', USER_ID);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('track_referral_event', expect.objectContaining({
            p_event_type: 'signup',
            p_user_id: USER_ID,
        }));
    });

    it('purchase event: fires rpc with purchase type + the userId passed in', async () => {
        await trackReferralEvent(REFERRAL_CODE, 'purchase', USER_ID);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('track_referral_event', expect.objectContaining({
            p_event_type: 'purchase',
            p_user_id: USER_ID,
        }));
    });

    it('always passes the full 6-key param shape (code, type, user_id, ip, ua, referrer)', async () => {
        await trackReferralEvent(REFERRAL_CODE, 'click');
        const params = mockSupabase.rpcSpy.mock.calls[0][1];
        // Order-independent: assert the SET of keys + length, not the order.
        // (Adding a new key intentionally would FAIL this test regardless of position.)
        expect(Object.keys(params)).toEqual(
            expect.arrayContaining([
                'p_referral_code',
                'p_event_type',
                'p_user_id',
                'p_visitor_ip',
                'p_user_agent',
                'p_referrer_url',
            ])
        );
        expect(Object.keys(params)).toHaveLength(6);
    });

    it('passes navigator.userAgent for p_user_agent and null for p_visitor_ip', async () => {
        await trackReferralEvent(REFERRAL_CODE, 'click');
        const params = mockSupabase.rpcSpy.mock.calls[0][1];
        // jsdom provides navigator.userAgent; the impl prefers it over null when defined.
        expect(params.p_user_agent).toBe(navigator.userAgent);
        // p_visitor_ip is hardcoded null (server-side is expected to populate it
        // from the request headers, so client passes null deliberately).
        expect(params.p_visitor_ip).toBeNull();
    });

    it('passes document.referrer || window.location.href for p_referrer_url', async () => {
        await trackReferralEvent(REFERRAL_CODE, 'click');
        const params = mockSupabase.rpcSpy.mock.calls[0][1];
        expect(params.p_referrer_url).toBe(document.referrer || window.location.href);
    });
});

// ============================================================================
// 2. Error handling
// ============================================================================
// trackReferralEvent is fire-and-forget (Promise<void>) on every call site,
// so it MUST never throw \u2014 a rejected RPC just gets logged, the caller
// (Checkout.tsx, AppContext, App.tsx) awaits it without try/catch.
describe('trackReferralEvent - error handling', () => {
    it('RPC transport rejection: silently returns void, does NOT throw', async () => {
        // setOutcomes queues a single rejection that the rpcSpy's rpcThenable pulls.
        mockSupabase.setOutcomes([
            { kind: 'reject', error: new Error('network transport failure') },
        ]);

        // The function must NOT bubble the rejection up to the caller.
        await expect(trackReferralEvent(REFERRAL_CODE, 'click')).resolves.toBeUndefined();
        // The inner catch block always logs to console.error.
        expect(console.error).toHaveBeenCalled();
        // And must NOT log the "[Referral Analytics] Tracked" success line.
        // The RPC transport rejection path always logs to console.error and never
        // to console.log.
        expect(console.log).not.toHaveBeenCalled();
        // The rpcSpy still fired exactly once (the failing attempt counts).
        expect(mockSupabase.rpcSpy).toHaveBeenCalledTimes(1);
        // The single queued reject was consumed.
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('RPC server-error result: logs to console.error with the resolved error payload', async () => {
        // Resolves successfully, but the SQL function returned an `error` payload
        // (NOT a transport failure). Implementer contract: server-side errors
        // are surfaced via the resolved `{ error }` field, not via rejection.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { error: { message: 'rls denied', code: '42501' } } },
        ]);

        await expect(trackReferralEvent(REFERRAL_CODE, 'click')).resolves.toBeUndefined();
        // console.error received the canonical "Error tracking referral event:" line
        // and the rejected-looking error object.
        expect(console.error).toHaveBeenCalledWith(
            'Error tracking referral event:',
            expect.objectContaining({ message: 'rls denied', code: '42501' })
        );
        // No success log line was printed.
        expect(console.log).not.toHaveBeenCalled();
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('RPC success result: logs the [Referral Analytics] Tracked ... line, no error', async () => {
        // Empty queue + 1 rpc shift = rpcThenable resolves with `{ data: null, error: null }`.
        // The empty value branch in rpcThenable (`next?.value ?? {}`) avoids an undefined spread.
        mockSupabase.setOutcomes([]);

        await trackReferralEvent(REFERRAL_CODE, 'click');

        // Regex match: pins the contract (event type + referral code) but tolerates
        // formatting tweaks such as added timestamps, colors, etc.
        expect(console.log).toHaveBeenCalledWith(
            expect.stringMatching(new RegExp('\\[Referral Analytics\\] Tracked click for code: ' + REFERRAL_CODE))
        );
        // No error logged on the happy path.
        expect(console.error).not.toHaveBeenCalled();
        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});
