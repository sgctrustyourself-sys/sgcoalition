// tests/sgCoinPayoutManagerRender.test.tsx
//
// REGRESSION CATCH for the React render-flow of
// components/admin/SGCoinPayoutManager.tsx (admin tab for SGCOIN withdrawal
// requests: approve / complete-with-tx-hash / reject).
//
// Pattern mirrors tests/orderManagerRender.test.tsx:
//   createRoot + act + explicit-DOM-assertions + vi.mock per service.
//
// The component imports services/payoutRequest (RPC wrappers, not raw supabase
// calls) so we mock that module entirely instead of using the supabase mock
// helper. EmailService mocks use vi.fn().mockResolvedValue(undefined) so the
// real email send paths never fire during tests.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// ---------- HOISTED MOCKS ----------

vi.mock('../services/payoutRequest', () => ({
    getAllPayoutRequests: vi.fn(),
    approvePayoutRequest: vi.fn(),
    completePayoutRequest: vi.fn(),
    rejectPayoutRequest: vi.fn(),
    getPayoutRequestStats: vi.fn(),
    MIN_PAYOUT_SGC: 5000,
}));

vi.mock('../services/emailService', () => ({
    sendPayoutApprovedEmail: vi.fn().mockResolvedValue(undefined),
    sendPayoutCompletedEmail: vi.fn().mockResolvedValue(undefined),
    sendPayoutRejectedEmail: vi.fn().mockResolvedValue(undefined),
    sendApprovalEmail: vi.fn().mockResolvedValue(undefined),
    sendRejectionEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../context/ToastContext', () => ({
    useToast: vi.fn(),
}));

import {
    getAllPayoutRequests,
    approvePayoutRequest,
    completePayoutRequest,
    rejectPayoutRequest,
    getPayoutRequestStats,
} from '../services/payoutRequest';
import { useToast } from '../context/ToastContext';
import SGCoinPayoutManager from '../components/admin/SGCoinPayoutManager';

// ---------- FIXTURES ----------

const REQ_PENDING_5000 = {
    id: 'req-pending-5000',
    userId: 'user-alice',
    email: 'alice@sgcoalition.test',
    walletAddress: '0x1111111111111111111111111111111111111111',
    amount: 5000,
    status: 'pending',
    createdAt: '2026-07-14T08:00:00Z',
    updatedAt: '2026-07-14T08:00:00Z',
};

const REQ_APPROVED_3000 = {
    id: 'req-approved-3000',
    userId: 'user-bob',
    email: 'bob@sgcoalition.test',
    walletAddress: '0x2222222222222222222222222222222222222222',
    amount: 3000,
    status: 'approved',
    createdAt: '2026-07-15T09:00:00Z',
    updatedAt: '2026-07-16T10:00:00Z',
};

const REQ_COMPLETED_2000 = {
    id: 'req-completed-2000',
    userId: 'user-cara',
    email: 'cara@sgcoalition.test',
    walletAddress: '0x3333333333333333333333333333333333333333',
    amount: 2000,
    status: 'completed',
    txHash: '0xabcabcabcabcabcabcabcabcabcabcabcabcabc',
    createdAt: '2026-07-10T08:00:00Z',
    updatedAt: '2026-07-12T08:00:00Z',
    processedAt: '2026-07-12T08:00:00Z',
};

const FIXTURE_REQUESTS = [REQ_PENDING_5000, REQ_APPROVED_3000, REQ_COMPLETED_2000];

const FIXTURE_STATS = {
    totalRequests: 3,
    pendingRequests: 1,
    approvedRequests: 1,
    completedRequests: 1,
    rejectedRequests: 0,
    totalAmountRequested: 10000,
    totalAmountCompleted: 2000,
};

// ---------- HELPERS ----------

async function flush() {
    await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
    });
}

function setupDefaultMocks() {
    vi.mocked(getAllPayoutRequests).mockResolvedValue(FIXTURE_REQUESTS);
    vi.mocked(getPayoutRequestStats).mockResolvedValue(FIXTURE_STATS);
    vi.mocked(approvePayoutRequest).mockResolvedValue(true);
    vi.mocked(completePayoutRequest).mockResolvedValue(true);
    vi.mocked(rejectPayoutRequest).mockResolvedValue(true);
}

function getAddToastMock() {
    return vi.mocked(useToast).mock.results[0]?.value?.addToast as ReturnType<
        typeof vi.fn
    >;
}

// ---------- 1. LOADED + 2. STATUS FILTER ----------

describe('SGCoinPayoutManager render flow', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        vi.mocked(useToast).mockReturnValue({
            addToast: vi.fn(),
            removeToast: vi.fn(),
            toasts: [],
        });

        setupDefaultMocks();

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('LOADED: 5 stat cards (3/1/1/1/0) + 3 table rows + color badges + no detail modal', async () => {
        await act(async () => {
            root.render(
                createElement(SGCoinPayoutManager, { adminUserId: 'admin-123' }),
            );
        });
        await flush();

        // 5 stat cards: Total / Pending / Approved / Completed / Rejected.
        const statValues = Array.from(
            container.querySelectorAll('div.text-2xl.font-bold'),
        ).map((d) => (d.textContent || '').trim());
        expect(statValues[0]).toBe('3');
        expect(statValues[1]).toBe('1');
        expect(statValues[2]).toBe('1');
        expect(statValues[3]).toBe('1');
        expect(statValues[4]).toBe('0');

        const html = container.innerHTML;
        expect(html).toContain('alice@sgcoalition.test');
        expect(html).toContain('bob@sgcoalition.test');
        expect(html).toContain('cara@sgcoalition.test');

        expect(html).toContain('5,000');
        expect(html).toContain('3,000');
        expect(html).toContain('2,000');

        expect(html).toMatch(/bg-yellow-500[^\"]*\"[^>]*>\s*pending/);
        expect(html).toMatch(/bg-blue-500[^\"]*\"[^>]*>\s*approved/);
        expect(html).toMatch(/bg-green-500[^\"]*\"[^>]*>\s*completed/);

        expect(html).not.toContain('Payout Request Details');
        expect(html).not.toContain('Mark Payout Completed');
        expect(html).not.toContain('Reject Payout Request');
        expect(html).not.toContain('Approve + Queue Transfer');
    });

    it('STATUS_FILTER: clicking "Pending" narrows to 1 row (alice only); stat grid unchanged', async () => {
        await act(async () => {
            root.render(
                createElement(SGCoinPayoutManager, { adminUserId: 'admin-123' }),
            );
        });
        await flush();

        expect(container.innerHTML).toContain('alice@sgcoalition.test');
        expect(container.innerHTML).toContain('bob@sgcoalition.test');
        expect(container.innerHTML).toContain('cara@sgcoalition.test');

        const pendingChip = Array.from(
            container.querySelectorAll('button'),
        ).find(
            (b) => (b.textContent || '').trim().toLowerCase() === 'pending',
        ) as HTMLButtonElement | null;
        expect(pendingChip).toBeTruthy();
        await act(async () => {
            pendingChip!.click();
        });
        await flush();

        const html = container.innerHTML;
        expect(html).toContain('alice@sgcoalition.test');
        expect(html).not.toContain('bob@sgcoalition.test');
        expect(html).not.toContain('cara@sgcoalition.test');

        const statValues = Array.from(
            container.querySelectorAll('div.text-2xl.font-bold'),
        ).map((d) => (d.textContent || '').trim());
        expect(statValues[0]).toBe('3');
        expect(statValues[1]).toBe('1');
    });
});

// ---------- 3. APPROVE + 4. COMPLETE + 5. REJECT MODAL FLOWS ----------

describe('SGCoinPayoutManager admin action flows', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(async () => {
        vi.clearAllMocks();
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => {});

        vi.mocked(useToast).mockReturnValue({
            addToast: vi.fn(),
            removeToast: vi.fn(),
            toasts: [],
        });

        setupDefaultMocks();

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        await act(async () => {
            root.render(
                createElement(SGCoinPayoutManager, { adminUserId: 'admin-123' }),
            );
        });
        await flush();
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.restoreAllMocks();
    });

    it('APPROVE_CONFIRM_FLOW: View pending -> Approve -> ConfirmationModal -> Confirm fires RPC + toast + closes modals', async () => {
        const beforeHtml = container.innerHTML;
        expect(beforeHtml).not.toContain('Payout Request Details');

        const viewBtns = Array.from(
            container.querySelectorAll('button'),
        ).filter(
            (b) => (b.textContent || '').trim().includes('View'),
        ) as HTMLButtonElement[];
        expect(viewBtns.length).toBe(3);

        await act(async () => {
            viewBtns[0].click();
        });
        await flush();

        let html = container.innerHTML;
        expect(html).toContain('Payout Request Details');
        expect(html).toContain('alice@sgcoalition.test');
        expect(html).toContain('5,000 SGCOIN');
        expect(html).toContain('Approve');

        const approveBtn = Array.from(
            container.querySelectorAll('button'),
        ).find(
            (b) => (b.textContent || '').trim() === 'Approve',
        ) as HTMLButtonElement;
        expect(approveBtn).toBeTruthy();
        await act(async () => {
            approveBtn.click();
        });
        await flush();

        html = container.innerHTML;
        expect(html).toContain('Approve + Queue Transfer');
        expect(html).toContain('Approve 5,000 SGCOIN payout?');

        const confirmBtn = Array.from(
            container.querySelectorAll('button'),
        ).find(
            (b) => (b.textContent || '').trim() === 'Approve + Queue Transfer',
        ) as HTMLButtonElement;
        expect(confirmBtn).toBeTruthy();
        await act(async () => {
            confirmBtn.click();
        });
        await flush();

        expect(vi.mocked(approvePayoutRequest)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(approvePayoutRequest)).toHaveBeenCalledWith(
            'req-pending-5000',
            'admin-123',
        );

        const addToastMock = getAddToastMock();
        expect(addToastMock).toHaveBeenCalledWith(
            'Payout approved + customer notified',
            'success',
        );

        html = container.innerHTML;
        expect(html).not.toContain('Payout Request Details');
        expect(html).not.toContain('Approve + Queue Transfer');
    });

    it('COMPLETE_TX_HASH_FLOW: View approved -> Mark Completed -> type tx -> Confirm fires 4-arg RPC + toast', async () => {
        const viewBtns = Array.from(
            container.querySelectorAll('button'),
        ).filter(
            (b) => (b.textContent || '').trim().includes('View'),
        ) as HTMLButtonElement[];
        expect(viewBtns.length).toBe(3);

        await act(async () => {
            viewBtns[1].click();
        });
        await flush();

        let html = container.innerHTML;
        expect(html).toContain('Payout Request Details');
        expect(html).toContain('bob@sgcoalition.test');
        expect(html).toContain('Mark Completed');

        const markCompleteBtn = Array.from(
            container.querySelectorAll('button'),
        ).find(
            (b) => (b.textContent || '').trim() === 'Mark Completed',
        ) as HTMLButtonElement;
        expect(markCompleteBtn).toBeTruthy();
        await act(async () => {
            markCompleteBtn.click();
        });
        await flush();

        html = container.innerHTML;
        expect(html).toContain('Mark Payout Completed');

        const txInput = container.querySelector(
            'input[placeholder="0x..."]',
        ) as HTMLInputElement | null;
        expect(txInput).toBeTruthy();

        const txHashValue =
            '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';
        await act(async () => {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                'value',
            ).set;
            if (nativeSetter) {
                nativeSetter.call(txInput!, txHashValue);
                txInput!.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        expect(txInput!.value).toBe(txHashValue);

        const confirmCompleteBtn = Array.from(
            container.querySelectorAll('button'),
        ).find(
            (b) =>
                (b.textContent || '').trim() === 'Confirm + Notify Customer',
        ) as HTMLButtonElement;
        expect(confirmCompleteBtn).toBeTruthy();
        expect(confirmCompleteBtn.disabled).toBe(false);

        await act(async () => {
            confirmCompleteBtn.click();
        });
        await flush();

        expect(vi.mocked(completePayoutRequest)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(completePayoutRequest)).toHaveBeenCalledWith(
            'req-approved-3000',
            'admin-123',
            txHashValue,
            undefined,
        );

        const addToastMock = getAddToastMock();
        expect(addToastMock).toHaveBeenCalledWith(
            'Payout completed + customer notified',
            'success',
        );

        html = container.innerHTML;
        expect(html).not.toContain('Payout Request Details');
    });

    it('REJECT_WITH_REASON: View pending -> Reject -> type reason -> Confirm Rejection fires RPC + toast + closes modals', async () => {
        const viewBtns = Array.from(
            container.querySelectorAll('button'),
        ).filter(
            (b) => (b.textContent || '').trim().includes('View'),
        ) as HTMLButtonElement[];
        expect(viewBtns.length).toBe(3);

        await act(async () => {
            viewBtns[0].click();
        });
        await flush();

        let html = container.innerHTML;
        expect(html).toContain('Payout Request Details');
        expect(html).toContain('alice@sgcoalition.test');

        const rejectBtn = Array.from(
            container.querySelectorAll('button'),
        ).find(
            (b) => (b.textContent || '').trim() === 'Reject',
        ) as HTMLButtonElement;
        expect(rejectBtn).toBeTruthy();
        await act(async () => {
            rejectBtn.click();
        });
        await flush();

        html = container.innerHTML;
        expect(html).toContain('Reject Payout Request');

        const reason = 'Polygon wallet failed on-chain verification';
        const textarea = container.querySelector(
            'textarea',
        ) as HTMLTextAreaElement | null;
        expect(textarea).toBeTruthy();
        await act(async () => {
            const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                'value',
            ).set;
            if (nativeSetter) {
                nativeSetter.call(textarea!, reason);
                textarea!.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        expect(textarea!.value).toBe(reason);

        const confirmRejectBtn = Array.from(
            container.querySelectorAll('button'),
        ).find(
            (b) => (b.textContent || '').trim() === 'Confirm Rejection',
        ) as HTMLButtonElement;
        expect(confirmRejectBtn).toBeTruthy();
        expect(confirmRejectBtn.disabled).toBe(false);

        await act(async () => {
            confirmRejectBtn.click();
        });
        await flush();

        expect(vi.mocked(rejectPayoutRequest)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(rejectPayoutRequest)).toHaveBeenCalledWith(
            'req-pending-5000',
            'admin-123',
            reason,
        );

        const addToastMock = getAddToastMock();
        expect(addToastMock).toHaveBeenCalledWith(
            'Payout rejected',
            'success',
        );

        html = container.innerHTML;
        expect(html).not.toContain('Reject Payout Request');
        expect(html).not.toContain('Payout Request Details');
    });
});
