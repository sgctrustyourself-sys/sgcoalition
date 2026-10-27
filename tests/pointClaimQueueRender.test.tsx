// tests/pointClaimQueueRender.test.tsx
//
// Tests for components/admin/PointClaimQueue — the review panel in
// Admin → SGCoin Distribution.
//
// The panel sits in front of a money-moving RPC, so the things worth pinning
// are the ones that stop a wrong press:
//
//   1. Approving asks first, and names the amount and the member in the
//      question. The amount is not restated by the UI unless the operator
//      overrides it, so the confirm box is where the number becomes visible.
//   2. Declining the confirm box approves nothing — no request leaves the page.
//   3. An unmatched claim with no receipt is shown as having nothing to verify
//      against, rather than looking like a normal review.
//   4. The three addresses on a claim are all on the row: the account, the one
//      the buyer typed, and the member the points will land on. That comparison
//      is the whole review.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';

import {
    appContextStub,
    mockAppContext,
    renderAdminSurface,
    toastContextStub,
} from './_helpers/adminSurface';

vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

const fetchPointClaims = vi.fn();
const approvePointClaim = vi.fn();
const rejectPointClaim = vi.fn();

vi.doMock('../services/adminPointClaims', () => ({
    fetchPointClaims: (...args: unknown[]) => fetchPointClaims(...args),
    approvePointClaim: (...args: unknown[]) => approvePointClaim(...args),
    rejectPointClaim: (...args: unknown[]) => rejectPointClaim(...args),
}));

const loadQueue = () => import('../components/admin/PointClaimQueue');

const PENDING = {
    id: 'claim-1',
    userId: 'u-1',
    memberName: 'Ada L',
    memberEmail: 'new-member@example.com',
    claimantEmail: 'new-member@example.com',
    orderId: 'order-1',
    orderNumber: 'ORD-1234',
    orderEmail: 'guest@example.com',
    matched: true,
    points: 84,
    proofUrl: 'https://cdn.example.com/claims/receipt.png',
    note: 'Ordered as a guest',
    status: 'pending' as const,
    grantedAmount: null,
    reviewNote: null,
    reviewedAt: null,
    createdAt: '2026-07-01T10:00:00Z',
};

const buttonByText = (container: HTMLElement, text: string) =>
    [...container.querySelectorAll('button')].find((button) =>
        (button.textContent ?? '').includes(text),
    ) as HTMLButtonElement | undefined;

describe('PointClaimQueue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAppContext();
        fetchPointClaims.mockResolvedValue([PENDING]);
        approvePointClaim.mockResolvedValue({ granted: 84, balanceAfter: 210 });
        rejectPointClaim.mockResolvedValue(undefined);
    });

    const mount = async () =>
        renderAdminSurface(loadQueue, { initialEntries: ['/admin?tab=sgcoin-distribution'] });

    it('shows the account, the typed order email, the member and the receipt together', async () => {
        const { container } = await mount();

        const text = container.textContent ?? '';
        expect(text).toContain('ORD-1234');
        expect(text).toContain('new-member@example.com');
        expect(text).toContain('guest@example.com');
        expect(text).toContain('Ada L');
        expect(text).toContain('84');
        expect(container.querySelector('a[href="https://cdn.example.com/claims/receipt.png"]')).not.toBeNull();
    });

    it('asks before crediting, naming the amount and the member', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        try {
            const { container } = await mount();
            await act(async () => { buttonByText(container, 'Approve')!.click(); });

            expect(confirmSpy).toHaveBeenCalledTimes(1);
            const question = String(confirmSpy.mock.calls[0][0]);
            expect(question).toContain('84');
            expect(question).toContain('Ada L');
            expect(question).toContain('ORD-1234');
            // Amount and note untouched: the RPC pays what the order says.
            expect(approvePointClaim).toHaveBeenCalledWith('claim-1', null, undefined);
        } finally {
            confirmSpy.mockRestore();
        }
    });

    it('approves nothing when the operator backs out of the confirm box', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        try {
            const { container } = await mount();
            await act(async () => { buttonByText(container, 'Approve')!.click(); });

            expect(approvePointClaim).not.toHaveBeenCalled();
        } finally {
            confirmSpy.mockRestore();
        }
    });

    it('refuses a fractional override before the confirm box even opens', async () => {
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
        try {
            const { container } = await mount();
            const amount = container.querySelector('#claim-amount-claim-1') as HTMLInputElement;
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            await act(async () => {
                setter?.call(amount, '12.5');
                amount.dispatchEvent(new Event('input', { bubbles: true }));
            });
            await act(async () => { buttonByText(container, 'Approve')!.click(); });

            expect(approvePointClaim).not.toHaveBeenCalled();
            expect(confirmSpy).not.toHaveBeenCalled();
        } finally {
            confirmSpy.mockRestore();
        }
    });

    it('rejects with the reason the operator typed into the prompt', async () => {
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Order was refunded');
        try {
            const { container } = await mount();
            await act(async () => { buttonByText(container, 'Reject')!.click(); });

            expect(rejectPointClaim).toHaveBeenCalledWith('claim-1', 'Order was refunded');
        } finally {
            promptSpy.mockRestore();
        }
    });

    it('calls out an unmatched claim that arrived without a receipt', async () => {
        fetchPointClaims.mockResolvedValue([
            { ...PENDING, matched: false, points: 0, proofUrl: null },
        ]);

        const { container } = await mount();

        expect(container.textContent).toContain('Needs review');
        expect(container.textContent).toContain('No receipt attached');
    });

    it('says so when the queue is empty instead of rendering an empty list', async () => {
        fetchPointClaims.mockResolvedValue([]);

        const { container } = await mount();

        expect(container.textContent).toContain('No pending claims');
    });
});
