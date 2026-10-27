// tests/trustCircle.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from './_helpers/supabaseClientMock';
import {
    TRUST_CIRCLE_FLAT_RATE,
    getMembership,
    submitApplication,
    getMyApplication,
    getApplications,
    reviewApplication,
    inviteUser,
    acceptInvite,
    declineInvite,
    revokeMember,
    issueDropVoucher,
} from '../services/trustCircle';

vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));

const USER_ID = 'user-uuid-circle';
const MEMBERSHIP_ROW = {
    user_id: USER_ID,
    referral_code: 'SG-CIRCLE',
    partner_tier: 'trust_circle',
    trust_circle_commission_rate: 20,
    invited_at: '2026-08-01T00:00:00Z',
    circle_member_since: '2026-08-02T00:00:00Z',
};
const APP_INPUT = {
    whyJoin: 'I rep Baltimore',
    whatYouCreate: 'Fits + streetwear content',
    platforms: ['instagram', 'tiktok'],
    handles: { instagram: '@sg_rep', tiktok: '@sg_rep' },
    audienceSize: '10k',
    portfolioUrl: 'https://tiktok.com/@sg_rep',
};

beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.setOutcomes([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getMembership', () => {
    it('returns the referral_stats row when found', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: MEMBERSHIP_ROW, error: null } }]);
        const result = await getMembership(USER_ID);
        expect(result?.partner_tier).toBe('trust_circle');
        expect(result?.trust_circle_commission_rate).toBe(20);
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('referral_stats');
        expect(mockSupabase.eqSpy).toHaveBeenCalledWith('user_id', USER_ID);
    });

    it('returns null when no row exists', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: new Error('PGRST116') } }]);
        const result = await getMembership(USER_ID);
        expect(result).toBeNull();
    });

    it('returns null for MetaMask users without calling the DB', async () => {
        const result = await getMembership('user_eth_0x1234');
        expect(result).toBeNull();
        expect(mockSupabase.fromSpy).not.toHaveBeenCalled();
    });
});

describe('submitApplication', () => {
    it('inserts a pending application and returns it', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } }, // existing-pending check -> none
            { kind: 'resolve', value: { data: { id: 'app-1', ...APP_INPUT, user_id: USER_ID, status: 'pending' }, error: null } },
        ]);
        const result = await submitApplication(APP_INPUT, USER_ID);
        expect(result.success).toBe(true);
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('trust_circle_applications');
        const insertPayload = mockSupabase.insertSpy.mock.calls[0]?.[0];
        expect(insertPayload[0].user_id).toBe(USER_ID);
        expect(insertPayload[0].status).toBe('pending');
        expect(insertPayload[0].why_join).toBe(APP_INPUT.whyJoin);
    });

    it('rejects when a pending application already exists', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: { id: 'app-existing' }, error: null } }]);
        const result = await submitApplication(APP_INPUT, USER_ID);
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already/i);
        expect(mockSupabase.insertSpy).not.toHaveBeenCalled();
    });

    it('returns error when insert fails', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: null, error: null } },
            { kind: 'resolve', value: { data: null, error: new Error('rpc rls denial') } },
        ]);
        const result = await submitApplication(APP_INPUT, USER_ID);
        expect(result.success).toBe(false);
    });
});

describe('getMyApplication / getApplications', () => {
    it('returns the user pending application', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: { id: 'app-pending', status: 'pending' }, error: null } }]);
        const result = await getMyApplication(USER_ID);
        expect(result?.id).toBe('app-pending');
    });

    it('returns all applications for admin', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: [{ id: 'a' }, { id: 'b' }], error: null } }]);
        const result = await getApplications();
        expect(result).toHaveLength(2);
    });
});

describe('reviewApplication', () => {
    it('APPROVE updates the application and flips the member tier + flat rate', async () => {
        mockSupabase.setOutcomes([
            // app update — returns the updated row so the impl can read user_id
            { kind: 'resolve', value: { data: { id: 'app-1', user_id: USER_ID, status: 'approved' }, error: null } },
            { kind: 'resolve', value: { data: null, error: null } }, // referral_stats update
        ]);
        const result = await reviewApplication('app-1', true, 'Great fits', 'admin-1');
        expect(result.success).toBe(true);
        // application update
        const appUpdate = mockSupabase.updateSpy.mock.calls[0]?.[0];
        expect(appUpdate.status).toBe('approved');
        expect(appUpdate.reviewed_by).toBe('admin-1');
        // referral_stats update: tier + flat rate + circle_member_since
        const statsUpdate = mockSupabase.updateSpy.mock.calls[1]?.[0];
        expect(statsUpdate.partner_tier).toBe('trust_circle');
        expect(statsUpdate.trust_circle_commission_rate).toBe(TRUST_CIRCLE_FLAT_RATE);
        expect(statsUpdate.circle_member_since).toEqual(expect.any(String));
    });

    it('DECLINE updates the application only (tier untouched)', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: { id: 'app-1', user_id: USER_ID, status: 'declined' }, error: null } },
        ]);
        const result = await reviewApplication('app-1', false, 'Not the fit', 'admin-1');
        expect(result.success).toBe(true);
        const appUpdate = mockSupabase.updateSpy.mock.calls[0]?.[0];
        expect(appUpdate.status).toBe('declined');
        expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(1); // no stats write
    });
});

describe('invite / accept / decline / revoke', () => {
    it('inviteUser stamps invited_at', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await inviteUser(USER_ID);
        expect(result.success).toBe(true);
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({ invited_at: expect.any(String) });
    });

    it('acceptInvite flips tier to trust_circle with flat rate', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await acceptInvite(USER_ID);
        expect(result.success).toBe(true);
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({
            partner_tier: 'trust_circle',
            trust_circle_commission_rate: TRUST_CIRCLE_FLAT_RATE,
            circle_member_since: expect.any(String),
            invited_at: null,
        });
    });

    it('declineInvite clears invited_at', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await declineInvite(USER_ID);
        expect(result.success).toBe(true);
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({ invited_at: null });
    });

    it('revokeMember flips back to trusted_few and clears circle fields', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await revokeMember(USER_ID);
        expect(result.success).toBe(true);
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({
            partner_tier: 'trusted_few',
            trust_circle_commission_rate: null,
            circle_member_since: null,
            invited_at: null,
        });
    });
});

describe('issueDropVoucher', () => {
    it('inserts a drop_vouchers ledger row', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: null, error: null } }]);
        const result = await issueDropVoucher(USER_ID, 'DROP-AUG26');
        expect(result.success).toBe(true);
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('drop_vouchers');
        expect(mockSupabase.insertSpy).toHaveBeenCalledWith([{
            member_user_id: USER_ID,
            coupon_code: 'DROP-AUG26',
            status: 'issued',
        }]);
    });
});
