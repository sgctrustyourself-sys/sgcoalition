// tests/pageDialogAccessibleName.test.tsx
//
// Runtime accessible-name assertions for the two dialogs that live on routed
// pages rather than inside a reusable component:
//
//   pages/Orders.tsx                  -> Order Details (labelled by props)
//                                        Delete order   (fixed label)
//   admin/CoalitionSignalManager.tsx  -> Confirm unsubscribe (fixed label)
//
// Both pages are mounted through tests/_helpers/adminSurface.tsx, which stubs
// AppContext/ToastContext and provides the router. Unlike the admin-tab suites,
// neither page had any render test before this file, so the flows here also pin
// the interaction needed to reach each dialog: the row buttons in Orders, and
// the Unsubscribe action on an active subscriber.
//
// The names are computed from the rendered DOM with tests/_helpers/accessibleName.ts.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ComponentType } from 'react';
import {
    appContextStub,
    mockAppContext,
    renderAdminSurface,
    toastContextStub,
} from './_helpers/adminSurface';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { dialogNames, dialogsNamed } from './_helpers/accessibleName';

// The coalition page reads the subscriber table straight from Supabase; the
// Orders page only reaches services through the modals it imports.
vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));

// The harness cannot register the contexts for us — vitest scopes module mocks
// to the file that calls them (see the harness header). Two lines, once per
// file, and the pages arrive as loaders so they resolve against them.
vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

const loadOrdersPage = () => import('../pages/Orders');
const loadCoalitionSignalManager = () => import('../admin/CoalitionSignalManager');

const ORDER = {
    id: 'o-102',
    orderNumber: 'SG-102',
    userId: 'user-cara',
    customerName: 'Cara',
    customerEmail: 'cara@example.com',
    customerPhone: null,
    paymentMethod: 'paypal',
    paymentStatus: 'paid',
    orderType: 'online',
    subtotal: 200,
    tax: 0,
    discount: 0,
    total: 200,
    items: [],
    createdAt: '2026-07-14T08:00:00Z',
    paidAt: '2026-07-14T09:00:00Z',
    shippingAddress: null,
    notes: null,
};

const SUBSCRIBER = {
    id: 'sub-1',
    subscriber_type: 'email',
    contact_value: 'ada@example.com',
    status: 'active',
    source: 'drop_list',
    subscribed_at: '2026-07-10T10:00:00Z',
};

let container: HTMLDivElement;

const flush = async () => {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
};

const mount = async <P extends object>(
    load: () => Promise<{ default: ComponentType<P> }>,
) => {
    const surface = await renderAdminSurface(load);
    container = surface.container;
    await flush();
    return container;
};

const click = async (element: HTMLElement) => {
    element.focus();
    await act(async () => { element.click(); });
    await flush();
};

const topDialog = (): HTMLElement => {
    const dialogs = [...container.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')];
    expect(dialogs.length).toBeGreaterThan(0);
    return dialogs[dialogs.length - 1];
};

const buttonByTitle = (title: string): HTMLButtonElement => {
    const match = container.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
    expect(match, `no button titled "${title}"`).toBeTruthy();
    return match!;
};

beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: [], error: null } }]);
    mockAppContext();
});

describe('pages/Orders dialogs', () => {
    it('names the detail dialog after the order it opened for', async () => {
        mockAppContext({ orders: [ORDER] as never });
        await mount(loadOrdersPage);

        expect(dialogNames(container)).toEqual([]);

        await click(buttonByTitle('View Details'));

        const panel = topDialog();
        expect(dialogsNamed(container, 'Order SG-102')).toEqual([panel]);
        expect(dialogNames(container)).toEqual(['Order SG-102']);
        // The name follows the row, not a constant "Order Details" heading.
        expect(dialogsNamed(container, 'Order SG-999')).toHaveLength(0);
        expect(dialogsNamed(container, 'Order Details')).toHaveLength(0);
    });

    it('names the delete confirmation independently of the detail dialog', async () => {
        mockAppContext({ orders: [ORDER] as never });
        await mount(loadOrdersPage);

        await click(buttonByTitle('Delete Order'));

        const panel = topDialog();
        expect(dialogsNamed(container, 'Delete order')).toEqual([panel]);
        expect(dialogNames(container)).toEqual(['Delete order']);
        // The visible heading is a question; the name is the action.
        expect(dialogsNamed(container, 'Delete Order?')).toHaveLength(0);
    });
});

describe('admin/CoalitionSignalManager unsubscribe dialog', () => {
    it('names the confirmation and keeps it distinct while open', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [SUBSCRIBER], error: null } },
        ]);
        await mount(loadCoalitionSignalManager);

        const unsubscribe = [...container.querySelectorAll('button')].find(
            (button) => (button.textContent || '').trim() === 'Unsubscribe',
        );
        expect(unsubscribe).toBeTruthy();

        await click(unsubscribe as HTMLButtonElement);

        const panel = topDialog();
        expect(dialogsNamed(container, 'Confirm unsubscribe')).toEqual([panel]);
        expect(dialogNames(container)).toEqual(['Confirm unsubscribe']);
        expect(dialogsNamed(container, 'Unsubscribe User?')).toHaveLength(0);
    });
});
