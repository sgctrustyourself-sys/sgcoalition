// tests/trustedFewDashboardRender.test.tsx
//
// REGRESSION CATCH for the Trusted Few rebrand of components/ReferralDashboard.tsx.
//
// Replicates the established createRoot + act + explicit-DOM-assertions pattern
// (no testing-library). Two contracts are locked:
//   1. REBRAND: "The Trusted Few" header renders; ALL sunset/vote banner copy
//      ("scheduled to wrap", "Cast your vote", "runs through") is GONE.
//   2. TRUST CIRCLE PANEL: a trusted_few member sees "Join the Trust Circle";
//      an invited member sees the invite-accept banner.
//
// Mock surface:
//   - ../services/supabase  -> mockSupabase singleton (getMembership + getMyApplication read referral_stats / trust_circle_applications)
//   - ../context/AppContext -> useApp() returns { user }
//   - ../context/ToastContext -> useToast() no-op
//   - ../utils/referralSystem -> getReferralStats/getReferralHistory/generateReferralLink/calculateCommissionTier/COMMISSION_TIERS stubbed
//   - ../utils/referralAnalytics -> getReferrerAnalytics stubbed
//
// The component uses <Link> (react-router-dom) in the Trust Circle panel and
// on the vote banner, so renders are wrapped in <MemoryRouter>.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';

vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));
vi.mock('../context/AppContext', () => ({
    useApp: vi.fn(),
}));
vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));
vi.mock('../utils/referralSystem', () => ({
    getReferralStats: vi.fn(async () => ({
        user_id: 'u1',
        referral_code: 'SG-MEMBER',
        total_referrals: 2,
        successful_referrals: 1,
        current_tier: 2,
        current_commission_rate: 10,
        total_earnings: 15,
        pending_earnings: 15,
        paid_earnings: 0,
        updated_at: '2026-08-01T00:00:00Z',
    })),
    getReferralHistory: vi.fn(async () => []),
    generateReferralLink: vi.fn(() => 'https://sgcoalition.xyz/?ref=SG-MEMBER'),
    calculateCommissionTier: vi.fn(() => ({ tier: 2, rate: 10, nextTier: { tier: 3, rate: 15, minReferrals: 3 }, referralsToNextTier: 2, progress: 50 })),
    COMMISSION_TIERS: [],
}));
vi.mock('../utils/referralAnalytics', () => ({
    getReferrerAnalytics: vi.fn(async () => ({ clicks: 3, views: 4, signups: 1, purchases: 1, conversionRate: 33.3 })),
}));

// Static imports BELOW the vi.mock block — vitest hoists the mocks above
// them, and a component import above the block trips the hoisted-factory
// initialization guard (the exact pattern every existing render test uses).
import { MemoryRouter } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import TrustedFewDashboard from '../components/ReferralDashboard';

const MEMBER = {
    user_id: 'u1',
    referral_code: 'SG-MEMBER',
    partner_tier: 'trusted_few',
    trust_circle_commission_rate: null,
    invited_at: null,
    circle_member_since: null,
};

// Stable per-test user object — the component's effects key on [user], and a
// fresh object per render would loop forever (this is why the established
// render tests mockReturnValue a stable object rather than a factory).
const MOCK_USER = { uid: 'u1', displayName: 'Test Member' };

describe('TrustedFewDashboard render', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        vi.mocked(useApp).mockReturnValue({ user: MOCK_USER } as any);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('REBRAND: header shows "The Trusted Few" and NO sunset/vote banner copy', async () => {
        // getMembership -> trusted_few row; getMyApplication -> none
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: MEMBER, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
        ]);

        await act(async () => {
            root.render(createElement(MemoryRouter, null, createElement(TrustedFewDashboard)));
        });
        const html = container.innerHTML;

        // Rebranded header.
        expect(html).toContain('The Trusted Few');
        // Sunset/vote messaging is retired.
        expect(html).not.toContain('scheduled to wrap');
        expect(html).not.toContain('Cast your vote');
        expect(html).not.toContain('runs through');
        expect(html).not.toContain('Continue referrals');
        // Trust Circle apply panel shows for a regular member.
        expect(html).toContain('Join the Trust Circle');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('INVITE: invited member sees the invite-accept banner', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: { ...MEMBER, invited_at: '2026-08-01T00:00:00Z' }, error: null } },
            { kind: 'resolve', value: { data: null, error: null } },
        ]);

        await act(async () => {
            root.render(createElement(MemoryRouter, null, createElement(TrustedFewDashboard)));
        });
        const html = container.innerHTML;

        expect(html).toContain('invited to the Trust Circle');
        expect(html).toContain('>Accept<');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});
