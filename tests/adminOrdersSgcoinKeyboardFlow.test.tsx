// tests/adminOrdersSgcoinKeyboardFlow.test.tsx
//
// Keyboard-only completion for the two dialog families this file owns:
//
//   components/admin/OrderManager.tsx         -> Order Details (status select),
//                                                PaymentRecordModal (record form)
//   components/admin/SGCoinPayoutManager.tsx  -> Reject Payout Request,
//                                                Mark Payout Completed
//   components/admin/SGCoinRequestManager.tsx -> Reject Request
//
// The sibling file tests/adminManagerModalFocusTrap.test.tsx proves the trap
// itself (Escape, wrapping Tab, focus return). This one asks the next question:
// starting from the table row, can an operator who only presses Tab, Enter and
// Escape actually finish each write — and can they not lose it halfway?
//
// Enter is modelled the way the browser implements it: on a <button> the key
// activates the click that the element already has, and inside a <form> it
// submits the form. jsdom performs neither on a raw keydown, so a submit is
// driven through form.requestSubmit() — the same path the browser's Enter takes.
// The assertions therefore cover reachability (every control is in the trap's
// stop list), activation (Enter submits the form, Enter on Save sends the
// selected status) and the mid-write lock (Cancel is as inert as Escape).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import {
    appContextStub,
    mockAppContext,
    renderAdminSurface,
    toastContextStub,
} from './_helpers/adminSurface';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { accessibleName } from './_helpers/accessibleName';
import { FOCUSABLE_SELECTOR } from '../hooks/useFocusTrap';

// ---------- LOADERS ----------

const loadOrderManager = () => import('../components/admin/OrderManager');
const loadPayoutManager = () => import('../components/admin/SGCoinPayoutManager');
const loadRequestManager = () => import('../components/admin/SGCoinRequestManager');

// ---------- HOISTED MOCKS ----------

const m = vi.hoisted(() => ({
    fetchShipmentStatuses: vi.fn(),
    buyLabelForOrder: vi.fn(),
    reconcileBalancePayment: vi.fn(),
    recordPartialPayment: vi.fn(),
    buildCustomerProfile: vi.fn(),
    buildCustomerProfileByEmail: vi.fn(),
    getAllPayoutRequests: vi.fn(),
    getPayoutRequestStats: vi.fn(),
    approvePayoutRequest: vi.fn(),
    completePayoutRequest: vi.fn(),
    rejectPayoutRequest: vi.fn(),
    getAllPurchaseRequests: vi.fn(),
    approvePurchaseRequest: vi.fn(),
    rejectPurchaseRequest: vi.fn(),
}));

vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));

// Vitest scopes module mocks to the file that calls them, so the two context
// stubs are registered here and every surface arrives as a loader.
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
    uploadPaymentProof: vi.fn(),
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

// ---------- FIXTURES ----------

// createdAt descending: SG-102 (Cara) first, then SG-101 (Bob, the only row
// with a balance due, so the only one that offers Record Payment), then SG-100.
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

// ---------- SHARED HARNESS ----------

let container: HTMLDivElement;

const flush = async () => {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

const mount = async <P extends object>(
    load: () => Promise<{ default: React.ComponentType<P> }>,
    props?: P,
) => {
    const surface = await renderAdminSurface(load, { props });
    container = surface.container;
    return surface;
};

const press = async (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    await act(async () => { document.dispatchEvent(event); });
    return event;
};

/** The deepest overlay currently mounted — the one that owns focus. */
const topDialog = (): HTMLElement => {
    const dialogs = [...container.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]')];
    expect(dialogs.length).toBeGreaterThan(0);
    return dialogs[dialogs.length - 1];
};

const stopsWithin = (scope: HTMLElement): HTMLElement[] =>
    [...scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];

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

/** Focus the control, then activate it — Tab then Enter produces exactly this. */
const activate = async (el: HTMLElement) => {
    el.focus();
    await act(async () => { el.click(); });
    await flush();
};

/** Write through the native setter so React's onChange sees the keystroke. */
const typeInto = async (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value')?.set as
        (this: HTMLInputElement | HTMLTextAreaElement, v: string) => void;
    await act(async () => {
        setter.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
    });
};

/** Choose a <select> option the way the arrow keys do: value, then change. */
const chooseOption = async (select: HTMLSelectElement, value: string) => {
    await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set as
            (this: HTMLSelectElement, v: string) => void;
        setter.call(select, value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
};

/** Enter inside a form submits it; jsdom exposes that as requestSubmit(). */
const pressEnterIn = async (form: HTMLFormElement) => {
    await act(async () => { form.requestSubmit(); });
    await flush();
};

/** The AppContext's status writer; a fresh spy per test, asserted on below. */
let updateOrderStatus: ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.setOutcomes([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    updateOrderStatus = vi.fn().mockResolvedValue(undefined);
    mockAppContext({
        orders: ORDERS,
        updateOrderStatus,
        deleteOrder: vi.fn().mockResolvedValue(undefined),
        addOrder: vi.fn().mockResolvedValue(undefined),
        generateOrderNumber: vi.fn(() => 'SG-M-1'),
        calculateReward: vi.fn(() => 0),
        products: [],
    });

    m.fetchShipmentStatuses.mockResolvedValue([]);
    m.buildCustomerProfile.mockResolvedValue(null);
    m.buildCustomerProfileByEmail.mockResolvedValue(null);
    m.recordPartialPayment.mockResolvedValue({
        success: true, fully_reconciled: false, new_balance_due: 0,
    });

    m.getAllPayoutRequests.mockResolvedValue([PAYOUT_PENDING, PAYOUT_APPROVED]);
    m.getPayoutRequestStats.mockResolvedValue({
        totalRequests: 2, pendingRequests: 1, approvedRequests: 1, completedRequests: 0,
        rejectedRequests: 0, totalAmountRequested: 8000, totalAmountCompleted: 0,
    });
    m.approvePayoutRequest.mockResolvedValue(true);
    m.completePayoutRequest.mockResolvedValue(true);
    m.rejectPayoutRequest.mockResolvedValue(true);

    m.getAllPurchaseRequests.mockResolvedValue([PURCHASE_PENDING]);
    m.approvePurchaseRequest.mockResolvedValue(true);
    m.rejectPurchaseRequest.mockResolvedValue(true);
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ------------------------------------------------------------------
// OrderManager: the status select is a real, completeable control
// ------------------------------------------------------------------

describe('OrderManager status select', () => {
    it('opens on the order status, is in the tab cycle, and Enter on Save sends the chosen one', async () => {
        await mount(loadOrderManager);

        const eye = buttonByTitle('View Details');
        await activate(eye);
        const panel = topDialog();

        const select = panel.querySelector<HTMLSelectElement>('select[aria-label="Change order status"]');
        expect(select, 'the status select is not in the open dialog').toBeTruthy();

        // A control that shows nothing is not keyboard-completeable: the value
        // must start on the order's own status, not on an empty option.
        expect(select!.value).toBe('refunded');

        // The select is a tab stop, so Tab reaches it without leaving the dialog.
        const stops = stopsWithin(panel);
        expect(stops).toContain(select);

        // Nothing to commit yet: Save is disabled, which keeps it out of the tab
        // cycle, so Enter cannot send an unchanged status.
        const save = buttonByText('Save', 0, panel);
        expect(save.disabled).toBe(true);
        expect(stops).not.toContain(save);

        await chooseOption(select!, 'delivered');
        expect(save.disabled).toBe(false);
        // Choosing a status puts the action back in the cycle: Tab from the
        // select lands on Save, ready for Enter.
        expect(stopsWithin(panel)).toContain(save);

        await activate(save);
        expect(updateOrderStatus).toHaveBeenCalledTimes(1);
        expect(updateOrderStatus).toHaveBeenCalledWith('o-102', 'delivered');

        // The saved status is now the select's value, so Save is inert again
        // rather than letting the same write be sent twice.
        expect(select!.value).toBe('delivered');
        expect(buttonByText('Save', 0, panel).disabled).toBe(true);

        // And the dialog is still a dialog: Escape closes it and hands focus back.
        await press('Escape');
        expect(container.innerHTML).not.toContain('Order Details');
        expect(document.activeElement).toBe(eye);
    });
});

// ------------------------------------------------------------------
// PaymentRecordModal: the record form completes on Enter
// ------------------------------------------------------------------

describe('PaymentRecordModal keyboard completion', () => {
    const openRecorder = async () => {
        await mount(loadOrderManager);
        // Bob's row is the one with a balance due, so the one with the button.
        await activate(buttonByTitle('View Details', 1));
        await activate(buttonByText('Record Payment', 0, topDialog()));
        const panel = topDialog();
        expect(panel.querySelector('#record-payment-title')).toBeTruthy();
        return panel;
    };

    it('every field and action is in the tab cycle and Enter submits the form', async () => {
        const panel = await openRecorder();

        const form = panel.querySelector('form');
        expect(form, 'the recorder is not a form, so Enter cannot submit it').toBeTruthy();

        const stops = stopsWithin(panel);
        const amount = panel.querySelector<HTMLInputElement>('input[type="number"]')!;
        const method = panel.querySelector<HTMLSelectElement>('select')!;
        const notes = panel.querySelector<HTMLTextAreaElement>('textarea')!;
        for (const field of [amount, method, notes]) {
            expect(stops).toContain(field);
        }

        const record = buttonByText('Record $30.00 Payment', 0, panel);
        const cancel = buttonByText('Cancel', 0, panel);
        expect(stops).toContain(record);
        expect(stops).toContain(cancel);

        // Inside a form the default button type is submit, so Cancel must opt
        // out explicitly: otherwise Enter on Cancel would record the payment.
        expect(record.type).toBe('submit');
        expect(cancel.type).toBe('button');

        // The fields a keyboard user types into are named for AT as well.
        expect(panel.querySelector('label[for="record-payment-amount"]')).toBeTruthy();
        expect(panel.querySelector('label[for="record-payment-method"]')).toBeTruthy();
        expect(panel.querySelector('label[for="record-payment-notes"]')).toBeTruthy();

        await pressEnterIn(form as HTMLFormElement);

        expect(m.recordPartialPayment).toHaveBeenCalledTimes(1);
        expect(m.recordPartialPayment).toHaveBeenCalledWith('o-101', 30, null, '', 'cash');
        // Recording closes both the recorder and the detail panel it sat on.
        expect(container.querySelector('#record-payment-title')).toBeNull();
        expect(container.innerHTML).not.toContain('Order Details');
    });

    it('Enter cannot slip an out-of-range amount past the guard', async () => {
        const panel = await openRecorder();
        const form = panel.querySelector('form') as HTMLFormElement;
        const amount = panel.querySelector<HTMLInputElement>('input[type="number"]')!;

        await typeInto(amount, '999');
        await pressEnterIn(form);

        expect(m.recordPartialPayment).not.toHaveBeenCalled();
        expect(panel.textContent).toContain('Amount must be between');
        expect(container.innerHTML).toContain('Record Payment');

        // Cancel is a plain button, so Tab + Enter on it cannot submit either:
        // it closes the recorder and leaves the detail panel underneath.
        const cancel = buttonByText('Cancel', 0, panel);
        await activate(cancel);
        expect(m.recordPartialPayment).not.toHaveBeenCalled();
        expect(container.querySelector('#record-payment-title')).toBeNull();
        expect(container.innerHTML).toContain('Order Details');
    });
});

// ------------------------------------------------------------------
// Reject reason: named, focused, and locked while its write is in flight
// ------------------------------------------------------------------

describe('SGCoinPayoutManager reject reason', () => {
    const render = () => mount(loadPayoutManager, { adminUserId: 'admin-123' });

    const openReject = async () => {
        await render();
        await activate(buttonByText('View'));
        await activate(buttonByText('Reject'));
        const panel = topDialog();
        expect(panel.querySelector('#payout-reject-title')).toBeTruthy();
        return panel;
    };

    it('opens with the reason field focused and named, and Confirm waits for text', async () => {
        const panel = await openReject();

        const reason = panel.querySelector<HTMLTextAreaElement>('textarea')!;
        // Typing goes straight into the reason: no Tab needed first.
        expect(document.activeElement).toBe(reason);
        expect(stopsWithin(panel)).toContain(reason);

        // The visible label is programmatically attached, so the field is named.
        const label = panel.querySelector<HTMLLabelElement>('label[for="payout-reject-reason"]');
        expect(label?.textContent).toContain('Rejection Reason');

        const confirm = buttonByText('Confirm Rejection', 0, panel);
        expect(confirm.disabled).toBe(true);

        await typeInto(reason, 'Wallet failed on-chain verification');
        expect(buttonByText('Confirm Rejection', 0, panel).disabled).toBe(false);
    });

    it('Cancel is as inert as Escape while the rejection is being written', async () => {
        let settle: (value: boolean) => void = () => {};
        m.rejectPayoutRequest.mockImplementation(
            () => new Promise<boolean>((resolve) => { settle = resolve; }),
        );

        const panel = await openReject();
        const reason = panel.querySelector<HTMLTextAreaElement>('textarea')!;
        await typeInto(reason, 'Not eligible');
        await activate(buttonByText('Confirm Rejection', 0, panel));

        // Every control in the dialog is disabled mid-write, so there is no
        // keyboard path (Escape included) that abandons the request.
        expect(buttonByText('Rejecting...', 0, panel).disabled).toBe(true);
        expect(buttonByText('Cancel', 0, panel).disabled).toBe(true);

        await act(async () => { settle(true); });
        await flush();

        expect(m.rejectPayoutRequest).toHaveBeenCalledTimes(1);
        expect(container.innerHTML).not.toContain('Reject Payout Request');
    });
});

describe('SGCoinPayoutManager completion form', () => {
    it('names the tx-hash field and locks Cancel while the transfer is recorded', async () => {
        let settle: (value: boolean) => void = () => {};
        m.completePayoutRequest.mockImplementation(
            () => new Promise<boolean>((resolve) => { settle = resolve; }),
        );

        await mount(loadPayoutManager, { adminUserId: 'admin-123' });
        await activate(buttonByText('View', 1)); // the approved request
        await activate(buttonByText('Mark Completed'));
        const panel = topDialog();

        const txInput = panel.querySelector<HTMLInputElement>('input[placeholder="0x..."]')!;
        expect(document.activeElement).toBe(txInput);
        expect(panel.querySelector('label[for="payout-tx-hash"]')?.textContent).toContain('Transaction Hash');

        const hash = '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';
        await typeInto(txInput, hash);
        await activate(buttonByText('Confirm + Notify Customer', 0, panel));

        expect(buttonByText('Recording...', 0, panel).disabled).toBe(true);
        expect(buttonByText('Cancel', 0, panel).disabled).toBe(true);

        await act(async () => { settle(true); });
        await flush();

        expect(m.completePayoutRequest).toHaveBeenCalledWith(
            'req-approved-3000', 'admin-123', hash, undefined,
        );
    });
});

// ------------------------------------------------------------------
// Purchase reject reason
// ------------------------------------------------------------------

describe('SGCoinRequestManager reject reason', () => {
    it('names the reason field and locks Cancel while the rejection is written', async () => {
        let settle: (value: boolean) => void = () => {};
        m.rejectPurchaseRequest.mockImplementation(
            () => new Promise<boolean>((resolve) => { settle = resolve; }),
        );

        await mount(loadRequestManager, { adminWalletAddress: '0xadmin' });
        await activate(buttonByText('View'));
        await activate(buttonByText('Reject'));
        const panel = topDialog();

        const reason = panel.querySelector<HTMLTextAreaElement>('textarea')!;
        expect(document.activeElement).toBe(reason);
        expect(accessibleName(reason)).toBe('Rejection reason');

        await typeInto(reason, 'Payment proof is unreadable');
        await activate(buttonByText('Confirm Rejection', 0, panel));

        expect(buttonByText('Rejecting...', 0, panel).disabled).toBe(true);
        expect(buttonByText('Cancel', 0, panel).disabled).toBe(true);

        await act(async () => { settle(true); });
        await flush();

        expect(m.rejectPurchaseRequest).toHaveBeenCalledTimes(1);
        expect(container.innerHTML).not.toContain('Reject Request');
    });
});
