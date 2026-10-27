// tests/claimPage.test.tsx
//
// Tests for pages/Claim — the buyer-facing point claim flow.
//
// What is worth pinning, and why each one is a real failure mode:
//
//   1. Signed out, the page signs the buyer up IN PLACE. The people this page
//      exists for are guests; sending them to /login with their order number
//      still in an email tab is how a claim gets abandoned.
//   2. The claim form prefills the order email from the account email — the
//      field that decides whether the order matches, so a wrong default is
//      invisible until the claim fails to match.
//   3. A matched order asks for NOTHING but the button, and states the amount
//      before the buyer commits. The screenshot is for the unmatched case only.
//   4. An unmatched order cannot be submitted without the receipt: the RPC
//      refuses it too, and this is the client-side half of that rule.
//   5. The submitted card says an operator still has to approve it. Promising
//      credited points would be a lie — nothing moves until approval.
//
// The page reads AppContext (the signed-in user) and ToastContext, so the shared
// harness in tests/_helpers/adminSurface.tsx supplies both stubs. It is named for
// the admin surfaces it was built for; the two contexts are the same ones, and
// reusing it keeps a second copy of the same two vi.fn() shapes out of the repo.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';

import {
    addToast,
    appContextStub,
    mockAppContext,
    renderAdminSurface as renderSurface,
    toastContextStub,
} from './_helpers/adminSurface';

vi.doMock('../context/AppContext', appContextStub);
vi.doMock('../context/ToastContext', toastContextStub);

const lookupOrderPoints = vi.fn();
const submitPointClaim = vi.fn();
const getMyPointClaims = vi.fn();
const uploadClaimProof = vi.fn();
const validatePaymentProofFile = vi.fn();
const signInWithEmail = vi.fn();
const signUpWithEmail = vi.fn();

vi.doMock('../services/pointClaim', () => ({
    MAX_CLAIM_NOTE_LENGTH: 1000,
    lookupOrderPoints: (...args: unknown[]) => lookupOrderPoints(...args),
    submitPointClaim: (...args: unknown[]) => submitPointClaim(...args),
    getMyPointClaims: (...args: unknown[]) => getMyPointClaims(...args),
}));

vi.doMock('../services/paymentProofUpload', () => ({
    uploadClaimProof: (...args: unknown[]) => uploadClaimProof(...args),
    validatePaymentProofFile: (...args: unknown[]) => validatePaymentProofFile(...args),
}));

vi.doMock('../services/auth', () => ({
    signInWithEmail: (...args: unknown[]) => signInWithEmail(...args),
    signUpWithEmail: (...args: unknown[]) => signUpWithEmail(...args),
}));

const loadClaim = () => import('../pages/Claim');

const MATCHED = {
    matched: true,
    points: 84,
    orderTotal: 84,
    orderDate: '2026-07-04T12:00:00Z',
    alreadyClaimed: false,
};

const UNMATCHED = { matched: false, points: 0, orderTotal: null, orderDate: null, alreadyClaimed: false };

const buttonByText = (container: HTMLElement, text: string) =>
    [...container.querySelectorAll('button')].find((button) =>
        (button.textContent ?? '').includes(text),
    ) as HTMLButtonElement | undefined;

/** React tracks the last value it rendered, so a raw assignment is swallowed. */
const type = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(prototype.prototype, 'value')?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
};

const attachFile = (input: HTMLInputElement, file: File) => {
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('pages/Claim', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getMyPointClaims.mockResolvedValue([]);
        lookupOrderPoints.mockResolvedValue(MATCHED);
        submitPointClaim.mockResolvedValue({ claimId: 'claim-1', status: 'pending', points: 84, matched: true });
        uploadClaimProof.mockResolvedValue('https://cdn.example.com/claims/receipt.png');
        validatePaymentProofFile.mockReturnValue({ valid: true });
        signInWithEmail.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
        signUpWithEmail.mockResolvedValue({ data: { user: { id: 'u1' }, session: { access_token: 't' } }, error: null });
    });

    it('signed out, offers sign-in and account creation in place instead of the claim form', async () => {
        mockAppContext({ user: null });

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });

        expect(container.textContent).toContain('Sign in to claim');
        expect(container.textContent).not.toContain('Find your order');

        // The toggle keeps a guest who has no account on this page.
        const toggle = buttonByText(container, 'No account yet?');
        expect(toggle).toBeDefined();
        await act(async () => { toggle!.click(); });
        expect(container.textContent).toContain('Create your account');
    });

    it('signs a buyer in without leaving the page', async () => {
        mockAppContext({ user: null });

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });
        const email = container.querySelector('#claim-account-email') as HTMLInputElement;
        const password = container.querySelector('#claim-password') as HTMLInputElement;

        await act(async () => {
            type(email, 'guest@example.com');
            type(password, 'hunter2hunter2');
        });
        await act(async () => {
            buttonByText(container, 'Sign in')!.click();
        });

        expect(signInWithEmail).toHaveBeenCalledWith('guest@example.com', 'hunter2hunter2');
    });

    it('tells a new signup to confirm the email rather than claiming they are signed in', async () => {
        mockAppContext({ user: null });
        // No session back: confirmation is on for this project, so there is an
        // account but no way to submit a claim yet.
        signUpWithEmail.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null });

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });
        await act(async () => { buttonByText(container, 'No account yet?')!.click(); });

        await act(async () => {
            type(container.querySelector('#claim-account-email') as HTMLInputElement, 'guest@example.com');
            type(container.querySelector('#claim-password') as HTMLInputElement, 'hunter2hunter2');
        });
        await act(async () => { buttonByText(container, 'Create account')!.click(); });

        expect(container.textContent).toContain('Confirm your email');
        expect(container.textContent).not.toContain('Find your order');
    });

    it('signed in, prefills the order email with the account email', async () => {
        mockAppContext({ user: { uid: 'u1', email: 'buyer@example.com' } });

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });

        expect(container.textContent).toContain('Find your order');
        const orderEmail = container.querySelector('#claim-order-email') as HTMLInputElement;
        expect(orderEmail.value).toBe('buyer@example.com');
    });

    it('states the amount for a matched order and asks for nothing but the button', async () => {
        mockAppContext({ user: { uid: 'u1', email: 'buyer@example.com' } });

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });
        await act(async () => {
            type(container.querySelector('#claim-order-number') as HTMLInputElement, 'ORD-1234');
        });
        await act(async () => { buttonByText(container, 'Check this order')!.click(); });

        expect(lookupOrderPoints).toHaveBeenCalledWith('ORD-1234', 'buyer@example.com');
        expect(container.textContent).toContain('Order found');
        expect(container.textContent).toContain('84');
        // Matched: no screenshot asked for, because the order record IS the proof.
        expect(container.querySelector('#claim-proof')).toBeNull();
        expect(buttonByText(container, 'Claim 84 SGCoin')).toBeDefined();
    });

    it('requires a receipt when the order cannot be matched, and refuses to submit without one', async () => {
        mockAppContext({ user: { uid: 'u1', email: 'buyer@example.com' } });
        lookupOrderPoints.mockResolvedValue(UNMATCHED);

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });
        await act(async () => {
            type(container.querySelector('#claim-order-number') as HTMLInputElement, 'ORD-9999');
        });
        await act(async () => { buttonByText(container, 'Check this order')!.click(); });

        expect(container.textContent).toContain('We could not match that order');
        const submit = buttonByText(container, 'Submit for review')!;
        expect(submit.disabled).toBe(true);

        // Attaching the receipt is what makes it submittable.
        await act(async () => {
            attachFile(container.querySelector('#claim-proof') as HTMLInputElement, new File(['x'], 'receipt.png', { type: 'image/png' }));
        });
        expect(buttonByText(container, 'Submit for review')!.disabled).toBe(false);
    });

    it('submits a matched claim with no proof and reports that a review still stands between it and the points', async () => {
        mockAppContext({ user: { uid: 'u1', email: 'buyer@example.com' } });

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });
        await act(async () => {
            type(container.querySelector('#claim-order-number') as HTMLInputElement, 'ORD-1234');
        });
        await act(async () => { buttonByText(container, 'Check this order')!.click(); });
        await act(async () => { buttonByText(container, 'Claim 84 SGCoin')!.click(); });

        expect(uploadClaimProof).not.toHaveBeenCalled();
        expect(submitPointClaim).toHaveBeenCalledWith({
            orderNumber: 'ORD-1234',
            email: 'buyer@example.com',
            proofUrl: null,
            note: '',
        });
        expect(container.textContent).toContain('Claim submitted');
        expect(container.textContent).toContain('queued for an operator');
        expect(addToast).toHaveBeenCalledWith('Claim submitted — an operator reviews it by hand.', 'success');
    });

    it('uploads the receipt before submitting an unmatched claim', async () => {
        mockAppContext({ user: { uid: 'u1', email: 'buyer@example.com' } });
        lookupOrderPoints.mockResolvedValue(UNMATCHED);
        // The RPC's own verdict, which is what the page reports: unmatched, so
        // the confirmation must not read like a matched approval.
        submitPointClaim.mockResolvedValue({ claimId: 'claim-2', status: 'pending', points: 0, matched: false });

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });
        await act(async () => {
            type(container.querySelector('#claim-order-number') as HTMLInputElement, 'ORD-9999');
        });
        await act(async () => { buttonByText(container, 'Check this order')!.click(); });
        await act(async () => {
            attachFile(container.querySelector('#claim-proof') as HTMLInputElement, new File(['x'], 'receipt.png', { type: 'image/png' }));
        });
        await act(async () => { buttonByText(container, 'Submit for review')!.click(); });

        expect(uploadClaimProof).toHaveBeenCalledTimes(1);
        expect(submitPointClaim).toHaveBeenCalledWith(
            expect.objectContaining({ proofUrl: 'https://cdn.example.com/claims/receipt.png' }),
        );
        expect(container.textContent).toContain('receipt is with us');
    });

    it('shows an already-claimed order as done, with no button to press twice', async () => {
        mockAppContext({ user: { uid: 'u1', email: 'buyer@example.com' } });
        lookupOrderPoints.mockResolvedValue({ ...MATCHED, alreadyClaimed: true });

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });
        await act(async () => {
            type(container.querySelector('#claim-order-number') as HTMLInputElement, 'ORD-1234');
        });
        await act(async () => { buttonByText(container, 'Check this order')!.click(); });

        expect(container.textContent).toContain('already has a claim');
        expect(buttonByText(container, 'Claim 84 SGCoin')).toBeUndefined();
    });

    it('reports its own past claims with the credited amount once approved', async () => {
        mockAppContext({ user: { uid: 'u1', email: 'buyer@example.com' } });
        getMyPointClaims.mockResolvedValue([
            {
                id: 'claim-1',
                orderNumber: 'ORD-1234',
                matched: true,
                points: 84,
                status: 'approved',
                grantedAmount: 84,
                reviewNote: null,
                createdAt: '2026-07-05T10:00:00Z',
                reviewedAt: '2026-07-06T10:00:00Z',
            },
        ]);

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });

        expect(container.textContent).toContain('Your claims');
        expect(container.textContent).toContain('+84');
        expect(container.textContent).toContain('Credited');
    });

    it('surfaces a failed lookup instead of leaving the buyer on an unchanged screen', async () => {
        mockAppContext({ user: { uid: 'u1', email: 'buyer@example.com' } });
        lookupOrderPoints.mockRejectedValue(new Error('Could not look that order up.'));

        const { container } = await renderSurface(loadClaim, { initialEntries: ['/claim'] });
        await act(async () => {
            type(container.querySelector('#claim-order-number') as HTMLInputElement, 'ORD-1234');
        });
        await act(async () => { buttonByText(container, 'Check this order')!.click(); });

        expect(container.textContent).toContain('Could not look that order up.');
    });
});
