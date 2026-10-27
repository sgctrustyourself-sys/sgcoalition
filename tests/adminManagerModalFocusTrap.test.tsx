// tests/adminManagerModalFocusTrap.test.tsx
//
// The keyboard contract for the overlays owned by the three admin manager tabs
// that adopted useFocusTrap:
//
//   components/admin/OrderManager.tsx        -> Order Details, Delete Order?
//   components/admin/SGCoinPayoutManager.tsx -> Payout Details, Mark Payout
//                                               Completed, Reject Payout Request
//   components/admin/SGCoinRequestManager.tsx-> Purchase Details, Reject Request
//
// plus the dialogs OrderManager stacks on top of its detail panel
// (PaymentRecordModal, the customer-link overlay, Invoice) and the manual order
// form. These are not decorative assertions on aria attributes: each one fails
// if a component forgets the trap, and the two "stacked layer" cases fail if the
// base panel keeps its own trap running underneath an overlay — because then one
// Escape would close both layers at once.
//
//   1. Focus moves INTO the dialog on open.
//   2. Escape calls that component's own close handler and returns focus to the
//      control that opened it (the row button for the managers, the passed-in
//      opener for the standalone dialogs).
//   3. Tab wraps inside the panel instead of walking into the table behind it.
//   4. The dialogs that disable every control mid-write (recording a payment,
//      rejecting a payout/purchase) refuse to dismiss on Escape while that write
//      is in flight — and the rejection dialogs drop the half-typed reason, the
//      same way their Cancel button does.
//
// The real components are rendered (not stubs): the point is that each one
// wired the hook correctly. Child dialogs of OrderManager are therefore real
// too, which is why every service they touch is mocked below.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import {
    appContextStub,
    mockAppContext,
    renderAdminSurface,
    toastContextStub,
    useAppMock,
} from './_helpers/adminSurface';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { dialogNames, dialogsNamed } from './_helpers/accessibleName';
import { FOCUSABLE_SELECTOR } from '../hooks/useFocusTrap';

// ---------- LOADERS ----------
// Every surface below arrives through the harness as a loader: a static import
// would resolve the mocked contexts before the harness checks them, and the
// loader is what lets each render mount a fresh tree.

const loadOrderManager = () => import('../components/admin/OrderManager');
const loadPayoutManager = () => import('../components/admin/SGCoinPayoutManager');
const loadRequestManager = () => import('../components/admin/SGCoinRequestManager');
const loadPaymentRecordModal = () => import('../components/admin/PaymentRecordModal');
const loadManualOrderForm = () => import('../components/ManualOrderForm');
const loadInvoice = () => import('../components/Invoice');

// ---------- HOISTED MOCKS ----------
// One hoisted bag so every vi.mock factory below can stay a one-liner.

const m = vi.hoisted(() => ({
    // OrderManager + the dialogs it stacks
    fetchShipmentStatuses: vi.fn(),
    buyLabelForOrder: vi.fn(),
    reconcileBalancePayment: vi.fn(),
    recordPartialPayment: vi.fn(),
    uploadPaymentProof: vi.fn(),
    buildCustomerProfile: vi.fn(),
    buildCustomerProfileByEmail: vi.fn(),
    // Payout manager
    getAllPayoutRequests: vi.fn(),
    getPayoutRequestStats: vi.fn(),
    approvePayoutRequest: vi.fn(),
    completePayoutRequest: vi.fn(),
    rejectPayoutRequest: vi.fn(),
    // Purchase request manager
    getAllPurchaseRequests: vi.fn(),
    approvePurchaseRequest: vi.fn(),
    rejectPurchaseRequest: vi.fn(),
}));

vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));

// The harness cannot register the contexts for us — vitest scopes module mocks
// to the file that calls them (see the harness header). Two lines, once per
// file, and every surface below arrives as a loader so it resolves against them.
vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

vi.mock('../services/adminShipments', () => ({
    fetchShipmentStatuses: m.fetchShipmentStatuses,
}));

vi.mock('../services/buyLabel', () => ({ buyLabelForOrder: m.buyLabelForOrder }));

vi.mock('../services/reconcilePayment', () => ({
    recordPartialPayment: m.recordPartialPayment,
    reconcileBalancePayment: m.reconcileBalancePayment,
}));

vi.mock('../services/paymentProofUpload', () => ({
    validatePaymentProofFile: () => ({ valid: true }),
    uploadPaymentProof: m.uploadPaymentProof,
}));

vi.mock('../utils/customerProfile', () => ({
    buildCustomerProfile: m.buildCustomerProfile,
    buildCustomerProfileByEmail: m.buildCustomerProfileByEmail,
}));

vi.mock('../services/payoutRequest', () => ({
    getAllPayoutRequests: m.getAllPayoutRequests,
    getPayoutRequestStats: m.getPayoutRequestStats,
    approvePayoutRequest: m.approvePayoutRequest,
    completePayoutRequest: m.completePayoutRequest,
    rejectPayoutRequest: m.rejectPayoutRequest,
    MIN_PAYOUT_SGC: 5000,
}));

vi.mock('../services/purchaseRequest', () => ({
    getAllPurchaseRequests: m.getAllPurchaseRequests,
    approvePurchaseRequest: m.approvePurchaseRequest,
    rejectPurchaseRequest: m.rejectPurchaseRequest,
}));

vi.mock('../services/emailService', () => ({
    sendApprovalEmail: vi.fn().mockResolvedValue(undefined),
    sendRejectionEmail: vi.fn().mockResolvedValue(undefined),
    sendPayoutApprovedEmail: vi.fn().mockResolvedValue(undefined),
    sendPayoutCompletedEmail: vi.fn().mockResolvedValue(undefined),
    sendPayoutRejectedEmail: vi.fn().mockResolvedValue(undefined),
}));

import OrderManager from '../components/admin/OrderManager';
import SGCoinPayoutManager from '../components/admin/SGCoinPayoutManager';
import SGCoinRequestManager from '../components/admin/SGCoinRequestManager';
import PaymentRecordModal from '../components/admin/PaymentRecordModal';
import ManualOrderForm from '../components/ManualOrderForm';
import Invoice from '../components/Invoice';

// ---------- FIXTURES ----------

// createdAt DEscending order of the rendered rows: SG-102 (Cara) first, then
// SG-101 (Bob, pending with a balance due - the only row that offers Record
// Payment), then SG-100 (Alice).
const ORDER_CARA = {
    id: 'o-102', orderNumber: 'SG-102', userId: 'user-cara',
    customerName: 'Cara', customerEmail: 'cara@x.com',
    paymentMethod: 'paypal', paymentStatus: 'refunded',
    orderType: 'online', total: 200, subtotal: 200,
    items: [{ productName: 'Tee', productImage: '/t.png', selectedSize: 'S', quantity: 1, total: 200 }],
    createdAt: '2026-07-14T08:00:00Z',
};

const ORDER_BOB_BALANCE = {
    id: 'o-101', orderNumber: 'SG-101', userId: 'user-bob',
    customerName: 'Bob', customerEmail: 'bob@x.com',
    paymentMethod: 'cashapp', paymentStatus: 'pending',
    orderType: 'manual', total: 80, subtotal: 80,
    paidAmount: 50, balanceDue: 30,
    items: [{ productName: 'Hat', productImage: '/h.png', selectedSize: 'L', quantity: 2, total: 80 }],
    createdAt: '2026-07-12T09:00:00Z',
};

const ORDER_ALICE = {
    id: 'o-100', orderNumber: 'SG-100', userId: 'user-alice',
    customerName: 'Alice', customerEmail: 'alice@x.com',
    paymentMethod: 'paypal', paymentStatus: 'paid',
    orderType: 'online', total: 150, subtotal: 150,
    items: [{ productName: 'Wallet', productImage: '/w.png', selectedSize: 'M', quantity: 1, total: 150 }],
    createdAt: '2026-07-10T10:00:00Z',
};

const ORDERS = [ORDER_ALICE, ORDER_BOB_BALANCE, ORDER_CARA];

const PAYOUT_PENDING = {
    id: 'req-pending-5000', userId: 'user-alice', email: 'alice@sgcoalition.test',
    walletAddress: '0x1111111111111111111111111111111111111111',
    amount: 5000, status: 'pending',
    createdAt: '2026-07-14T08:00:00Z', updatedAt: '2026-07-14T08:00:00Z',
};

const PAYOUT_APPROVED = {
    id: 'req-approved-3000', userId: 'user-bob', email: 'bob@sgcoalition.test',
    walletAddress: '0x2222222222222222222222222222222222222222',
    amount: 3000, status: 'approved',
    createdAt: '2026-07-15T09:00:00Z', updatedAt: '2026-07-16T10:00:00Z',
};

const PURCHASE_PENDING = {
    id: 'pr-pending', userId: 'user-alice', email: 'alice@sgcoalition.test',
    walletAddress: '0x4444444444444444444444444444444444444444',
    amount: 1000, status: 'pending',
    createdAt: '2026-07-13T08:00:00Z', updatedAt: '2026-07-13T08:00:00Z',
};

const PURCHASE_APPROVED = {
    id: 'pr-approved', userId: 'user-bob', email: 'bob@sgcoalition.test',
    walletAddress: '0x5555555555555555555555555555555555555555',
    amount: 2500, status: 'approved',
    createdAt: '2026-07-11T08:00:00Z', updatedAt: '2026-07-12T08:00:00Z',
};

const INVOICE_ORDER = {
    id: 'o-102', orderNumber: 'SG-102', userId: 'user-cara',
    customerName: 'Cara', customerEmail: 'cara@x.com',
    paymentMethod: 'paypal', paymentStatus: 'refunded',
    orderType: 'online', total: 200, subtotal: 200,
    items: [{ productName: 'Tee', productImage: '/t.png', selectedSize: 'S', quantity: 1, price: 200, total: 200 }],
    createdAt: '2026-07-14T08:00:00Z',
};

// ---------- SHARED TEST HARNESS ----------

const press = async (key: string, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    await act(async () => { document.dispatchEvent(event); });
    return event;
};

/** The tab stops the hook itself cycles, in document order. */
const stopsWithin = (scope: HTMLElement): HTMLElement[] =>
    [...scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];

/** Writes through the native setter so React's onChange sees the keystroke. */
const typeInto = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set as
        (this: HTMLInputElement | HTMLTextAreaElement, v: string) => void;
    await act(async () => {
        setter.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
    });
};

describe('admin manager modals: Escape + focus containment', () => {
    // Module-scoped container: the harness owns the root and the teardown, this
    // file just keeps the handle the assertions read by name.
    let container: HTMLDivElement;

    const mount = async <P extends object>(
        load: () => Promise<{ default: React.ComponentType<P> }>,
        props?: P,
    ) => {
        const surface = await renderAdminSurface(load, { props });
        container = surface.container;
        return surface;
    };

    const flush = async () => {
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    };

    /** The deepest overlay currently mounted — the one that should hold focus. */
    const topDialog = (): HTMLElement => {
        const dialogs = [...container.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')];
        expect(dialogs.length).toBeGreaterThan(0);
        return dialogs[dialogs.length - 1];
    };

    const buttonByText = (text: string, index = 0, scope: ParentNode = container): HTMLButtonElement => {
        const matches = [...scope.querySelectorAll('button')]
            .filter((b) => (b.textContent || '').trim().includes(text));
        expect(matches[index], `no button containing "${text}" at index ${index}`).toBeTruthy();
        return matches[index] as HTMLButtonElement;
    };

    const buttonByTitle = (title: string, index = 0): HTMLButtonElement => {
        const match = container.querySelectorAll<HTMLButtonElement>(`button[title="${title}"]`)[index];
        expect(match, `no button titled "${title}" at index ${index}`).toBeTruthy();
        return match;
    };

    /** Focus the control, then activate it — a real click does not move focus. */
    const activate = async (el: HTMLButtonElement) => {
        el.focus();
        await act(async () => { el.click(); });
        await flush();
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        mockAppContext({
            orders: ORDERS,
            updateOrderStatus: vi.fn().mockResolvedValue(undefined),
            deleteOrder: vi.fn().mockResolvedValue(undefined),
            addOrder: vi.fn().mockResolvedValue(undefined),
            generateOrderNumber: vi.fn(() => 'SG-M-1'),
            calculateReward: vi.fn(() => 0),
            products: [],
        });

        m.fetchShipmentStatuses.mockResolvedValue([]);
        m.buildCustomerProfile.mockResolvedValue(null);
        m.buildCustomerProfileByEmail.mockResolvedValue({
            email: 'cara@x.com', orderCount: 1, totalSpend: 200,
            firstOrderDate: '2026-07-14T00:00:00Z', lastOrderDate: '2026-07-14T00:00:00Z',
            isVerifiedBuyer: true,
        });

        m.getAllPayoutRequests.mockResolvedValue([PAYOUT_PENDING, PAYOUT_APPROVED]);
        m.getPayoutRequestStats.mockResolvedValue({
            totalRequests: 2, pendingRequests: 1, approvedRequests: 1, completedRequests: 0,
            rejectedRequests: 0, totalAmountRequested: 8000, totalAmountCompleted: 0,
        });
        m.approvePayoutRequest.mockResolvedValue(true);
        m.completePayoutRequest.mockResolvedValue(true);
        m.rejectPayoutRequest.mockResolvedValue(true);

        m.getAllPurchaseRequests.mockResolvedValue([PURCHASE_PENDING, PURCHASE_APPROVED]);
        m.approvePurchaseRequest.mockResolvedValue(true);
        m.rejectPurchaseRequest.mockResolvedValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ------------------------------------------------------------------
    // OrderManager
    // ------------------------------------------------------------------

    describe('OrderManager', () => {
        it('Escape closes the order detail dialog and returns focus to the row button that opened it', async () => {
            await mount(loadOrderManager);

            const eye = buttonByTitle('View Details');
            await activate(eye);

            expect(container.innerHTML).toContain('Order Details');
            expect(container.innerHTML).toContain('SG-102');

            const panel = topDialog();
            expect(panel.getAttribute('aria-modal')).toBe('true');
            // Focus moved INTO the dialog on open.
            expect(panel.contains(document.activeElement)).toBe(true);
            // The rendered name comes from the heading it points at.
            expect(dialogsNamed(container, 'Order Details')).toEqual([panel]);
            expect(dialogNames(container)).toEqual(['Order Details']);

            await press('Escape');

            expect(container.innerHTML).not.toContain('Order Details');
            expect(document.activeElement).toBe(eye);
        });

        it('Tab wraps inside the detail panel instead of reaching the table behind it', async () => {
            await mount(loadOrderManager);
            await activate(buttonByTitle('View Details'));

            const panel = topDialog();
            const stops = stopsWithin(panel);
            expect(stops.length).toBeGreaterThan(2);

            const first = stops[0];
            const last = stops[stops.length - 1];

            last.focus();
            expect(document.activeElement).toBe(last);
            await press('Tab');
            expect(document.activeElement).toBe(first);

            first.focus();
            await press('Tab', true);
            expect(document.activeElement).toBe(last);
        });

        it('Escape closes the delete confirmation and returns focus to the trash button', async () => {
            await mount(loadOrderManager);

            const trash = buttonByTitle('Delete');
            await activate(trash);

            expect(container.innerHTML).toContain('Delete Order?');
            const panel = topDialog();
            expect(panel.getAttribute('role')).toBe('alertdialog');
            expect(panel.contains(document.activeElement)).toBe(true);

            await press('Escape');

            expect(container.innerHTML).not.toContain('Delete Order?');
            expect(document.activeElement).toBe(trash);
            // Nothing was deleted: Escape is a cancel, not a second confirm.
            expect(useAppMock.mock.results[0]?.value?.deleteOrder).not.toHaveBeenCalled();
        });

        it('with the payment recorder stacked on top, Escape closes the recorder and leaves the detail panel open', async () => {
            await mount(loadOrderManager);

            // Row 2 is SG-101: pending with a $30 balance due, the only row that
            // renders the Record Payment button.
            await activate(buttonByTitle('View Details', 1));
            const recordButton = buttonByText('Record Payment');
            await activate(recordButton);

            expect(container.querySelector('#record-payment-title')).toBeTruthy();
            const recorder = topDialog();
            expect(recorder.querySelector('#record-payment-title')).toBeTruthy();
            // The recorder, not the panel underneath, owns focus.
            expect(recorder.contains(document.activeElement)).toBe(true);
            expect(container.innerHTML).toContain('Order Details');

            await press('Escape');

            // Only the top layer closed: the recorder is gone while the detail
            // panel — and its own "Record Payment" button — stayed mounted.
            expect(container.querySelector('#record-payment-title')).toBeNull();
            expect(buttonByText('Record Payment')).toBeTruthy();
            expect(container.innerHTML).toContain('Order Details');
            expect(container.innerHTML).toContain('SG-101');
            // Focus is back inside the still-open panel rather than on the page.
            expect(topDialog().contains(document.activeElement)).toBe(true);
        });

        it('with the customer link overlay stacked on top, Escape closes only that overlay', async () => {
            await mount(loadOrderManager);
            await activate(buttonByTitle('View Details'));

            // The details panel reuses the table's customer button with its own
            // test id, so this is the trigger that stacks the overlay ON the
            // panel rather than the row-level one behind it.
            const panel = topDialog();
            const trigger = panel.querySelector<HTMLButtonElement>('[data-testid="customer-link-trigger-detail"]');
            expect(trigger).toBeTruthy();
            await activate(trigger!);

            expect(container.querySelector('[data-testid="customer-link-modal"]')).toBeTruthy();
            const overlay = topDialog();
            expect(overlay.getAttribute('role')).toBe('dialog');
            expect(overlay.contains(document.activeElement)).toBe(true);

            await press('Escape');

            expect(container.querySelector('[data-testid="customer-link-modal"]')).toBeNull();
            expect(container.innerHTML).toContain('Order Details');
            expect(topDialog().contains(document.activeElement)).toBe(true);
        });
    });

    // ------------------------------------------------------------------
    // SGCoinPayoutManager
    // ------------------------------------------------------------------

    describe('SGCoinPayoutManager', () => {
        const render = () => mount(loadPayoutManager, { adminUserId: 'admin-123' });

        it('Escape closes the payout detail dialog and returns focus to the row button', async () => {
            await render();

            const view = buttonByText('View');
            await activate(view);

            expect(container.innerHTML).toContain('Payout Request Details');
            const panel = topDialog();
            expect(panel.getAttribute('aria-modal')).toBe('true');
            expect(panel.contains(document.activeElement)).toBe(true);
            expect(dialogsNamed(container, 'Payout Request Details')).toEqual([panel]);
            expect(dialogNames(container)).toEqual(['Payout Request Details']);

            await press('Escape');

            expect(container.innerHTML).not.toContain('Payout Request Details');
            expect(document.activeElement).toBe(view);
        });

        it('Escape closes the Mark Completed dialog and leaves the payout detail open', async () => {
            await render();

            // Row 2 is the approved request — the only one offering Mark Completed.
            await activate(buttonByText('View', 1));
            await activate(buttonByText('Mark Completed'));

            expect(container.innerHTML).toContain('Mark Payout Completed');
            const complete = topDialog();
            expect(complete.querySelector('#payout-complete-title')).toBeTruthy();
            expect(complete.contains(document.activeElement)).toBe(true);
            expect(dialogsNamed(container, 'Mark Payout Completed')).toEqual([complete]);
            // The detail panel it stacks on is still named in its own right.
            expect(dialogsNamed(container, 'Payout Request Details')).toHaveLength(1);

            await press('Escape');

            expect(container.innerHTML).not.toContain('Mark Payout Completed');
            expect(container.innerHTML).toContain('Payout Request Details');
            expect(topDialog().contains(document.activeElement)).toBe(true);
            // Escape must not fall through to "record the transfer anyway".
            expect(m.completePayoutRequest).not.toHaveBeenCalled();
        });

        it('the approve confirmation is the top layer: Escape closes it and the detail dialog stays', async () => {
            await render();

            await activate(buttonByText('View'));
            await activate(buttonByText('Approve'));

            expect(container.innerHTML).toContain('Approve 5,000 SGCOIN payout?');
            const confirm = topDialog();
            expect(confirm.contains(document.activeElement)).toBe(true);

            await press('Escape');

            expect(container.innerHTML).not.toContain('Approve 5,000 SGCOIN payout?');
            expect(container.innerHTML).toContain('Payout Request Details');
            expect(m.approvePayoutRequest).not.toHaveBeenCalled();
        });

        it('Escape closes the reject dialog and discards the half-typed reason, like Cancel', async () => {
            await render();

            await activate(buttonByText('View'));
            await activate(buttonByText('Reject'));

            const rejectDialog = topDialog();
            expect(dialogsNamed(container, 'Reject Payout Request')).toEqual([rejectDialog]);
            expect(dialogsNamed(container, 'Payout Request Details')).toHaveLength(1);

            const reasons = () => container.querySelector<HTMLTextAreaElement>('textarea')!;
            expect(reasons()).toBeTruthy();
            await typeInto(reasons(), 'Wallet address is wrong');
            expect(reasons().value).toBe('Wallet address is wrong');

            await press('Escape');

            expect(container.innerHTML).not.toContain('Reject Payout Request');
            expect(container.innerHTML).toContain('Payout Request Details');
            expect(m.rejectPayoutRequest).not.toHaveBeenCalled();

            // Reopening starts clean: the Escape handler reset the field.
            await activate(buttonByText('Reject'));
            expect(reasons().value).toBe('');
        });

        it('Escape is inert while the payout rejection is being written', async () => {
            let settle: (value: boolean) => void = () => {};
            m.rejectPayoutRequest.mockImplementation(
                () => new Promise<boolean>((resolve) => { settle = resolve; }),
            );

            await render();
            await activate(buttonByText('View'));
            await activate(buttonByText('Reject'));

            await typeInto(container.querySelector<HTMLTextAreaElement>('textarea')!, 'Not eligible');
            await activate(buttonByText('Confirm Rejection'));
            expect(buttonByText('Rejecting...')).toBeTruthy();

            await press('Escape');

            // Still open, and focus was not yanked out of it.
            expect(container.innerHTML).toContain('Reject Payout Request');
            expect(buttonByText('Rejecting...')).toBeTruthy();
            expect(topDialog().contains(document.activeElement)).toBe(true);

            settle(true);
            await flush();
        });
    });

    // ------------------------------------------------------------------
    // SGCoinRequestManager
    // ------------------------------------------------------------------

    describe('SGCoinRequestManager', () => {
        const render = () =>
            mount(loadRequestManager, { adminWalletAddress: '0xadmin' });

        it('Escape closes the purchase detail dialog and returns focus to the row button', async () => {
            await render();

            const view = buttonByText('View');
            await activate(view);

            expect(container.innerHTML).toContain('Purchase Request Details');
            const panel = topDialog();
            expect(panel.contains(document.activeElement)).toBe(true);
            expect(dialogsNamed(container, 'Purchase Request Details')).toEqual([panel]);
            expect(dialogNames(container)).toEqual(['Purchase Request Details']);

            await press('Escape');

            expect(container.innerHTML).not.toContain('Purchase Request Details');
            expect(document.activeElement).toBe(view);
        });

        it('Escape closes the reject dialog and leaves the purchase detail open', async () => {
            await render();

            await activate(buttonByText('View'));
            await activate(buttonByText('Reject'));

            expect(container.innerHTML).toContain('Reject Request');
            const reject = topDialog();
            expect(reject.querySelector('#purchase-reject-title')).toBeTruthy();
            expect(reject.contains(document.activeElement)).toBe(true);
            expect(dialogsNamed(container, 'Reject Request')).toEqual([reject]);
            expect(dialogsNamed(container, 'Purchase Request Details')).toHaveLength(1);

            await press('Escape');

            expect(container.innerHTML).not.toContain('Reject Request');
            expect(container.innerHTML).toContain('Purchase Request Details');
            expect(m.rejectPurchaseRequest).not.toHaveBeenCalled();
            expect(topDialog().contains(document.activeElement)).toBe(true);
        });
    });

    // ------------------------------------------------------------------
    // Dialogs OrderManager stacks / opens
    // ------------------------------------------------------------------

    describe('PaymentRecordModal', () => {
        let onClose: ReturnType<typeof vi.fn>;
        let opener: HTMLButtonElement;

        beforeEach(() => {
            onClose = vi.fn();
            opener = document.createElement('button');
            opener.textContent = 'Record payment';
            document.body.appendChild(opener);
            opener.focus();
        });

        afterEach(() => {
            if (opener.parentNode === document.body) document.body.removeChild(opener);
        });

        const renderRecorder = () =>
            mount(loadPaymentRecordModal, {
                orderId: 'o-101', orderNumber: 'SG-101', customerName: 'Bob',
                balanceDue: 30, paidAmount: 50, total: 80,
                onClose, onRecorded: vi.fn(),
            });

        it('Escape calls onClose and returns focus to the opener', async () => {
            await renderRecorder();

            const panel = topDialog();
            expect(panel.querySelector('#record-payment-title')).toBeTruthy();
            expect(panel.contains(document.activeElement)).toBe(true);

            await press('Escape');

            expect(onClose).toHaveBeenCalledTimes(1);
            expect(document.activeElement).toBe(opener);
        });

        it('Escape is inert while the payment is being recorded', async () => {
            let settle: (value: { success: boolean }) => void = () => {};
            m.recordPartialPayment.mockImplementation(
                () => new Promise<{ success: boolean }>((resolve) => { settle = resolve; }),
            );

            await renderRecorder();
            await activate(buttonByText('Record $30.00 Payment'));
            expect(buttonByText('Recording...')).toBeTruthy();

            await press('Escape');

            // The in-flight write is not abandoned: onClose was never called and
            // focus stayed in the dialog.
            expect(onClose).not.toHaveBeenCalled();
            expect(topDialog().contains(document.activeElement)).toBe(true);

            settle({ success: true });
            await flush();
        });
    });

    describe('ManualOrderForm', () => {
        let onClose: ReturnType<typeof vi.fn>;
        let opener: HTMLButtonElement;

        beforeEach(() => {
            onClose = vi.fn();
            opener = document.createElement('button');
            opener.textContent = 'Create order';
            document.body.appendChild(opener);
            opener.focus();
        });

        afterEach(() => {
            if (opener.parentNode === document.body) document.body.removeChild(opener);
        });

        it('Escape calls onClose and returns focus to the opener', async () => {
            await mount(loadManualOrderForm, { onClose, onSuccess: vi.fn() });

            const panel = topDialog();
            expect(panel.querySelector('#manual-order-title')).toBeTruthy();
            expect(panel.contains(document.activeElement)).toBe(true);

            await press('Escape');

            expect(onClose).toHaveBeenCalledTimes(1);
            expect(document.activeElement).toBe(opener);
        });
    });

    describe('Invoice', () => {
        let onClose: ReturnType<typeof vi.fn>;
        let opener: HTMLButtonElement;

        beforeEach(() => {
            onClose = vi.fn();
            opener = document.createElement('button');
            opener.textContent = 'Invoice';
            document.body.appendChild(opener);
            opener.focus();
        });

        afterEach(() => {
            if (opener.parentNode === document.body) document.body.removeChild(opener);
        });

        it('Escape calls onClose and returns focus to the opener', async () => {
            await mount(loadInvoice, { order: INVOICE_ORDER as never, onClose });

            const panel = topDialog();
            expect(panel.querySelector('#invoice-dialog-title')).toBeTruthy();
            expect(panel.contains(document.activeElement)).toBe(true);

            await press('Escape');

            expect(onClose).toHaveBeenCalledTimes(1);
            expect(document.activeElement).toBe(opener);
        });
    });
});
