// tests/trustCircleManagerRender.test.tsx
//
// REGRESSION CATCH for components/admin/TrustCircleManager.tsx — the admin
// Trust Circle tab (application queue, invite, members, drop vouchers).
//
// Replicates the createRoot + act + explicit-DOM-assertions pattern.
//
// Mock surface:
//   - ../../services/supabase -> mockSupabase singleton (profiles + members
//     queries land here)
//   - ../../context/AppContext -> useApp vi.fn() (stable admin user)
//   - ../../context/ToastContext -> no-op
//   - ../../services/trustCircle -> getApplications returns one pending app;
//     reviewApplication/inviteUser/revokeMember stubbed; getMembership +
//     issueDropVoucher preserved from the real module (issueDropVoucher is a
//     drop_vouchers insert -> mockSupabase outcome).
//
// Contracts locked:
//   1. QUEUE_RENDER: pending application appears with its why_join copy.
//   2. APPROVE: clicking Approve calls reviewApplication(id, true, note,
//      adminId) — no double-call.
//   3. SECTIONS: Invite + Current Members headers render.

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
vi.mock('../services/trustCircle', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../services/trustCircle')>();
    return {
        ...actual,
        getApplications: vi.fn(async () => [
            {
                id: 'app-1',
                user_id: 'u1',
                status: 'pending',
                why_join: 'I rep Baltimore',
                what_you_create: 'Fits',
                platforms: ['instagram'],
                handles: { instagram: '@rep' },
                audience_size: '10k',
                portfolio_url: null,
                created_at: '2026-08-01T00:00:00Z',
                reviewed_at: null,
                reviewed_by: null,
                review_note: null,
            },
        ]),
        reviewApplication: vi.fn(async () => ({ success: true })),
        inviteUser: vi.fn(async () => ({ success: true })),
        revokeMember: vi.fn(async () => ({ success: true })),
        issueDropVoucher: vi.fn(async () => ({ success: true })),
    };
});

// The email service posts through /api/send-email; mock the wrapper so the
// manager test can assert the exact (email, name, code) triple without a
// real network call.
vi.mock('../services/emailService', () => ({
    sendDropVoucherEmail: vi.fn(async () => {}),
}));

// Static imports below the vi.mock block (established hoisting pattern).
import { useApp } from '../context/AppContext';
import TrustCircleManager from '../components/admin/TrustCircleManager';
import { reviewApplication, issueDropVoucher } from '../services/trustCircle';
import { sendDropVoucherEmail } from '../services/emailService';

const ADMIN_USER = { uid: 'admin-1' };

describe('TrustCircleManager render', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        vi.mocked(useApp).mockReturnValue({ user: ADMIN_USER } as any);
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

    it('QUEUE_RENDER: pending application listed with answers + sections visible', async () => {
        // reload(): getApplications (mocked), applicant profiles (outcome 1),
        // members fetch (outcome 2 -> no rows; no member-email fetch needed).
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        await act(async () => {
            root.render(createElement(TrustCircleManager));
        });
        const html = container.innerHTML;

        // Header + application copy.
        expect(html).toContain('Trust Circle');
        expect(html).toContain('I rep Baltimore');
        expect(html).toContain('Fits');
        // The three sections render.
        expect(html).toContain('Applications');
        expect(html).toContain('Invite to Trust Circle');
        expect(html).toContain('Current Members');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('DROP: clicking Drop issues the voucher AND emails the member the code', async () => {
        // reload(): applicant profiles (1), members fetch (2 -> one member),
        // then member-email profiles fetch (3).
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
            {
                kind: 'resolve',
                value: {
                    data: [{
                        user_id: 'u2', referral_code: '26A10A', partner_tier: 'trust_circle',
                        trust_circle_commission_rate: 20, circle_member_since: '2026-08-01T00:00:00Z',
                    }],
                    error: null,
                },
            },
            {
                kind: 'resolve',
                value: {
                    data: [{ id: 'u2', email: 'member@example.com', full_name: 'Trust Member' }],
                    error: null,
                },
            },
            // Coupon insert (4).
            { kind: 'resolve', value: { error: null } },
        ]);

        await act(async () => {
            root.render(createElement(TrustCircleManager));
        });
        expect(container.innerHTML).toContain('member@example.com');

        const dropBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => (b.textContent || '').trim().toUpperCase() === 'DROP',
        ) as HTMLButtonElement | undefined;
        expect(dropBtn).toBeTruthy();

        await act(async () => {
            dropBtn!.click();
        });

        expect(issueDropVoucher).toHaveBeenCalledTimes(1);
        expect(sendDropVoucherEmail).toHaveBeenCalledTimes(1);
        const [email, name, code] = vi.mocked(sendDropVoucherEmail).mock.calls[0];
        expect(email).toBe('member@example.com');
        expect(name).toBe('Trust Member');
        expect(code).toMatch(/^DROP-\d{6}-[A-Z0-9]{4}$/);
        // The exact code passed to the email must be the one issued to the ledger.
        expect(vi.mocked(issueDropVoucher).mock.calls[0][1]).toBe(code);

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('APPROVE: clicking Approve calls reviewApplication exactly once with admin id', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            // after approve: reload() again — getApplications (mocked) + applicant profiles + members
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        await act(async () => {
            root.render(createElement(TrustCircleManager));
        });

        const approveBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => (b.textContent || '').trim().toUpperCase().includes('APPROVE'),
        ) as HTMLButtonElement | undefined;
        expect(approveBtn).toBeTruthy();

        await act(async () => {
            approveBtn!.click();
        });

        expect(reviewApplication).toHaveBeenCalledTimes(1);
        expect(reviewApplication).toHaveBeenCalledWith('app-1', true, '', 'admin-1');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});
