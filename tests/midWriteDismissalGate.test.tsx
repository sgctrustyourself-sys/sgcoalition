// tests/midWriteDismissalGate.test.tsx
//
// The mid-write gate for the three surfaces the audit found still dismissible
// while their own request was in flight:
//
//   components/dashboard/WizardDetailModal.tsx -> Arcane Ascension upgrade
//   admin/CoalitionSignalManager.tsx           -> "Unsubscribe User?" confirmation
//   pages/Orders.tsx                           -> "Delete Order?" confirmation
//
// Each test starts the surface's real write, holds it open, and asserts:
//
//   1. Escape is inert while the request is outstanding — and the surface is
//      still on screen, because its own controls are disabled at that point and
//      dismissing it would strand the operator with no result to read.
//   2. Focus never left the layer.
//   3. The write is not abandoned: when it settles the surface reacts to it
//      (the modal shows its result, the confirmation closes).
//
// pages/Orders additionally pins the stacked-layer rule, which was wrong in the
// other direction: its detail sheet kept trapping while the confirmation sat on
// top of it, so a single Escape closed both layers at once.
//
// Mounting goes through tests/_helpers/adminSurface.tsx. This file supplies the
// two `vi.doMock` lines and loaders (see that helper's header for why vitest
// forces that split).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import {
    appContextStub,
    mockAppContext,
    renderAdminSurface,
    toastContextStub,
    type AdminSurface,
} from './_helpers/adminSurface';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { accessibleName } from './_helpers/accessibleName';

vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));

vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

const loadWizardDetailModal = () => import('../components/dashboard/WizardDetailModal');
const loadCoalitionSignalManager = () => import('../admin/CoalitionSignalManager');
const loadOrdersPage = () => import('../pages/Orders');

// ---------- FIXTURES ----------

const WIZARD = {
    id: 'w-ignis',
    name: 'Ignis',
    level: 2,
    power: 340,
    element: 'Fire',
    image: '/images/wizards/ignis.png',
    isLegacy: false,
};

const SUBSCRIBER = {
    id: 'sub-1',
    subscriber_type: 'email',
    contact_value: 'ada@example.com',
    status: 'active',
    source: 'site',
    subscribed_at: '2026-07-01T10:00:00Z',
};

const ORDER = {
    id: 'o-100',
    orderNumber: 'SG-100',
    userId: 'user-alice',
    customerName: 'Alice',
    customerEmail: 'alice@x.com',
    paymentMethod: 'paypal',
    paymentStatus: 'paid',
    orderType: 'online',
    total: 150,
    subtotal: 150,
    items: [{ productName: 'Wallet', productImage: '/w.png', selectedSize: 'M', quantity: 1, total: 150 }],
    createdAt: '2026-07-10T10:00:00Z',
};

describe('mid-write dismissal gate', () => {
    let surface: AdminSurface;
    let container: HTMLDivElement;

    const flush = async () => {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    };

    const press = async (key: string) => {
        await act(async () => {
            document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        });
    };

    /** The deepest overlay currently mounted — the one holding focus. */
    const topDialog = (): HTMLElement => {
        const dialogs = [...container.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')];
        expect(dialogs.length).toBeGreaterThan(0);
        return dialogs[dialogs.length - 1];
    };

    const buttonByText = (text: string, index = 0, scope: ParentNode = container): HTMLButtonElement => {
        const matches = [...scope.querySelectorAll('button')]
            .filter((button) => (button.textContent || '').includes(text));
        expect(matches[index], `no button containing "${text}" at index ${index}`).toBeTruthy();
        return matches[index] as HTMLButtonElement;
    };

    /** Exact visible text: "Unsubscribe" must not match the "Unsubscribed" filter. */
    const buttonByExactText = (text: string, scope: ParentNode = container): HTMLButtonElement => {
        const match = [...scope.querySelectorAll('button')]
            .find((button) => (button.textContent || '').replace(/\s+/g, ' ').trim() === text);
        expect(match, `no button whose text is exactly "${text}"`).toBeTruthy();
        return match as HTMLButtonElement;
    };

    const buttonByTitle = (title: string, index = 0): HTMLButtonElement => {
        const match = container.querySelectorAll<HTMLButtonElement>(`button[title="${title}"]`)[index];
        expect(match, `no button titled "${title}" at index ${index}`).toBeTruthy();
        return match;
    };

    /** Focus the control, then activate it — a real click does not move focus. */
    const activate = async (element: HTMLButtonElement) => {
        element.focus();
        await act(async () => { element.click(); });
        await flush();
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockAppContext();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('WizardDetailModal: Escape and the backdrop are inert while the ascension is in flight', async () => {
        mockAppContext({
            // Enough SGC for the level-2 upgrade (level * 100).
            user: { uid: 'user-wizard', sgCoinBalance: 500 },
        });

        const onClose = vi.fn();
        const onUpgrade = vi.fn();
        surface = await renderAdminSurface(loadWizardDetailModal, {
            props: {
                wizard: WIZARD as never,
                isOpen: true,
                onClose,
                onUpgrade,
            },
        });
        container = surface.container;

        const dialog = topDialog();
        expect(accessibleName(dialog)).toBe('Ignis details');

        await activate(buttonByText('Ascend Wizard', 0, dialog));
        expect(buttonByText('Infusing Mana...', 0, dialog)).toBeTruthy();
        expect((dialog.querySelector('button[aria-label="Close"]') as HTMLButtonElement).disabled).toBe(true);

        await press('Escape');
        expect(onClose).not.toHaveBeenCalled();

        // The backdrop behind the panel is the second dismiss path.
        const backdrop = dialog.previousElementSibling as HTMLElement;
        await act(async () => { backdrop.click(); });
        await flush();
        expect(onClose).not.toHaveBeenCalled();
        expect(dialog.contains(document.activeElement)).toBe(true);

        // Let the (simulated) ascension land: the panel reports it rather than
        // having been dismissed out from under its own request.
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1600)); });
        expect(onUpgrade).toHaveBeenCalledWith('w-ignis');
        expect(buttonByText('Ascend Wizard', 0, dialog)).toBeTruthy();

        await press('Escape');
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('CoalitionSignalManager: Escape cannot dismiss the unsubscribe confirmation mid-write', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [SUBSCRIBER], error: null } },
        ]);

        surface = await renderAdminSurface(loadCoalitionSignalManager);
        container = surface.container;

        await activate(buttonByExactText('Unsubscribe'));
        const dialog = topDialog();
        expect(accessibleName(dialog)).toBe('Confirm unsubscribe');

        // Hold the unsubscribe write open.
        let settle: () => void = () => {};
        mockSupabase.fromSpy.mockImplementationOnce(() => ({
            update: () => ({
                eq: () => new Promise((resolve) => {
                    settle = () => resolve({ error: null });
                }),
            }),
        }));

        const confirm = buttonByExactText('Unsubscribe', dialog);
        await activate(confirm);
        expect(buttonByText('Unsubscribing...', 0, dialog)).toBeTruthy();
        expect(confirm.disabled).toBe(true);
        expect(buttonByText('Cancel', 0, dialog).disabled).toBe(true);

        await press('Escape');

        expect(container.querySelector('[aria-label="Confirm unsubscribe"]')).toBeTruthy();
        expect(dialog.contains(document.activeElement)).toBe(true);

        await act(async () => { settle(); });
        await flush();

        // Settled: the confirmation closes on its own success path.
        expect(container.querySelector('[aria-label="Confirm unsubscribe"]')).toBeNull();
    });

    it('pages/Orders: one Escape closes only the confirmation, and none while it is written', async () => {
        let settle: () => void = () => {};
        const deleteOrder = vi.fn(
            () => new Promise<void>((resolve) => { settle = resolve; }),
        );
        mockAppContext({ orders: [ORDER], deleteOrder });

        surface = await renderAdminSurface(loadOrdersPage);
        container = surface.container;

        await activate(buttonByTitle('View Details'));
        expect(container.querySelector('[aria-label="Order SG-100"]')).toBeTruthy();

        // The confirmation stacks on the detail sheet: Escape must close the top
        // layer only.
        await activate(buttonByTitle('Delete Order'));
        const confirmDialog = topDialog();
        expect(accessibleName(confirmDialog)).toBe('Delete order');

        await press('Escape');
        expect(container.querySelector('[aria-label="Delete order"]')).toBeNull();
        expect(container.querySelector('[aria-label="Order SG-100"]')).toBeTruthy();

        // Reopen it and hold the delete open.
        await activate(buttonByTitle('Delete Order'));
        const reopened = topDialog();
        const remove = buttonByText('Delete', 0, reopened);
        await activate(remove);
        expect(remove.disabled).toBe(true);
        expect(deleteOrder).toHaveBeenCalledTimes(1);

        await press('Escape');

        expect(container.querySelector('[aria-label="Delete order"]')).toBeTruthy();
        expect(reopened.contains(document.activeElement)).toBe(true);

        await act(async () => { settle(); });
        await flush();

        expect(container.querySelector('[aria-label="Delete order"]')).toBeNull();
        expect(container.querySelector('[aria-label="Order SG-100"]')).toBeTruthy();
    });
});
