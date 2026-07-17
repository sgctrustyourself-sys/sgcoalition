// tests/customerLinkModalRender.test.tsx
//
// Vitest lock for components/admin/CustomerLinkModal.tsx.
//
// Tests the modal in isolation by mocking utils/customerProfile's two
// builders directly. The smart-fallback contract is load-bearing.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('lucide-react', async () => {
    const actual = await vi.importActual<any>('lucide-react');
    return {
        ...actual,
        Loader2: (props: any) => <span data-testid="loader-icon" {...props} />,
    };
});

const mockedProfileBuilder = vi.fn();
const mockedGuestBuilder = vi.fn();

vi.mock('../utils/customerProfile', async () => {
    const actual = await vi.importActual<any>('../utils/customerProfile');
    return {
        ...actual,
        buildCustomerProfile: (...a: unknown[]) => mockedProfileBuilder(...a),
        buildCustomerProfileByEmail: (...a: unknown[]) => mockedGuestBuilder(...a),
    };
});

import CustomerLinkModal from '../components/admin/CustomerLinkModal';

const FULL_PROFILE = {
    userId: 'user-real-123',
    displayName: 'Real Buyer',
    email: 'real@buyer.com',
    walletAddress: null,
    isVIP: false,
    storeCredit: 25,
    sgCoinBalance: 1000,
    lifetimeSpendUsd: 460,
    lifetimeOrders: 3,
    customerNotes: null,
    orderCount: 3,
    totalSpend: 460,
    firstOrderDate: '2026-01-15T00:00:00Z',
    lastOrderDate: '2026-07-14T00:00:00Z',
    favoriteCategories: ['prod_wallet_chrome_hearts', 'Coalition_Above_As_Below_Wallet_1_1', 'Coalition_Grey_Wave_Wallet_2_2'],
    socialAccounts: [],
    referralCode: null,
    referralStats: null,
    payoutStats: { totalRequested: 0, pendingCount: 0, completedCount: 0, rejectedCount: 0, lastStatus: null, lastAmount: null, lastDate: null },
    payoutRequests: [],
    anonymousOrderCount: 0,
    anonymousTotalSpend: 0,
};

const GUEST_PROFILE = {
    email: 'guest@buyer.com',
    orderCount: 2,
    totalSpend: 175,
    firstOrderDate: '2026-02-01T00:00:00Z',
    lastOrderDate: '2026-07-09T00:00:00Z',
    isVerifiedBuyer: true,
};

describe('CustomerLinkModal render + state contract', () => {
    let container: HTMLDivElement;
    let root: Root;
    let onCloseMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockedProfileBuilder.mockReset();
        mockedGuestBuilder.mockReset();
        onCloseMock = vi.fn();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
    });

    const renderModal = (props: Partial<React.ComponentProps<typeof CustomerLinkModal>> = {}) => {
        act(() => {
            root.render(createElement(CustomerLinkModal, {
                userId: 'user-real-123',
                customerEmail: 'real@buyer.com',
                customerName: 'Real Buyer',
                orderId: 'order-test-001',
                onClose: onCloseMock,
                ...props,
            }));
        });
    };

    const flushPromises = async () => {
        await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
        });
    };

    it('PROFILE_PATH: userId is real auth -> buildCustomerProfile returns profile -> renders PROFILE state with LTV', async () => {
        mockedProfileBuilder.mockResolvedValueOnce(FULL_PROFILE);
        renderModal();
        expect(container.querySelector('[data-state="loading"]')).toBeTruthy();
        await flushPromises();
        expect(container.querySelector('[data-state="profile"]')).toBeTruthy();
        expect(container.innerHTML).toContain('LTV');
        expect(container.innerHTML).toContain('$460.00');
        expect(container.innerHTML).toContain('1,000 SGC');
        expect(container.innerHTML).toContain('Verified Profile');
        expect(container.innerHTML).toContain('Coalition_Grey_Wave_Wallet_2_2');
    });

    it('GUEST_PATH: profile returns null + email set -> falls back to buildCustomerProfileByEmail -> renders GUEST state', async () => {
        mockedProfileBuilder.mockResolvedValueOnce(null);
        mockedGuestBuilder.mockResolvedValueOnce(GUEST_PROFILE);
        renderModal();
        await flushPromises();
        expect(container.querySelector('[data-state="guest"]')).toBeTruthy();
        expect(container.querySelector('[data-state="profile"]')).toBeNull();
        expect(container.innerHTML).toContain('Verified Buyer');
        expect(container.innerHTML).toContain('$175.00');
        expect(container.innerHTML).toContain('Guest Lookup');
    });

    it('METAMASK_FALLBACK: userId starts with "user_eth_" + email -> skips profile path entirely', async () => {
        mockedGuestBuilder.mockResolvedValueOnce(GUEST_PROFILE);
        renderModal({ userId: 'user_eth_0xabc123def456abc123def456abc123def456abc1', customerEmail: 'metamask@wallet.com' });
        await flushPromises();
        expect(mockedProfileBuilder).not.toHaveBeenCalled();
        expect(mockedGuestBuilder).toHaveBeenCalledWith('metamask@wallet.com');
        expect(container.querySelector('[data-state="guest"]')).toBeTruthy();
    });

    it('EMAIL_ONLY: no userId provided -> goes straight to GUEST path', async () => {
        mockedGuestBuilder.mockResolvedValueOnce(GUEST_PROFILE);
        renderModal({ userId: undefined, customerEmail: 'email-only@buyer.com' });
        await flushPromises();
        expect(mockedProfileBuilder).not.toHaveBeenCalled();
        expect(mockedGuestBuilder).toHaveBeenCalledWith('email-only@buyer.com');
        expect(container.querySelector('[data-state="guest"]')).toBeTruthy();
    });

    it('ERROR_PATH: both builders reject -> ERROR state with emitted message', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        mockedProfileBuilder.mockRejectedValueOnce(new Error('profile lookup down'));
        mockedGuestBuilder.mockRejectedValueOnce(new Error('guest lookup down'));
        renderModal({ customerEmail: 'broken@example.com' });
        await flushPromises();
        const errorBlock = container.querySelector('[data-state="error"]');
        expect(errorBlock).toBeTruthy();
        expect(container.innerHTML).toContain('Lookup failed');
        expect(container.innerHTML).toContain('guest lookup down');
    });

    it('CLOSE_BUTTON: clicking the X button fires onClose callback exactly once', async () => {
        mockedProfileBuilder.mockResolvedValueOnce(FULL_PROFILE);
        renderModal();
        await flushPromises();
        expect(onCloseMock).not.toHaveBeenCalled();
        const closeBtn = container.querySelector('[data-testid="customer-link-modal-close"]') as HTMLButtonElement | null;
        expect(closeBtn).toBeTruthy();
        await act(async => { closeBtn!.click(); });
        expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('STATE_PROPAGATION: passing userId change re-runs the resolver (MetaMask triggers email path)', async () => {
        // First render: real user -> PROFILE state via mocked profile builder.
        mockedProfileBuilder.mockResolvedValueOnce(FULL_PROFILE);
        renderModal({ userId: 'user-real-123', customerEmail: 'real@buyer.com' });
        await flushPromises();
        expect(container.querySelector('[data-state="profile"]')).toBeTruthy();
        expect(mockedProfileBuilder).toHaveBeenCalledTimes(1);

        // Re-render with NEW userId (MetaMask prefix) + new customerEmail.
        // The mocked guest builder resolves synchronously inside the
        // useEffect microtask, so the loading state is brief and may not
        // settle before our assertion if the act() flushes all microtasks.
        // The load-bearing contract is: the resolver ran AGAIN with the
        // NEW email + the resulting state is guest, not the loading
        // intermediate. Assert both.
        mockedGuestBuilder.mockResolvedValueOnce({ ...GUEST_PROFILE, email: 'metamask@wallet.com' });
        await act(async () => {
            root.render(createElement(CustomerLinkModal, {
                userId: 'user_eth_0xabc123def456abc123def456abc123def456abc1',
                customerEmail: 'metamask@wallet.com',
                customerName: 'MetaMask Buyer',
                orderId: 'order-test-002',
                onClose: onCloseMock,
            }));
        });
        await flushPromises();

        // The profile path was skipped (MetaMask prefix); the email path
        // ran with the NEW email and resolved to GUEST state.
        expect(mockedProfileBuilder).toHaveBeenCalledTimes(1); // unchanged
        expect(mockedGuestBuilder).toHaveBeenCalledTimes(1);
        expect(mockedGuestBuilder).toHaveBeenLastCalledWith('metamask@wallet.com');
        expect(container.querySelector('[data-state="guest"]')).toBeTruthy();
        expect(container.innerHTML).toContain('metamask@wallet.com');
    });
});
