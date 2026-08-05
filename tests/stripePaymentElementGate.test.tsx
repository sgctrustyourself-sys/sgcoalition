// tests/stripePaymentElementGate.test.tsx
//
// REGRESSION CATCH for the Stripe "elements should have a mounted Payment
// Element or Express Checkout Element" crash on the card/Klarna checkout.
//
// The PaymentElement mounts asynchronously after the <Elements> provider
// re-renders (e.g. a shipping edit triggers a fresh PaymentIntent with a new
// clientSecret). If the buyer clicks "Pay" before onReady fires,
// stripe.confirmPayment({ elements }) throws — the elements instance has no
// mounted element. The fix gates the Pay button on PaymentElement's onReady
// callback (and keys <Elements> to the clientSecret so a stale instance is
// never reused across intent swaps).
//
// This test renders the real Checkout with a seeded card checkout, waits for
// the debounced intent to set a clientSecret, and asserts:
//   1. Pay is DISABLED before the PaymentElement reports onReady.
//   2. Pay becomes ENABLED exactly when onReady fires.
//   3. The confirmPayment call only happens once onReady has fired.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';

vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));
vi.mock('../context/AppContext', () => ({
    useApp: vi.fn(),
}));
vi.mock('../context/ToastContext', () => ({
    useToast: vi.fn(),
}));
vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
}));
vi.mock('../components/FloatingHelpButton', () => ({
    default: () => <div />,
}));
vi.mock('../utils/pricing', () => ({
    isSGCoinDiscountEnabled: () => false,
    getDiscountPercentageText: () => '5%',
}));
vi.mock('../utils/referralAnalytics', () => ({
    trackReferralEvent: vi.fn(),
}));
vi.mock('../utils/referralSystem', () => ({
    processReferralOnPurchase: vi.fn().mockResolvedValue({ success: false }),
    clearReferralCode: vi.fn(),
}));
vi.mock('../utils/couponSystem', () => ({
    validateCouponCode: vi.fn(),
    applyCouponCode: vi.fn(),
    getAppliedCouponCode: vi.fn(() => null),
}));

// Controllable Stripe mock: the PaymentElement captures its onReady so the
// test decides exactly when the element "mounts". useStripe records whether
// confirmPayment was ever invoked.
const stripeMock = {
    confirmPayment: vi.fn().mockResolvedValue({
        paymentIntent: { id: 'pi_test_123', status: 'succeeded' },
    }),
};
let capturedOnReady: (() => void) | null = null;

vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn(() => Promise.resolve({})),
}));
vi.mock('@stripe/react-stripe-js', () => {
    const React = require('react');
    return {
        Elements: ({ children }: { children: React.ReactNode }) => children,
        PaymentElement: ({ onReady }: { onReady?: () => void }) => {
            React.useEffect(() => {
                capturedOnReady = onReady || null;
            }, [onReady]);
            return null;
        },
        useElements: () => ({}),
        useStripe: () => stripeMock,
    };
});

import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import Checkout from '../pages/Checkout';

const CART_ITEM = {
    id: 'prod-tee',
    name: 'Coalition Classic Tee',
    price: 45,
    images: ['/images/tee-front.jpg'],
    description: 'Premium cotton tee.',
    category: 'apparel',
    selectedSize: 'M',
    quantity: 1,
    keychainClipOn: false,
    cartId: 'cart-1',
    freeShipping: false,
};

const SHIPPING = {
    email: 'buyer@example.com',
    name: 'Test Buyer',
    address1: '123 Main St',
    city: 'Baltimore',
    state: 'MD',
    zip: '21201',
    country: 'United States',
};

function baselineUseApp() {
    return {
        cart: [CART_ITEM] as any[],
        cartTotal: () => 45,
        calculateReward: (t: number) => Math.floor(t),
        clearCart: vi.fn(),
        addOrder: vi.fn().mockResolvedValue(undefined),
        generateOrderNumber: () => 'ORD-TEST-0001',
        user: null,
        deductInventory: vi.fn(),
    };
}

function mockApiFetch(): ReturnType<typeof vi.fn> {
    const fetchFn = vi.fn(async (url: RequestInfo | URL) => {
        const path = String(url);
        if (path.includes('/api/create-payment-intent')) {
            return {
                ok: true,
                json: async () => ({
                    clientSecret: 'pi_test_123_secret_456',
                    pricing: { totalCents: 4500, itemTotalCents: 4500, shippingCents: 0, discountCents: 0 },
                }),
            };
        }
        if (path.includes('/api/payment-settings')) {
            return { ok: true, json: async () => ({ card_enabled: true, paypal_enabled: true, klarna_enabled: true, crypto_enabled: true }) };
        }
        // pricing-preview + anything else: benign.
        return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchFn);
    return fetchFn;
}

describe('Stripe PaymentElement readiness gate', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        capturedOnReady = null;
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        sessionStorage.clear();
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Seed a card checkout so lazy initializers restore card + shipping
        // on mount (same mechanism the redirect-return relies on).
        sessionStorage.setItem('coalition_checkout_state', JSON.stringify({
            paymentMethod: 'card',
            stripeMethod: 'card',
            shippingInfo: SHIPPING,
            shippingMethod: 'standard',
            shippingCost: 0,
        }));

        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);

        vi.mocked(useToast).mockReturnValue({ addToast: vi.fn() } as any);
        vi.mocked(useApp).mockReturnValue(baselineUseApp() as any);
    });

    afterEach(() => {
        act(() => { root.unmount(); });
        if (container.parentNode === document.body) document.body.removeChild(container);
        vi.unstubAllGlobals();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('PAY_GATE: button disabled until PaymentElement onReady fires, then enabled; confirmPayment never runs early', async () => {
        mockApiFetch();
        await act(async () => { root.render(createElement(Checkout)); });

        // The StripePaymentSection only mounts once a clientSecret exists.
        // The intent effect debounces 600ms, so advance past it and flush.
        await act(async () => {
            vi.advanceTimersByTime(700);
            await Promise.resolve();
            await Promise.resolve();
        });

        const payButton = [...container.querySelectorAll('button')]
            .find(b => b.textContent?.trim().startsWith('Pay $'));
        expect(payButton).toBeTruthy();

        // Elements is mounted, but the PaymentElement has NOT reported ready
        // yet (capturedOnReady is set, but not called) -> Pay must be disabled.
        expect(capturedOnReady).toBeTypeOf('function');
        expect(payButton!.disabled).toBe(true);
        expect(stripeMock.confirmPayment).not.toHaveBeenCalled();

        // Fire onReady -> the gate opens and Pay becomes clickable.
        await act(async () => { capturedOnReady!(); });
        expect(payButton!.disabled).toBe(false);

        // Submitting now calls confirmPayment exactly once, with the ready
        // elements instance, and completes the order through onPaid.
        await act(async () => {
            payButton!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        });
        await act(async () => { await Promise.resolve(); });

        expect(stripeMock.confirmPayment).toHaveBeenCalledTimes(1);
        const { addOrder } = vi.mocked(useApp).mock.results[0].value;
        expect(addOrder).toHaveBeenCalledTimes(1);
        expect(addOrder.mock.calls[0][0].paymentMethod).toBe('stripe');
    });
});
