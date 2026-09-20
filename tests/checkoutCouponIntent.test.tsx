// tests/checkoutCouponIntent.test.tsx
//
// REGRESSION CATCH for two paid-but-broken money paths, both reproduced on
// sgcoalition.xyz on 2026-09-20 with the live 100%-off voucher DROP-202608-C0G7:
//
//   1. A discount coupon applied AFTER the shipping form was filled did not
//      re-create the PaymentIntent, because the coupon was missing from the
//      intent effect's dependencies. The page showed the coupon-aware total
//      (Total $0.00) while Stripe still held the pre-coupon amount and the
//      button still read "Pay $45.00" — and complete-order's verifySPI then
//      refused the payment that had already been taken ("Stripe amount
//      mismatch"), so the order was never written.
//   2. A $0 order could not be completed at all: the only completion path
//      posted to /api/place-order-credits, which answers 400 "Missing required
//      fields" when there is no store credit to debit (a coupon-comped order
//      sends total: 0), leaving the shopper stranded on /checkout.
//
// This renders the real Checkout with a seeded card checkout and asserts:
//   1. applying the coupon issues a NEW create-payment-intent carrying that
//      coupon — the dependency pin: drop the coupon from the effect's deps and
//      this test fails because only the first intent is ever requested;
//   2. completing the resulting $0 order calls /api/complete-order and never
//      /api/place-order-credits — the zero-amount pin: route the $0 path back
//      through the credit handler and this fails, exactly as production did.
//
// No new harness: same render/mocks pattern as tests/stripePaymentElementGate.test.tsx.

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';

// pages/Checkout.tsx reads VITE_STRIPE_PUBLISHABLE_KEY at module scope and only
// renders the Stripe section when it is set, so the seeded card checkout would
// never reach an intent on a bare checkout. Hoisted so it lands before that
// module evaluates; @stripe/stripe-js is mocked below, so a fake key is enough.
vi.hoisted(() => {
    vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', 'pk_test_ci_placeholder');
});

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
    default: () => null,
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

// The coupon module: no coupon is stored on mount, and the voucher validates as
// a 100%-off discount coupon — the same shape the coupons table holds.
vi.mock('../utils/couponSystem', () => ({
    getAppliedCouponCode: vi.fn(() => null),
    applyCouponCode: vi.fn(),
    validateCouponCode: vi.fn(async () => ({ valid: false, error: 'Invalid code' })),
    validateDiscountCoupon: vi.fn(async (code: string) => ({
        valid: String(code).toUpperCase() === 'DROP-202608-C0G7',
        coupon: { code: 'DROP-202608-C0G7', discount_type: 'percent', discount_value: 100 },
    })),
}));

vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn(() => Promise.resolve({})),
}));
vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: React.ReactNode }) => children,
    PaymentElement: () => null,
    useElements: () => ({}),
    useStripe: () => ({ confirmPayment: vi.fn() }),
}));

import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import Checkout from '../pages/Checkout';

const COUPON = 'DROP-202608-C0G7';

const CART_ITEM = {
    id: 'prod_coalition_pink_silver_crop_top',
    name: "Women's Leopard Print Crop T-Shirt",
    price: 45,
    images: ['/images/leopard-front.jpg'],
    description: 'Leopard print crop tee.',
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

type MockCall = [RequestInfo | URL, RequestInit?];

/**
 * API stub built from the responses production actually returned for these two
 * calls: a cart without the coupon prices at 4500 and returns a clientSecret;
 * the same cart with the 100%-off coupon prices at 0 and returns zeroAmount.
 * The credit handler answers as production does when there is no credit to
 * debit (400), so a $0 order routed back through it cannot silently pass.
 */
function mockApiFetch(): ReturnType<typeof vi.fn> {
    const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const path = String(url);
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        if (path.includes('/api/create-payment-intent')) {
            return {
                ok: true,
                status: 200,
                json: async () => (body.couponCode
                    ? {
                        clientSecret: null,
                        zeroAmount: true,
                        creditApplied: 0,
                        pricing: { totalCents: 0, itemTotalCents: 4500, shippingCents: 0, discountCents: 4500, storeCreditCents: 0 },
                    }
                    : {
                        clientSecret: 'pi_test_123_secret_456',
                        creditApplied: 0,
                        finalAmount: 45,
                        pricing: { totalCents: 4500, itemTotalCents: 4500, shippingCents: 0, discountCents: 0, storeCreditCents: 0 },
                    }),
            };
        }
        if (path.includes('/api/payment-settings')) {
            return { ok: true, status: 200, json: async () => ({ card_enabled: true, klarna_enabled: false, cashapp_enabled: true, crypto_enabled: true }) };
        }
        if (path.includes('/api/place-order-credits')) {
            return { ok: false, status: 400, json: async () => ({ error: 'Missing required fields' }) };
        }
        if (path.includes('/api/complete-order')) {
            return { ok: true, status: 200, json: async () => ({ id: 'order_test_1', order_number: 'ORD-TEST-0001' }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchFn);
    return fetchFn;
}

const callsTo = (fetchFn: ReturnType<typeof vi.fn>, fragment: string) =>
    (fetchFn.mock.calls as MockCall[]).filter(([u]) => String(u).includes(fragment));

const intentBodies = (fetchFn: ReturnType<typeof vi.fn>) =>
    callsTo(fetchFn, '/api/create-payment-intent').map(([, init]) => JSON.parse(String(init?.body || '{}')));

/** Apply the voucher the way a shopper does: type it, then press Apply. */
async function applyCoupon(container: HTMLElement, code: string) {
    const input = container.querySelector('input[placeholder="Enter referral code"]') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    // React tracks input values through its own hook, so set through the
    // prototype setter (the convention tests/couponManagerRender.test.tsx uses).
    const protoSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    protoSetter.call(input!, code);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    const apply = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Apply');
    expect(apply).toBeTruthy();
    await act(async () => {
        apply!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await Promise.resolve();
        await Promise.resolve();
    });
}

/** Flush the 600ms intent debounce and the fetch promises behind it. */
async function flushIntentDebounce() {
    await act(async () => {
        vi.advanceTimersByTime(700);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe('Checkout coupon <-> PaymentIntent agreement', () => {
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

        // A card checkout whose address is already filled: exactly the state in
        // which the production defect appeared (intent created, then a coupon).
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

    afterAll(() => { vi.unstubAllEnvs(); });

    it('COUPON_INTENT: a coupon applied after the address re-creates the PaymentIntent carrying that coupon', async () => {
        const fetchFn = mockApiFetch();
        await act(async () => { root.render(createElement(Checkout)); });
        await flushIntentDebounce();

        // The pre-coupon intent: one request, no coupon attached.
        const before = intentBodies(fetchFn);
        expect(before).toHaveLength(1);
        expect(before[0].couponCode).toBeUndefined();

        await applyCoupon(container, COUPON);
        await flushIntentDebounce();

        // The coupon moved the price, so Stripe must be holding a new intent
        // for the new price. Without the coupon in the intent effect's
        // dependencies this stays at one request and the shopper is charged the
        // undiscounted amount.
        const after = intentBodies(fetchFn);
        expect(after).toHaveLength(2);
        expect(after[1].couponCode).toBe(COUPON);
        expect(after[1].orderId).toBeTruthy();

        // And the $0 intent must not leave a Pay button that charges the full
        // price, nor a clientSecret for an amount the server will refuse.
        const payButton = [...container.querySelectorAll('button')].find(b => b.textContent?.trim().startsWith('Pay $'));
        expect(payButton).toBeUndefined();
        expect(container.textContent).toContain('No payment required');
    });

    it('ZERO_AMOUNT: a $0 coupon order completes through the order route, never the store-credit handler', async () => {
        const fetchFn = mockApiFetch();
        await act(async () => { root.render(createElement(Checkout)); });
        await flushIntentDebounce();

        await applyCoupon(container, COUPON);
        await flushIntentDebounce();

        const complete = [...container.querySelectorAll('button')]
            .find(b => /Complete Order/.test(b.textContent || ''));
        expect(complete).toBeTruthy();

        await act(async () => {
            complete!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        // The credit handler has nothing to debit for a coupon-comped order and
        // answers 400 on production, which is what stranded the shopper. The
        // order write itself goes through addOrder (context/useOrders.ts posts
        // /api/complete-order from there).
        expect(callsTo(fetchFn, '/api/place-order-credits')).toHaveLength(0);
        const { addOrder } = vi.mocked(useApp).mock.results[0].value;
        expect(addOrder).toHaveBeenCalledTimes(1);
        const written = addOrder.mock.calls[0][0];
        expect(written.paymentMethod).toBe('store_credit');
        expect(written.couponCode).toBe(COUPON);
    });
});
