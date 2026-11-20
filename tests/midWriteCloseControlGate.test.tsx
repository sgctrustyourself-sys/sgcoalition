// tests/midWriteCloseControlGate.test.tsx
//
// The other half of the mid-write gate.
//
// tests/midWriteDismissalGate.test.tsx pins Escape and the backdrop, but the
// audit of the remaining overlays found four CLOSE CONTROLS that were still live
// while their own write was outstanding — each one able to drop a half-written
// record while the request was still going out:
//
//   components/admin/PaymentRecordModal.tsx -> header X (Cancel was disabled)
//   components/ManualOrderForm.tsx          -> header X and Cancel
//   components/admin/MarketingManager.tsx   -> confirm dialog's Cancel
//   components/AIChatWidget.tsx             -> password modal's Cancel
//
// Each test starts the surface's real write, holds it open, and asserts:
//
//   1. The close control is disabled, and activating it anyway does not dismiss
//      the layer.
//   2. The write is not abandoned: when it settles, the surface reacts to it
//      (the recorder reports, the form closes, the confirmation closes).
//
// Mounting goes through tests/_helpers/adminSurface.tsx. This file supplies the
// two `vi.doMock` lines and the loaders (see that helper's header for why vitest
// forces that split), plus the module mocks for the three surfaces that write
// through a service.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import {
    appContextStub,
    mockAppContext,
    renderAdminSurface,
    toastContextStub,
    type AdminSurface,
} from './_helpers/adminSurface';
import { setReactValue } from './_helpers/nativeValueSetter';
import { recordPartialPayment } from '../services/reconcilePayment';
import { verifyFullAIPassword } from '../services/aiChat';

vi.mock('../services/reconcilePayment', () => ({ recordPartialPayment: vi.fn() }));
vi.mock('../services/aiChat', () => ({
    sendChatMessage: vi.fn(),
    verifyFullAIPassword: vi.fn(),
    getWelcomeMessage: () => 'Welcome.',
}));

vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

const loadPaymentRecordModal = () => import('../components/admin/PaymentRecordModal');
const loadManualOrderForm = () => import('../components/ManualOrderForm');
const loadMarketingManager = () => import('../components/admin/MarketingManager');
const loadAIChatWidget = () => import('../components/AIChatWidget');

// ---------- FIXTURES ----------

const PRODUCT = {
    id: 'p-1',
    name: 'Coalition Wallet',
    price: 150,
    images: ['/images/wallet.png'],
    sizes: ['M'],
    sizeInventory: { M: 5 },
};

function jsonResponse(body: unknown, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    } as unknown as Response;
}

const STATS_PAYLOAD = {
    audience: { total: 1, email: 1, sms: 0, by_source: { drop_list: 1 } },
    contacts: [{ id: 'c1', email: 'buyer@example.com', phone: null, source: 'drop_list' }],
    campaigns: [],
};

describe('mid-write close-control gate', () => {
    let surface: AdminSurface;
    let container: HTMLDivElement;

    const flush = async () => {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    };

    const locate = <T extends HTMLElement>(selector: string, scope: ParentNode = container): T => {
        const element = scope.querySelector<T>(selector);
        expect(element, `no element matching ${selector}`).toBeTruthy();
        return element as T;
    };

    const buttonByText = (text: string, scope: ParentNode = container): HTMLButtonElement => {
        const match = [...scope.querySelectorAll('button')]
            .find((button) => (button.textContent || '').includes(text));
        expect(match, `no button containing "${text}"`).toBeTruthy();
        return match as HTMLButtonElement;
    };

    /** Focus the control, then activate it — a real click does not move focus. */
    const activate = async (element: HTMLElement) => {
        element.focus();
        await act(async () => { element.click(); });
        await flush();
    };

    /** Set a <select>, then fire the change React listens for. */
    const chooseOption = async (select: HTMLSelectElement, value: string) => {
        await act(async () => {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        // jsdom has no layout, so the chat widget's scroll-to-bottom would throw.
        (Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = vi.fn();
        mockAppContext();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('PaymentRecordModal: the header X cannot dismiss the recorder mid-write', async () => {
        // Hold the real recording RPC open.
        let settle: () => void = () => {};
        vi.mocked(recordPartialPayment).mockImplementationOnce(() => new Promise((resolve) => {
            settle = () => resolve({ success: true, fully_reconciled: false, new_balance_due: 10 });
        }));

        const onClose = vi.fn();
        const onRecorded = vi.fn();
        surface = await renderAdminSurface(loadPaymentRecordModal, {
            props: {
                orderId: 'o-100',
                orderNumber: 'SG-100',
                customerName: 'Alice',
                balanceDue: 30,
                paidAmount: 20,
                total: 50,
                onClose,
                onRecorded,
            },
        });
        container = surface.container;

        const dialog = locate<HTMLElement>('[role="dialog"]');
        const close = locate<HTMLButtonElement>('button[aria-label="Close record payment dialog"]', dialog);
        const cancel = buttonByText('Cancel', dialog);
        const record = buttonByText('Record $', dialog);
        expect(cancel.disabled).toBe(false);

        await activate(record);
        expect(buttonByText('Recording...', dialog)).toBeTruthy();

        // The three dismiss paths must agree: Cancel is disabled, so the header X
        // is too — it was the one control still live during the write.
        expect(cancel.disabled).toBe(true);
        expect(close.disabled).toBe(true);

        await activate(close);
        expect(onClose).not.toHaveBeenCalled();
        expect(container.querySelector('[aria-label="Close record payment dialog"]')).toBeTruthy();

        await act(async () => { settle(); });
        await flush();

        // The recording landed and the modal reported it rather than vanishing.
        expect(onRecorded).toHaveBeenCalledWith({ amount: 30, proofUrl: null, fullyReconciled: false });
    });

    it('ManualOrderForm: neither the header X nor Cancel can drop a half-built order mid-write', async () => {
        let settle: () => void = () => {};
        const addOrder = vi.fn(() => new Promise<void>((resolve) => { settle = resolve; }));
        mockAppContext({
            products: [PRODUCT],
            addOrder,
            generateOrderNumber: () => 'SG-900',
            calculateReward: () => 10,
        });

        const onClose = vi.fn();
        const onSuccess = vi.fn();
        surface = await renderAdminSurface(loadManualOrderForm, { props: { onClose, onSuccess } });
        container = surface.container;

        const dialog = locate<HTMLElement>('[role="dialog"]');
        await act(async () => { setReactValue(locate<HTMLInputElement>('#customerName', dialog), 'Alice'); });
        await act(async () => { setReactValue(locate<HTMLInputElement>('#customerEmail', dialog), 'alice@x.com'); });
        await chooseOption(locate<HTMLSelectElement>('#product-0', dialog), 'p-1');
        await chooseOption(locate<HTMLSelectElement>('#size-0', dialog), 'M');

        const close = locate<HTMLButtonElement>('button[aria-label="Close form"]', dialog);
        const cancel = buttonByText('Cancel', dialog);
        const submit = buttonByText('Create Order', dialog);

        await activate(submit);
        expect(addOrder).toHaveBeenCalledTimes(1);
        expect(submit.disabled).toBe(true);

        expect(cancel.disabled).toBe(true);
        expect(close.disabled).toBe(true);

        await activate(close);
        await activate(cancel);
        expect(onClose).not.toHaveBeenCalled();
        expect(container.querySelector('button[aria-label="Close form"]')).toBeTruthy();

        await act(async () => { settle(); });
        await flush();

        // Settled: the form hands off to its own success path.
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('MarketingManager: the confirmation cannot be cancelled while the blast is going out', async () => {
        let settleResponse: () => void = () => {};
        const fetchMock = vi.fn((url: string) => {
            if (String(url) === '/api/marketing-send') {
                return new Promise((resolve) => {
                    settleResponse = () => resolve(jsonResponse({
                        success: true,
                        audienceCount: 1,
                        email: { sent: 1 },
                        sms: { sent: 0 },
                    }));
                });
            }
            return Promise.resolve(jsonResponse(STATS_PAYLOAD));
        });
        vi.stubGlobal('fetch', fetchMock);

        surface = await renderAdminSurface(loadMarketingManager);
        container = surface.container;

        await act(async () => { buttonByText('Composer').click(); });

        await act(async () => { setReactValue(locate<HTMLInputElement>('input[placeholder="Spring drop reminder"]'), 'Spring Drop'); });
        await act(async () => { setReactValue(locate<HTMLInputElement>('input[placeholder="Spring drop is live"]'), 'Spring drop'); });
        await act(async () => {
            setReactValue(locate<HTMLTextAreaElement>('textarea[placeholder="<h1>Spring drop is live</h1><p>...</p>"]'), '<p>Spring drop is live.</p>');
        });

        await activate(buttonByText('Send Now'));
        const confirm = locate<HTMLElement>('[aria-label="Confirm send to live audience"]');
        const send = buttonByText('Send', confirm);
        const cancel = buttonByText('Cancel', confirm);

        await activate(send);
        expect(buttonByText('Sending...', confirm)).toBeTruthy();
        expect(cancel.disabled).toBe(true);

        // Escape is locked on `sending`; Cancel used to be the way around it.
        await activate(cancel);
        expect(container.querySelector('[aria-label="Confirm send to live audience"]')).toBeTruthy();
        expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain('/api/marketing-send');

        await act(async () => { settleResponse(); });
        await flush();

        // Settled: the confirmation closes and the send path runs — the composer
        // is replaced by the history view, which reads the endpoint again.
        expect(container.querySelector('[aria-label="Confirm send to live audience"]')).toBeNull();
        expect(container.querySelector('input[placeholder="Spring drop reminder"]')).toBeNull();
        expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
            '/api/marketing-stats',
            '/api/marketing-send',
            '/api/marketing-stats',
        ]);
    });

    it('AIChatWidget: the password panel cannot be cancelled while the check is in flight', async () => {
        let settle: () => void = () => {};
        vi.mocked(verifyFullAIPassword).mockImplementationOnce(() => new Promise((resolve) => {
            settle = () => resolve(true);
        }));

        surface = await renderAdminSurface(loadAIChatWidget);
        container = surface.container;

        await activate(locate<HTMLButtonElement>('button[aria-label="Open Coalition AI support chat"]'));
        await activate(buttonByText('Open Full AI Portal'));

        const panel = locate<HTMLElement>('[aria-label="Open AI portal"]');
        await act(async () => { setReactValue(locate<HTMLInputElement>('input[type="password"]', panel), 'let-me-in'); });

        const cancel = buttonByText('Cancel', panel);
        await activate(buttonByText('Open Portal', panel));
        expect(buttonByText('Checking...', panel)).toBeTruthy();
        expect(cancel.disabled).toBe(true);

        // Escape is locked on `isUnlocking`; Cancel must be inert too.
        await activate(cancel);
        expect(container.querySelector('[aria-label="Open AI portal"]')).toBeTruthy();

        await act(async () => { settle(); });
        await flush();

        // Settled and accepted: the panel closes on its own success path.
        expect(container.querySelector('[aria-label="Open AI portal"]')).toBeNull();
    });
});
