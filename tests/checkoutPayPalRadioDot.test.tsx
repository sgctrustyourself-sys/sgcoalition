// tests/checkoutPayPalRadioDot.test.tsx
//
// REGRESSION CATCH for the "empty PayPal radio dot" glitch found during the
// live-site QA of the PayPal-first checkout.
//
// The secondary 'PayPal Pay in 4' radio inside 'More payment options'
// expressed the SAME state as the primary PayPal radio (both had
// name="paymentMethod" and checked={paymentMethod === 'paypal'}). Browsers
// enforce radio-group exclusivity, so the moment the expander mounted, the
// browser un-checked the primary PayPal radio (DOM order: the later one wins)
// and the visible dot on the PayPal card read empty — even though the purple
// glow stayed on (that is React-state driven).
//
// The fix gives the Pay in 4 radio its own name (payIn4Method) so it can
// never collide with the primary's group. This test renders the real
// Checkout, expands 'More payment options', and asserts the primary PayPal
// radio keeps its checked state.

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
vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn(() => Promise.resolve({})),
}));
vi.mock('@stripe/react-stripe-js', () => {
    const React = require('react');
    return {
        Elements: ({ children }: { children: React.ReactNode }) => children,
        PaymentElement: () => null,
        useElements: () => ({}),
        useStripe: () => ({ confirmPayment: vi.fn() }),
    };
});
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
        if (path.includes('/api/payment-settings')) {
            return { ok: true, json: async () => ({ card_enabled: true, paypal_enabled: true, klarna_enabled: true, crypto_enabled: true }) };
        }
        // pricing-preview + anything else: benign.
        return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchFn);
    return fetchFn;
}

describe('Checkout PayPal primary radio dot stays checked', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.clearAllMocks();
        mockSupabase.setOutcomes([]);
        localStorage.clear();
        sessionStorage.clear();
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});

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

    it('RADIO_DOT: primary PayPal radio stays checked after More payment options expands', async () => {
        mockApiFetch();
        await act(async () => { root.render(createElement(Checkout)); });
        await act(async () => { await Promise.resolve(); });

        // Default state: PayPal is the priority primary and selected.
        const radios = () => [...container.querySelectorAll<HTMLInputElement>('input[type=radio]')]
            .filter(r => r.name === 'paymentMethod');
        expect(radios()[0].checked).toBe(true);

        // The 'More payment options' disclosure is closed at first.
        expect(container.textContent).toContain('More payment options');

        // Expand the disclosure — this mounts the secondary Pay in 4 radio.
        const expander = [...container.querySelectorAll<HTMLButtonElement>('button')]
            .find(b => b.textContent?.includes('More payment options'));
        expect(expander).toBeTruthy();
        await act(async () => { expander!.click(); });
        await act(async () => { await Promise.resolve(); });

        // The Pay in 4 radio lives in its own group now (name=payIn4Method),
        // so it must NOT appear among the paymentMethod radios.
        const payIn4 = container.querySelector<HTMLInputElement>('input[name="payIn4Method"]');
        expect(payIn4).toBeTruthy();
        expect(payIn4!.checked).toBe(true);

        // THE regression: the primary PayPal radio keeps its checked dot.
        expect(radios()[0].checked).toBe(true);
    });
});
