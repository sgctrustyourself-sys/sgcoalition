// tests/sgCoinPayoutTabRender.test.tsx
//
// Vitest render-flow test for components/profile/SGCoinPayoutTab.tsx.
// Mirrors the createRoot + act + vi.mock pattern used by the other admin-tab
// render-flow tests in this suite (signalManagerRender / productManagerRender / etc).
//
// 5 tests:
//   1. RENDER_HERO - balance=12450 displays formatted number, USD estimate, both action cards.
//   2. INSUFFICIENT_BALANCE - balance=1000 disables submit + tooltip mentions 5,000.
//   3. HISTORY_RENDER - 3 mixed-status rows render with correct badges + tx link.
//   4. OPEN_MODAL_AND_SUBMIT - happy path through submitPayoutRequest vi.mock.
//   5. ERROR_TOAST - RPC rejection surfaces the error message verbatim via addToast.

/// <reference types="vitest" />
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';

import SGCoinPayoutTab from '../components/profile/SGCoinPayoutTab';
import {
    submitPayoutRequest,
    getUserPayoutRequests,
    MIN_PAYOUT_SGC,
} from '../services/payoutRequest';
import { useToast } from '../context/ToastContext';

// ---------- MOCKS ----------

vi.mock('../services/payoutRequest', () => ({
    submitPayoutRequest: vi.fn(),
    getUserPayoutRequests: vi.fn().mockResolvedValue([]),
    MIN_PAYOUT_SGC: 5000,
}));

vi.mock('../context/AppContext', () => ({
    useApp: () => ({
        user: {
            uid: 'user-123',
            email: 'caller@sgcoalition.test',
            displayName: 'Test Caller',
            walletAddress: '0xmamamamamamamamamamamamamamamamamama',
            connectedWalletAddress:
                '0x1111111111111111111111111111111111111111',
        },
    }),
}));

vi.mock('../context/ToastContext', () => ({
    useToast: vi.fn(),
}));

vi.mock('../services/web3Service', () => ({
    connectWallet: vi.fn().mockResolvedValue({
        address: '0x2222222222222222222222222222222222222222',
    }),
    formatAddress: (a: string) => a.slice(0, 6) + '...' + a.slice(-4),
    listenForAccountChanges: vi.fn(),
    switchToPolygon: vi.fn(),
}));

// ---------- FIXTURES ----------

const FAKE_REQUESTS = [
    {
        id: 'req-pending-1',
        userId: 'user-123',
        email: 'caller@sgcoalition.test',
        walletAddress: '0x1111111111111111111111111111111111111111',
        amount: 5000,
        status: 'pending',
        createdAt: '2026-07-16T08:00:00Z',
        updatedAt: '2026-07-16T08:00:00Z',
    },
    {
        id: 'req-completed-2',
        userId: 'user-123',
        email: 'caller@sgcoalition.test',
        walletAddress: '0x1111111111111111111111111111111111111111',
        amount: 3000,
        status: 'completed',
        txHash: '0xabcabcabcabcabcabcabcabcabcabcabcabcabc',
        createdAt: '2026-07-10T08:00:00Z',
        updatedAt: '2026-07-11T08:00:00Z',
        processedAt: '2026-07-11T08:00:00Z',
    },
    {
        id: 'req-rejected-3',
        userId: 'user-123',
        email: 'caller@sgcoalition.test',
        walletAddress: '0x1111111111111111111111111111111111111111',
        amount: 1000,
        status: 'rejected',
        rejectionReason: 'Address failed on-chain verification',
        createdAt: '2026-07-05T08:00:00Z',
        updatedAt: '2026-07-06T08:00:00Z',
        processedAt: '2026-07-06T08:00:00Z',
    },
];

// ---------- HELPERS ----------

beforeEach(() => {
    vi.mocked(submitPayoutRequest).mockReset();
    vi.mocked(getUserPayoutRequests).mockReset();
    vi.mocked(getUserPayoutRequests).mockResolvedValue([]);
    vi.mocked(useToast).mockClear();
    vi.mocked(useToast).mockReturnValue({
        addToast: vi.fn(),
        removeToast: vi.fn(),
        toasts: [],
    });
});

async function flush() {
    await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
    });
}

function mountTab(balance: number) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    // SGCoinPayoutTab's discount-action card uses <Link to="/shop"> from
    // react-router-dom, which requires a Router context. MemoryRouter satisfies
    // that requirement in jsdom without a real browser history.
    act(() => {
        root.render(
            <MemoryRouter>
                <SGCoinPayoutTab userId="user-123" balance={balance} />
            </MemoryRouter>,
        );
    });
    return { container, root };
}

function unmountTab(root: ReturnType<typeof createRoot>) {
    act(() => {
        root.unmount();
    });
}

function getAddToastMock() {
    return vi.mocked(useToast).mock.results[0]?.value?.addToast as ReturnType<
        typeof vi.fn
    >;
}

// ---------- TESTS ----------

describe('SGCoinPayoutTab', () => {
    it('RENDER_HERO: balance=12450 displays formatted number, USD estimate, both action cards', async () => {
        const { container, root } = mountTab(12450);
        await flush();

        // Hero number formatted with thousands separator.
        expect(container.textContent).toContain('12,450');
        // USD estimate at the canonical 0.002 rate: 12450 * 0.002 = 24.90.
        expect(container.textContent).toContain('$24.90');
        // Both action card headings present.
        expect(container.textContent).toContain('Use for Clothing Discount');
        expect(container.textContent).toContain('Request Crypto Payout');
        // Info notice from the original spec is rendered.
        expect(container.textContent).toContain(
            'automatically stored in your SGCoalition account',
        );
        // The minimum floor constant is rendered WITH comma (via .toLocaleString())
        // because all UI surfaces use it. The raw number "5000" never appears in the DOM.
        expect(container.textContent).toContain(MIN_PAYOUT_SGC.toLocaleString());

        unmountTab(root);
    });

    it('INSUFFICIENT_BALANCE: balance=1000 disables crypto-payout submit button + surfaces min-floor message', async () => {
        const { container, root } = mountTab(1000);
        await flush();

        const allButtons = Array.from(
            container.querySelectorAll('button'),
        ) as HTMLButtonElement[];
        const payoutButton = allButtons.find((b) =>
            b.textContent ? b.textContent.indexOf('Request Crypto Payout') !== -1 : false,
        );
        expect(payoutButton).toBeTruthy();
        expect(payoutButton ? payoutButton.disabled : true).toBe(true);
        expect(payoutButton ? payoutButton.title : '').toContain('Minimum payout is 5,000');
        expect(container.textContent).toContain('Minimum payout is 5,000 SGCoin');

        unmountTab(root);
    });

    it('HISTORY_RENDER: 3 mixed-status rows render with correct status badges + tx_hash link', async () => {
        vi.mocked(getUserPayoutRequests).mockResolvedValueOnce(FAKE_REQUESTS as any);

        const { container, root } = mountTab(20000);
        await flush();

        expect(container.textContent).toContain('5,000');
        expect(container.textContent).toContain('3,000');
        expect(container.textContent).toContain('1,000');

        expect(container.textContent).toContain('Pending review');
        expect(container.textContent).toContain('Completed');
        expect(container.textContent).toContain('Rejected');

        const polygonscanLinks = Array.from(
            container.querySelectorAll('a[href*="polygonscan.com"]'),
        ) as HTMLAnchorElement[];
        expect(polygonscanLinks.length).toBeGreaterThan(0);
        expect(
            polygonscanLinks.some((a) =>
                a.href.indexOf('0xabcabcabcabcabcabcabcabcabcabcabcabcabc') !== -1,
            ),
        ).toBe(true);

        expect(container.textContent).toContain(
            'Address failed on-chain verification',
        );

        unmountTab(root);
    });

    it('OPEN_MODAL_AND_SUBMIT: full happy path submits via mocked submitPayoutRequest with email/walletAddress/amount', async () => {
        const { container, root } = mountTab(12450);
        await flush();

        const allButtons = Array.from(
            container.querySelectorAll('button'),
        ) as HTMLButtonElement[];
        const payoutButton = allButtons.find((b) =>
            b.textContent ? b.textContent.indexOf('Request Crypto Payout') !== -1 : false,
        );
        expect(payoutButton).toBeTruthy();
        expect(payoutButton ? payoutButton.disabled : true).toBe(false);
        await act(async () => {
            if (payoutButton) payoutButton.click();
        });
        await flush();

        expect(container.textContent).toContain('Request SGCOIN Payout');

        const disclaimerCheckbox = container.querySelector(
            'input[type="checkbox"]',
        ) as HTMLInputElement;
        expect(disclaimerCheckbox).toBeTruthy();
        expect(disclaimerCheckbox.checked).toBe(false);

        const addressInput = container.querySelector(
            'input[aria-label="Polygon wallet address"]',
        ) as HTMLInputElement;
        expect(addressInput).toBeTruthy();
        expect(addressInput.value).toBe(
            '0x1111111111111111111111111111111111111111',
        );

        const amountInput = container.querySelector(
            'input[aria-label="Payout amount in SGCoin"]',
        ) as HTMLInputElement;
        expect(amountInput).toBeTruthy();
        await act(async () => {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value',
            ).set;
            if (nativeSetter) {
                nativeSetter.call(amountInput, '6000');
                amountInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        expect(amountInput.value).toBe('6000');

        await act(async () => {
            disclaimerCheckbox.click();
        });
        expect(disclaimerCheckbox.checked).toBe(true);

        const submitButton = Array.from(
            container.querySelectorAll('button'),
        ).find(
            (b) => (b.textContent ? b.textContent.trim() : '') === 'Submit Payout Request',
        ) as HTMLButtonElement;
        expect(submitButton).toBeTruthy();
        expect(submitButton.disabled).toBe(false);

        vi.mocked(submitPayoutRequest).mockResolvedValueOnce({
            id: 'req-new-1',
            userId: 'user-123',
            email: 'caller@sgcoalition.test',
            walletAddress: '0x1111111111111111111111111111111111111111',
            amount: 6000,
            status: 'pending',
            createdAt: '2026-07-16T09:00:00Z',
            updatedAt: '2026-07-16T09:00:00Z',
        });

        await act(async () => {
            submitButton.click();
        });
        await flush();

        expect(vi.mocked(submitPayoutRequest)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(submitPayoutRequest)).toHaveBeenCalledWith({
            email: 'caller@sgcoalition.test',
            walletAddress: '0x1111111111111111111111111111111111111111',
            amount: 6000,
        });

        // Behavioral assert: the success side-effect (addToast with 'success' +
        // a 'Payout request submitted' message) is the actual proof that handleSubmit
        // completed + called setIsModalOpen(false). We deliberately do NOT assert
        // container.textContent absence of 'Submit Payout Request' because framer-motion's
        // AnimatePresence keeps the modal motion.div in the DOM during the exit
        // animation in jsdom even after isModalOpen=false.
        const addToastMock2 = getAddToastMock();
        expect(addToastMock2).toHaveBeenCalledWith(
            expect.stringContaining('Payout request submitted'),
            'success',
        );

        unmountTab(root);
    });

    it('ERROR_TOAST: surfaces RPC error message verbatim via addToast when submitPayoutRequest rejects', async () => {
        const { container, root } = mountTab(12450);
        await flush();

        // Open the modal & fill valid form.
        const payoutButton = (Array.from(
            container.querySelectorAll('button'),
        ) as HTMLButtonElement[]).find((b) =>
            b.textContent ? b.textContent.indexOf('Request Crypto Payout') !== -1 : false,
        );
        await act(async () => {
            if (payoutButton) payoutButton.click();
        });
        await flush();

        const amountInput = container.querySelector(
            'input[aria-label="Payout amount in SGCoin"]',
        ) as HTMLInputElement;
        await act(async () => {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value',
            ).set;
            if (nativeSetter) {
                nativeSetter.call(amountInput, '6000');
                amountInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });

        const disclaimerCheckbox = container.querySelector(
            'input[type="checkbox"]',
        ) as HTMLInputElement;
        await act(async () => {
            disclaimerCheckbox.click();
        });

        // Mock the duplicate-pending error message (this is the most-likely
        // customer-facing rejection on production day 1).
        const duplicatePendingMsg =
            'Only one pending payout request allowed per user.';
        vi.mocked(submitPayoutRequest).mockRejectedValueOnce(
            new Error(duplicatePendingMsg),
        );

        const submitButton = Array.from(
            container.querySelectorAll('button'),
        ).find(
            (b) => (b.textContent ? b.textContent.trim() : '') === 'Submit Payout Request',
        ) as HTMLButtonElement;
        await act(async () => {
            submitButton.click();
        });
        await flush();

        // addToast was called with the error message verbatim, type='error'.
        const addToastMock = getAddToastMock();
        expect(addToastMock).toHaveBeenCalledWith(
            duplicatePendingMsg,
            'error',
            5000,
        );

        // Modal stays open so the customer can correct the input.
        expect(container.textContent).toContain('Submit Payout Request');

        unmountTab(root);
    });
});
