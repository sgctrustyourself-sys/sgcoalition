// tests/signalManagerRender.test.tsx
//
// REGRESSION CATCH for the React render-flow of components/admin/SignalManager.tsx.
//
// Replicates the established pattern: createRoot + act + explicit DOM assertions
// (no snapshots). SignalManager uses framer-motion's `motion.div` for modal
// backdrop + form panel — in jsdom the motion.div renders as a plain <div>
// (the animation props are CSS-only and never apply), so no stub needed.
//
// Mock surface: services/supabase + context/ToastContext. No AppContext,
// no sub-component stubs (SignalManager does not import siblings).
//
// 3 fixtures engineered to mirror the 5-type palette:
//   - info (active) - has action_url = truthy
//   - alert (active) - empty action_url
//   - urgent (inactive) - has action_url = truthy
// Stat grid is DOM-traversal over `p.text-2xl.font-black` (Recipient: 3 stat cards
// per file: Active Signals / Scheduled|Drafts / Broadcast Capacity).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { pinStatValues } from './_helpers/statCardPinner';

// vitest auto-hoists vi.mock above the imports that follow.
vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));
vi.mock('../context/ToastContext', () => ({
    useToast: () => ({ addToast: vi.fn() }),
}));

import SignalManager from '../components/admin/SignalManager';

interface TestSignal {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'alert' | 'success' | 'process' | 'urgent';
    is_active: boolean;
    action_url: string;
    action_label: string;
    created_at: string;
}

// 3 fixtures: 2 active + 1 inactive, 3 distinct types, mixed action_url truthy.
const SIGNAL_INFO_ACTIVE: TestSignal = {
    id: 'sig-001',
    title: 'System Update',
    message: 'New dashboard tiles available',
    type: 'info',
    is_active: true,
    action_url: 'https://example.com/feature',
    action_label: 'Learn More',
    created_at: '2026-07-10T10:00:00Z',
};
const SIGNAL_ALERT_ACTIVE: TestSignal = {
    id: 'sig-002',
    title: 'Maintenance Notice',
    message: 'Brief downtime on Sunday morning',
    type: 'alert',
    is_active: true,
    action_url: '',  // Falsy - no 'Linked' badge.
    action_label: 'Learn More',
    created_at: '2026-07-12T09:00:00Z',
};
const SIGNAL_URGENT_INACTIVE: TestSignal = {
    id: 'sig-003',
    title: 'Cold Storage Migration',
    message: 'Wallet migration complete - verify now',
    type: 'urgent',
    is_active: false,
    action_url: 'https://example.com/verify',
    action_label: 'Verify',
    created_at: '2026-07-14T08:00:00Z',
};

describe('SignalManager form modal + toggle interactions', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('EDIT_FORM_OPEN: clicking "New Signal" mounts modal with motion.div (rendered as div) + form fields (Title/Type/Message/ActionURL/ActionLabel/Deploy checkbox) + 2 buttons', async () => {
        // 1 outcome for initial fetch (the toggle for "New Signal" only flips state,
        // does NOT fire any supabase call).
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
        ]);
        await act(async () => {
            root.render(createElement(SignalManager));
        });
        expect(container.innerHTML).not.toContain('Create New Signal');

        // Click "New Signal" header button - it's the OUTER one (not the modal submit).
        const newSignalBtn = Array.from(document.body.querySelectorAll('button')).find(
            (b) => b.textContent?.includes('New Signal') && !b.closest('form'),
        ) as HTMLButtonElement | undefined;
        expect(newSignalBtn).toBeTruthy();

        await act(async => { newSignalBtn!.click(); });

        const html = container.innerHTML;

        // Modal h3 visible.
        expect(html).toContain('Create New Signal');

        // Form is mounted with required inputs.
        const form = document.body.querySelector('form');
        expect(form).toBeTruthy();

        // Title input (the modal form's first input).
        const titleInput = document.body.querySelector(
            'input[placeholder="System Alert"]',
        ) as HTMLInputElement | null;
        expect(titleInput).toBeTruthy();
        expect(titleInput!.required).toBe(true);
        // Type select with aria-label.
        const typeSelect = document.body.querySelector(
            'select[aria-label="Signal Type"]',
        ) as HTMLSelectElement | null;
        expect(typeSelect).toBeTruthy();
        // 5 type options rendered (info/alert/success/process/urgent).
        const optTexts = Array.from(typeSelect?.options || []).map((o) => o.textContent || '');
        expect(optTexts.some((t) => t.includes('Information'))).toBe(true);
        expect(optTexts.some((t) => t.includes('Warning'))).toBe(true);
        expect(optTexts.some((t) => t.includes('Success'))).toBe(true);
        expect(optTexts.some((t) => t.includes('Process'))).toBe(true);
        expect(optTexts.some((t) => t.includes('Urgent'))).toBe(true);
        // Message textarea (matches via required + placeholder).
        const messageArea = Array.from(document.body.querySelectorAll('textarea')).find(
            (t) => t.getAttribute('placeholder')?.includes('signal content'),
        ) as HTMLTextAreaElement | undefined;
        expect(messageArea).toBeTruthy();
        // Modal Deploy button + Cancel button.
        expect(html).toContain('Deploy Signal');
        expect(html).toContain('Cancel');
        // "Deploy immediately" checkbox label.
        expect(html).toContain('Deploy immediately');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('TOGGLE_STATUS: clicking toggle on active signal fires update({is_active:false}) + state flips to "Inactive" + aria-label flips to "Activate signal"', async () => {
        // 2 outcomes consumed: initial-fetch (mount) + update (toggle click).
        // toggleStatus does NOT re-fetch signals - it persists state via setSignals locally
        // + addToast. So just 2 outcomes needed.
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [SIGNAL_INFO_ACTIVE], error: null } },
            { kind: 'resolve', value: { error: null } },
        ]);

        await act(async () => {
            root.render(createElement(SignalManager));
        });

        // Toggle button on the active signal has aria-label="Deactivate signal".
        // (Inactive signal would have aria-label="Activate signal" - but we have only
        // the active one in this fixture.)
        const deactivateBtn = document.body.querySelector(
            'button[aria-label="Deactivate signal"]',
        ) as HTMLButtonElement | null;
        expect(deactivateBtn).toBeTruthy();

        await act(async => { deactivateBtn!.click(); });

        const html = container.innerHTML;

        // Supabase update fired with { is_active: false } + eq with the id.
        expect(mockSupabase.updateSpy).toHaveBeenCalledWith({ is_active: false });
        expect(mockSupabase.eqSpy).toHaveBeenCalledWith('id', 'sig-001');

        // State flipped: 'Live' badge gone for this signal, 'Inactive' badge present.
        const liveBadgeCount = (html.match(/>\s*Live\s*</g) || []).length;
        expect(liveBadgeCount).toBe(0);
        expect(html).toContain('Inactive');

        // Toggle aria-label flipped from 'Deactivate' to 'Activate'.
        expect(document.body.querySelector('button[aria-label="Deactivate signal"]')).toBeNull();
        expect(document.body.querySelector('button[aria-label="Activate signal"]')).toBeTruthy();

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});

describe('SignalManager render flow', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    // Stat grid: pin the three values via the shared helper instead of an
    // inline declaration. SignalManager renders stat numbers as
    // <p className="text-2xl font-black"> so the selector is p-specific.
    // index 0 = Active Signals, 1 = Scheduled/Drafts, 2 = Broadcast Capacity
    // ('UNLIMITED' is a hardcoded constant in the JSX).

    it('LOADED_SIGNALS: 3 mixed signals with type icons, Live/Inactive badges, type indicator, Linked badge, 3 action buttons per row', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [SIGNAL_INFO_ACTIVE, SIGNAL_ALERT_ACTIVE, SIGNAL_URGENT_INACTIVE], error: null } },
        ]);

        await act(async () => {
            root.render(createElement(SignalManager));
        });
        const html = container.innerHTML;

        // Header + action button.
        expect(html).toContain('Signal Broadcast Manager');
        expect(html).toContain('Deploy global alerts and operational updates');
        expect(html).toContain('New Signal');

        // Stat grid - pin via the shared helper (NOT regex - CSS classes have digits).
        const statValues = pinStatValues(container, 'p.text-2xl.font-black');
        expect(statValues[0]).toBe('2');         // Active Signals: 2 (info + alert).
        expect(statValues[1]).toBe('1');         // Scheduled/Drafts: 1 (urgent is inactive).
        expect(statValues[2]).toBe('UNLIMITED'); // Broadcast Capacity is hardcoded.

        // All 3 signal titles render.
        expect(html).toContain('System Update');
        expect(html).toContain('Maintenance Notice');
        expect(html).toContain('Cold Storage Migration');

        // 'Live' badge present 2x (info + alert are active).
        const liveBadgeCount = (html.match(/>\s*Live\s*</g) || []).length;
        expect(liveBadgeCount).toBe(2);
        // 'Inactive' badge present 1x (urgent is inactive).
        expect(html).toContain('Inactive');

        // 'Type: X' indicator visible for each signal. Anchored on word boundaries
        // to avoid matching the modeless 5-option select that lives hidden.
        expect(html).toContain('Type: info');
        expect(html).toContain('Type: alert');
        expect(html).toContain('Type: urgent');

        // 'Linked' badge appears on signals with action_url (info + urgent = 2).
        const linkedBadgeCount = (html.match(/Linked/g) || []).length;
        expect(linkedBadgeCount).toBeGreaterThanOrEqual(2);

        // 3 action buttons per row: toggle, edit, delete.
        expect(html).toContain('Deactivate signal');
        expect(html).toContain('Activate signal');
        expect(document.body.querySelectorAll('button[aria-label="Edit signal"]').length).toBe(3);
        expect(document.body.querySelectorAll('button[aria-label="Delete signal"]').length).toBe(3);

        // No modal mounted yet.
        expect(html).not.toContain('Create New Signal');

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });

    it('EMPTY_SIGNALS: 0 signals renders "No active signals found" empty state + zero stat counts + Broadcast Capacity unchanged', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [], error: null } },
        ]);

        await act(async () => {
            root.render(createElement(SignalManager));
        });
        const html = container.innerHTML;

        // Stat counts go to zero (NaN-leak guard).
        const statValues = pinStatValues(container, 'p.text-2xl.font-black');
        expect(statValues[0]).toBe('0');
        expect(statValues[1]).toBe('0');
        // Broadcast Capacity is hardcoded - still 'UNLIMITED' regardless of data.
        expect(statValues[2]).toBe('UNLIMITED');

        // Empty-state row.
        expect(html).toContain('No active signals found');

        // 3 signal titles absent.
        expect(html).not.toContain('System Update');
        expect(html).not.toContain('Maintenance Notice');
        expect(html).not.toContain('Cold Storage Migration');

        // No action buttons for absent rows.
        expect(document.body.querySelectorAll('button[aria-label="Deactivate signal"]').length).toBe(0);
        expect(document.body.querySelectorAll('button[aria-label="Activate signal"]').length).toBe(0);

        expect(mockSupabase.getRemainingOutcomes()).toBe(0);
    });
});
