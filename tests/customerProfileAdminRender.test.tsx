// tests/customerProfileAdminRender.test.tsx
//
// REGRESSION CATCH for the React render-flow of components/admin/CustomerProfileAdmin.tsx.
//
// First .tsx test in the project. Three synthetic profiles are stubbed into
// buildCustomerProfile + buildCustomerProfileByEmail via auto-mocked
// vi.mock('../utils/customerProfile'), then the component is mounted via
// react-dom/client's createRoot and the form-submit handler is dispatched via
// a native submit event under React 19's act() to flush state + Promise
// settlements.
//
// Explicit DOM assertions instead of toMatchSnapshot(): Lucide icons render
// as inline SVGs that drift between lucide-react minor versions, Tailwind
// className order is not stable, and snapshots lock build-system surface
// rather than business-logic branches. Picks domain terms ("did the VIP
// branch render?") not markup-diff terms.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';
import {
    buildCustomerProfile,
    buildCustomerProfileByEmail,
    updateLifetimeStats,
    CustomerProfile,
} from '../utils/customerProfile';

const AUTH_UUID = 'auth-uuid-12345';
const META_MASK_DISPLAY_TAIL = '12345678';
const META_MASK_USER_ID = `user_eth_0x${META_MASK_DISPLAY_TAIL.repeat(5)}`;
const META_MASK_WALLET = `0x${META_MASK_DISPLAY_TAIL.repeat(5)}`;
const GUEST_EMAIL = 'verified-buyer@example.com';

const AUTH_PROFILE: CustomerProfile = {
    userId: AUTH_UUID, displayName: 'Customer', email: null, walletAddress: null,
    isVIP: true, storeCredit: 50.0, sgCoinBalance: 1000, lifetimeSpendUsd: 250,
    lifetimeOrders: 5, customerNotes: 'VIP since 2026',
    orderCount: 3, totalSpend: 350,
    firstOrderDate: '2026-05-01T14:00:00Z', lastOrderDate: '2026-07-10T12:00:00Z',
    favoriteCategories: ['prod-grey-wave', 'prod-tee-above'],
    socialAccounts: [{ platform: 'instagram', username: 'coolbuyer', verified: true }],
    referralCode: 'SG-ABC123',
    referralStats: { totalReferrals: 3, successfulReferrals: 1, totalEarnings: 15, currentTier: 2 },
    // NEW (2026-07-16): payout fields required on CustomerProfile.
    // DEFAULT to empty for AUTH_PROFILE so the existing tests stay green
    // (they assert on smaller surface and don't care about payouts).
    payoutStats: { totalRequested: 0, pendingCount: 0, completedCount: 0, rejectedCount: 0, lastStatus: null, lastAmount: null, lastDate: null },
    payoutRequests: [],
    anonymousOrderCount: 0, anonymousTotalSpend: 0,
};

// Rich fixture used by the new PAYOUT_HISTORY_WITH_REQUESTS render-flow test.
// Clones AUTH_PROFILE so all the headline lifetime stats stay consistent
// (the same VIP / $350 spend / 3 orders / SG-ABC123 referral visible) and
// just swaps in real payout data.
const RICH_PAYOUT_PROFILE: CustomerProfile = {
    ...AUTH_PROFILE,
    payoutStats: {
        totalRequested: 13000,
        pendingCount: 1, completedCount: 1, rejectedCount: 0,
        lastStatus: 'pending', lastAmount: 5000, lastDate: '2026-07-12T08:00:00Z',
    },
    payoutRequests: [
        { id: 'pr-pending-1', userId: AUTH_UUID, email: 'cust@example.com',
          walletAddress: '0xabc123def456abc123def456abc123def456abcd',
          amount: 5000, status: 'pending',
          txHash: undefined, rejectionReason: undefined,
          adminId: undefined, adminNotes: undefined,
          createdAt: '2026-07-12T08:00:00Z', updatedAt: '2026-07-12T08:00:00Z',
          processedAt: undefined },
        { id: 'pr-comp-1', userId: AUTH_UUID, email: 'cust@example.com',
          walletAddress: '0xabc123def456abc123def456abc123def456abcd',
          amount: 8000, status: 'completed',
          txHash: '0xtxhashcompleted1234567890abcdef',
          rejectionReason: undefined,
          adminId: 'admin-1', adminNotes: 'Approved via Polygon',
          createdAt: '2026-07-10T10:00:00Z', updatedAt: '2026-07-11T08:00:00Z',
          processedAt: '2026-07-11T08:00:00Z' },
    ],
};

const META_MASK_PROFILE: CustomerProfile = {
    userId: META_MASK_USER_ID, displayName: `Wallet ${META_MASK_DISPLAY_TAIL}`,
    email: null, walletAddress: META_MASK_WALLET,
    isVIP: false, storeCredit: 0, sgCoinBalance: 0, lifetimeSpendUsd: 0,
    lifetimeOrders: 0, customerNotes: null,
    orderCount: 0, totalSpend: 0,
    firstOrderDate: null, lastOrderDate: null,
    favoriteCategories: [], socialAccounts: [], referralCode: null, referralStats: null,
    // NEW (2026-07-16): required payout fields. MetaMask path returns
    // zeroed defaults from buildCustomerProfile (the Promise.resolve([]) shortcut).
    payoutStats: { totalRequested: 0, pendingCount: 0, completedCount: 0, rejectedCount: 0, lastStatus: null, lastAmount: null, lastDate: null },
    payoutRequests: [],
    anonymousOrderCount: 0, anonymousTotalSpend: 0,
};

const GUEST_PROFILE = {
    email: GUEST_EMAIL, orderCount: 2, totalSpend: 150,
    firstOrderDate: '2026-05-01T00:00:00Z', lastOrderDate: '2026-06-01T00:00:00Z',
    isVerifiedBuyer: true,
};

// Module mocks (vitest auto-hoists vi.mock above the imports below).
vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));

vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));

// Auto-mock: every export from utils/customerProfile becomes a vi.fn(). We
// re-define per-test using vi.mocked(...).mockResolvedValue(...) so each
// describe gets a different fixture return without cross-test state-creep.
vi.mock('../utils/customerProfile');

// Static import comes AFTER the mocks register, so the component picks up
// the auto-mocked builders rather than the real implementation.
import CustomerProfileAdmin from '../components/admin/CustomerProfileAdmin';

async function mountAndSearch(queryValue: string): Promise<void> {
    const form = document.body.querySelector('form');
    if (!form) throw new Error('CustomerProfileAdmin did not render a search <form>');

    // React-controlled inputs require the prototype's value setter (so React's
    // internal value-tracking hook fires) AND a native input event to drive
    // onChange. Setting .value = directly bypasses the React bookkeeping
    // and the form's onSubmit will read an empty state.
    const input = form.querySelector('input[type="text"]') as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype, 'value',
    )!.set!;
    valueSetter.call(input, queryValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // The form's onSubmit handler does e.preventDefault() then awaits
    // doSearch(). A native submit event with cancelable+bubbles is the shape
    // React listens for.
    await act(async () => {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
}

describe('CustomerProfileAdmin render flow', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // Fresh mount per test so internal state never crosses describe
        // boundaries (prev-by-design: see useEffect for localStorage recents).
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        // Reset per-test so the auto-mocked builders start neutral. updateLifetimeStats
        // is reset for symmetry even though no test currently asserts on it - prevents
        // future state-creep the moment anyone starts checking call counts.
        vi.mocked(buildCustomerProfile).mockReset();
        vi.mocked(buildCustomerProfileByEmail).mockReset();
        vi.mocked(updateLifetimeStats).mockReset();
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        if (container.parentNode === document.body) {
            document.body.removeChild(container);
        }
    });

    it('AUTH_USER: renders VIP badge, full stat grid, referral code, and admin actions block', async () => {
        vi.mocked(buildCustomerProfile).mockResolvedValue(AUTH_PROFILE);

        await act(async () => {
            root.render(createElement(CustomerProfileAdmin));
        });

        await mountAndSearch(AUTH_UUID);

        const html = container.innerHTML;
        const h2Texts = Array.from(container.querySelectorAll('h2')).map(
            (h) => (h.textContent || '').trim(),
        );

        expect(h2Texts).toContain('Customer Profile');
        expect(h2Texts).toContain('Customer');

        expect(html).toContain('VIP');
        expect(html).toContain('Verified');

        expect(html).toContain('$250.00');
        expect(html).toContain('$50.00');
        expect(html).toContain('$350.00');
        // sgCoinBalance toLocaleString() is locale-dependent (en-US '1,000', de-DE '1.000'),
        // so use a separator-tolerant regex instead of a literal '1,000 SGC' substring.
        expect(html).toMatch(/1[,\s.]?000\s*SGC/);

        expect(html).toContain('SG-ABC123');
        expect(html).toMatch(/Tier\s*2\b/);

        expect(html).toContain('Admin Actions');
        expect(html).toContain('Customer Notes');

        expect(html).not.toContain('Web3 Wallet');
    });

    it('METAMASK: renders wallet-derived displayName + "Web3 Wallet" badge + disabled stat cards + NO admin actions', async () => {
        vi.mocked(buildCustomerProfile).mockResolvedValue(META_MASK_PROFILE);

        await act(async () => {
            root.render(createElement(CustomerProfileAdmin));
        });

        await mountAndSearch(META_MASK_USER_ID);

        const html = container.innerHTML;
        const h2Texts = Array.from(container.querySelectorAll('h2')).map(
            (h) => (h.textContent || '').trim(),
        );

        expect(h2Texts).toContain('Customer Profile');
        expect(h2Texts).toContain(`Wallet ${META_MASK_DISPLAY_TAIL}`);

        expect(html).toContain(META_MASK_WALLET);
        expect(html).toContain('Web3 Wallet');
        // Pinning Tailwind class strings - acceptable for today's codegen
        // but is the most likely drift point if Tailwind v4 changes the prefix scheme.
        expect(html).toMatch(/opacity-50/);
        expect(html).toContain('$0.00');

        expect(html).not.toContain('SG-ABC123');
        expect(html).not.toMatch(/Tier\s*2\b/);

        expect(html).not.toContain('Admin Actions');
        expect(html).not.toContain('Customer Notes');

        // MetaMask advisory amber banner explaining why stats are disabled.
        expect(html).toMatch(/amber-500\/5/);
    });

    it('EMAIL_ONLY: renders the email as h2, "Verified Buyer" badge, and the 4-card guest stat block', async () => {
        vi.mocked(buildCustomerProfileByEmail).mockResolvedValue(GUEST_PROFILE);

        await act(async () => {
            root.render(createElement(CustomerProfileAdmin));
        });

        await mountAndSearch(GUEST_EMAIL);

        const html = container.innerHTML;
        const h2Texts = Array.from(container.querySelectorAll('h2')).map(
            (h) => (h.textContent || '').trim(),
        );

        expect(h2Texts).toContain('Customer Profile');
        expect(h2Texts).toContain(GUEST_EMAIL);

        expect(html).toContain('Verified Buyer');

        // The amber "no paid orders" advisory is NOT shown - this guest IS verified.
        expect(html).not.toMatch(/amber-500\/5/);

        expect(html).toContain('$150.00');

        // AUTH-specific affordances are NOT rendered. We deliberately avoid a
        // strict `>VIP<` regex (which would over-fit to the current <span>
        // structure) and rely on not.toContain('Admin Actions') +
        // not.toContain('Customer Notes') - both require the AUTH-only
        // <ProfileDetail> block to mount, which is the structural invariant.
        expect(html).not.toContain('Admin Actions');
        expect(html).not.toContain('Customer Notes');
    });

    // NEW (2026-07-16): PAYOUT_HISTORY render-flow tests lock the new section
    // added by utils/customerProfile.ts (the 5th Promise.all entry) +
    // components/admin/CustomerProfileAdmin.tsx (Payout History card + 4 stat
    // cards + table). See services/payoutRequest.ts for the source RPC wrappers.
    it('PAYOUT_HISTORY_WITH_REQUESTS: renders Payout History header (2), table rows with wallet short codes, status badges, aggregate stats, polygonscan link', async () => {
        vi.mocked(buildCustomerProfile).mockResolvedValue(RICH_PAYOUT_PROFILE);

        await act(async () => {
            root.render(createElement(CustomerProfileAdmin));
        });

        await mountAndSearch(AUTH_UUID);

        const html = container.innerHTML;

        // Section header — count of 2 reflects the 2-row fixture.
        expect(html).toMatch(/Payout History\s*\(2\)/i);
        expect(html).toMatch(/Manual SG Coin crypto-withdrawal/i);

        // Two rows in the table — wallet short code is `0xabc1…abcd`.
        expect(html).toContain('0xabc1…abcd');

        // Aggregate stats row (always rendered, shows 13,000 for totalRequested).
        expect(html).toMatch(/Total Requested/i);
        expect(html).toContain('13,000 SGC');
        expect(html).toMatch(/Pending/i);
        expect(html).toContain('1'); // pendingCount=1
        expect(html).toMatch(/Completed/i);
        expect(html).toMatch(/Last Status/i);

        // Completed-row tx hash becomes a Polygonscan deep-link.
        expect(html).toContain('https://polygonscan.com/tx/');

        // Status badges for pending + completed rows render.
        expect(html).toMatch(/PENDING/i);
        expect(html).toMatch(/COMPLETED/i);
    });

    it('PAYOUT_HISTORY_EMPTY_STATE: with empty payoutRequests, renders the section header (0), empty-state copy, 0 totals, and only the orders table', async () => {
        vi.mocked(buildCustomerProfile).mockResolvedValue(AUTH_PROFILE);

        await act(async () => {
            root.render(createElement(CustomerProfileAdmin));
        });

        await mountAndSearch(AUTH_UUID);

        const html = container.innerHTML;

        // Section header is shown with zero count (not hidden).
        expect(html).toMatch(/Payout History\s*\(0\)/i);

        // Empty-state copy is the distinctive phrase (matches exactly once).
        expect(html).toMatch(/No payout requests found for this customer/i);
        expect(html).toMatch(/SG Coin stays on the SG Coalition server/i);

        // Aggregate stats show 0 / 0 / 0 / NONE (not 13,000 etc.).
        expect(html).toMatch(/0\s*SGC/);
        expect(html).toMatch(/Last Status[\s\S]{0,200}?NONE/i);

        // No Polygonscan link rendered when no requests exist.
        expect(html).not.toContain('https://polygonscan.com/tx/');

        // Both empty-state copies visible — the payout empty state replaces
        // a 2nd <table> mount (no <table> rendered for empty payouts), AND
        // the orders empty state is also visible because fetchOrders has no
        // setOutcomes() queued (default mock returns null/[], so orders=[]).
        expect(html).toMatch(/No orders found for this customer/i);
        expect(html).toMatch(/No payout requests found for this customer/i);

        // Both lists use the <div className="p-12 text-center"> empty-state
        // block instead of <table>, so total mounted tables is 0.
        const tableCount = container.querySelectorAll('table').length;
        expect(tableCount).toBe(0);
    });
});
