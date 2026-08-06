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
    };
});

// Static imports below the vi.mock block (established hoisting pattern).
import { useApp } from '../context/AppContext';
import TrustCircleManager from '../components/admin/TrustCircleManager';
import { reviewApplication } from '../services/trustCircle';

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
        // reload(): getApplications (mocked), profiles fetch (outcome 1 ->
        // no rows), members fetch (outcome 2 -> no rows).
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

    it('APPROVE: clicking Approve calls reviewApplication exactly once with admin id', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
            { kind: 'resolve', value: { data: [], error: null } },
            // after approve: reload() again — getApplications (mocked) + profiles + members
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
