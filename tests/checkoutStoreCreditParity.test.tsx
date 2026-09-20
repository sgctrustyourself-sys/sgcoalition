// tests/checkoutStoreCreditParity.test.tsx
//
// PIN for one money defect across every payment method the checkout offers:
// store credit was applied ONLY on the Stripe path. With the "Apply Store
// Credit" box ticked, the crypto and Cash App panels were priced without it —
// the shopper saw the credit line and was then asked to send the undiscounted
// amount, the recorded order carried full price, and the balance was never
// debited (the same class of defect as the coupon-stale-intent one, one
// selector down).
//
// This renders the real Checkout with a signed-in user holding $10 of credit
// and, for each method, asserts through the real surface that:
//   1. the pricing request carries the credit request + the user, because the
//      SERVER owns the balance (drop that and the client is estimating again);
//   2. the order summary shows the server's applied credit and a total net of
//      it — the number the shopper actually reads;
//   3. the manual confirm posts that same applied credit on the order, so the
//      server applies and debits it (silently post 0 and the shopper is
//      charged full price with their credit untouched);
//   4. the credit is never debited from the client as well.
//
// No new harness: same render/mock pattern as tests/checkoutCouponIntent.test.tsx.

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';

// pages/Checkout.tsx reads VITE_STRIPE_PUBLISHABLE_KEY at module scope and only
// renders the Stripe section when it is set. Hoisted so it lands before that
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
vi.mock('../utils/couponSystem', () => ({
    getAppliedCouponCode: vi.fn(() => null),
    applyCouponCode: vi.fn(),
    validateCouponCode: vi.fn(async () => ({ valid: false, error: 'Invalid code' })),
    validateDiscountCoupon: vi.fn(async () => ({ valid: false })),
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
import { getAppliedCouponCode, validateDiscountCoupon } from '../utils/couponSystem';
import Checkout from '../pages/Checkout';

const COUPON = 'DROP-202608-C0G7';
const USER_ID = '9b2f8a5c-1d4e-4f6a-9c3b-7e8d2a1b4c5d';
const CREDIT_DOLLARS = 10;
const APPLIED_CENTS = 500;   // what the server says it applied
const ITEM_CENTS = 4500;
const NET_CENTS = ITEM_CENTS - APPLIED_CENTS;

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

/** The row /api/complete-order records and addOrder resolves to. */
const RECORDED_ORDER = {
    id: 'order_test_1',
    orderNumber: 'ORD-TEST-0001',
    total: NET_CENTS / 100,
    subtotal: ITEM_CENTS / 100,
    discount: APPLIED_CENTS / 100,
    tax: 0,
    paymentMethod: 'crypto',
    paymentStatus: 'pending',
    customerName: 'Test Buyer',
    customerEmail: 'buyer@example.com',
    createdAt: '2026-09-20T00:00:00.000Z',
    items: [],
} as any;

function baselineUseApp() {
    return {
        cart: [CART_ITEM] as any[],
        cartTotal: () => 45,
        calculateReward: (t: number) => Math.floor(t),
        clearCart: vi.fn(),
        addOrder: vi.fn().mockResolvedValue(RECORDED_ORDER),
        generateOrderNumber: () => 'ORD-TEST-0001',
        user: { uid: USER_ID, storeCredit: CREDIT_DOLLARS },
        deductInventory: vi.fn(),
    };
}

type MockCall = [RequestInfo | URL, RequestInit?];

/**
 * API stub. The pricing preview is the SERVER the fix routes credit through:
 * it echoes the applied credit only when the request asks for it, priced from
 * the request's own useStoreCredit flag (a client that stops sending it gets
 * no credit — the pre-fix page). The Stripe intent returns the same credit in
 * its pricing snapshot, and the credit handler answers 400 like production so
 * a client-side debit attempt cannot pass silently.
 */
function mockApiFetch(): ReturnType<typeof vi.fn> {
    const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const path = String(url);
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        // Like the server: a 100%-off coupon leaves nothing for credit to
        // cover, so a capped-at-the-order credit is 0 even when asked for.
        const couponDisc = body.couponCode ? ITEM_CENTS : 0;
        const credit = body.useStoreCredit
            ? Math.min(APPLIED_CENTS, Math.max(0, ITEM_CENTS - couponDisc))
            : 0;
        if (path.includes('/api/pricing-preview')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    itemTotalCents: ITEM_CENTS,
                    shippingCents: 0,
                    setBonusCents: 0,
                    cryptoDiscountCents: 0,
                    couponDiscountCents: 0,
                    couponCode: body.couponCode || null,
                    discountCents: couponDisc + credit,
                    storeCreditCents: credit,
                    totalCents: ITEM_CENTS - couponDisc - credit,
                    items: [],
                }),
            };
        }
        if (path.includes('/api/payment-settings')) {
            return { ok: true, status: 200, json: async () => ({ card_enabled: true, klarna_enabled: false, cashapp_enabled: true, crypto_enabled: true }) };
        }
        if (path.includes('/api/create-payment-intent')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    clientSecret: 'pi_test_123_secret_456',
                    creditApplied: credit / 100,
                    finalAmount: (ITEM_CENTS - couponDisc - credit) / 100,
                    pricing: {
                        totalCents: ITEM_CENTS - couponDisc - credit,
                        itemTotalCents: ITEM_CENTS,
                        shippingCents: 0,
                        discountCents: couponDisc + credit,
                        storeCreditCents: credit,
                    },
                }),
            };
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

const bodiesTo = (fetchFn: ReturnType<typeof vi.fn>, fragment: string) =>
    callsTo(fetchFn, fragment).map(([, init]) => JSON.parse(String(init?.body || '{}')));

/** A checkout restored with the address filled, on the given method. */
function seedCheckout(paymentMethod: 'card' | 'cashapp' | 'crypto') {
    sessionStorage.setItem('coalition_checkout_state', JSON.stringify({
        paymentMethod,
        stripeMethod: 'card',
        shippingInfo: SHIPPING,
        shippingMethod: 'standard',
        shippingCost: 0,
    }));
}

/** Flush the debounced server calls (intent 600ms, preview 400ms). */
async function flushServerCalls() {
    await act(async () => {
        vi.advanceTimersByTime(700);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

/** Tick "Apply Store Credit" the way a shopper does. */
async function applyStoreCredit(container: HTMLElement) {
    const box = [...container.querySelectorAll('input[type="checkbox"]')]
        .find(el => (el.closest('label')?.textContent || '').includes('Apply Store Credit')) as HTMLInputElement | undefined;
    expect(box, 'the store credit checkbox is not rendered for a user with a balance').toBeTruthy();
    await act(async () => {
        box!.click();
        await Promise.resolve();
        await Promise.resolve();
    });
    await flushServerCalls();
}

/** The rendered order-summary row for a two-cell label/value line. */
function summaryRow(container: HTMLElement, label: string): string {
    const el = [...container.querySelectorAll('span')].find(s => s.textContent?.trim() === label);
    return (el?.parentElement?.textContent || '').replace(/\s+/g, ' ');
}

const METHODS = ['card', 'cashapp', 'crypto'] as const;

describe('Checkout store credit applies on every payment method', () => {
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
        // clearAllMocks() drops calls, not implementations — restore the coupon
        // module's defaults so the voucher test cannot leak into the others.
        vi.mocked(getAppliedCouponCode).mockReturnValue(null);
        vi.mocked(validateDiscountCoupon).mockResolvedValue({ valid: false } as any);
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

    for (const method of METHODS) {
        it('PRICES_WITH_CREDIT_' + method.toUpperCase() + ': the server price carries the applied credit', async () => {
            const fetchFn = mockApiFetch();
            seedCheckout(method);
            await act(async () => { root.render(createElement(Checkout)); });
            await flushServerCalls();

            await applyStoreCredit(container);

            // The balance is the server's to read: the request must ask for
            // credit and identify the buyer, never assert an amount.
            const previews = bodiesTo(fetchFn, '/api/pricing-preview');
            expect(previews.at(-1)?.useStoreCredit).toBe(true);
            expect(previews.at(-1)?.userId).toBe(USER_ID);

            // What the shopper reads: the applied credit and a total net of it.
            // Before the fix the summary printed the credit line beside the
            // undiscounted $45.00 total (and for the manual methods the payment
            // panel asked for that full amount).
            expect(summaryRow(container, 'Store Credit')).toContain('-$5.00');
            const total = summaryRow(container, 'Total');
            expect(total).toContain('$40.00');
            expect(total).not.toContain('$45.00');
        });
    }

    it('FREE_VOUCHER: a voucher-comped order debits no credit it does not owe', async () => {
        // The same routing change that stopped the client debiting also fixes a
        // real over-charge: with the coupon comping the order the client used to
        // debit its own creditToApply estimate (min(balance, cart estimate)), so
        // the buyer lost credit against an order that owed nothing.
        vi.mocked(getAppliedCouponCode).mockReturnValue(COUPON);
        vi.mocked(validateDiscountCoupon).mockResolvedValue({
            valid: true,
            coupon: { code: COUPON, discount_type: 'percent', discount_value: 100 },
        } as any);
        const fetchFn = mockApiFetch();
        seedCheckout('cashapp');
        await act(async () => { root.render(createElement(Checkout)); });
        await flushServerCalls();
        await applyStoreCredit(container);

        const text = (container.textContent || '').replace(/\s+/g, ' ');
        expect(text).toContain('No payment required');
        expect(text).not.toContain('Paid with Store Credit');

        const complete = [...container.querySelectorAll('button')]
            .find(b => /Complete Order/.test(b.textContent || ''));
        expect(complete).toBeTruthy();
        await act(async () => {
            complete!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();
        });

        const { addOrder } = vi.mocked(useApp).mock.results[0].value;
        expect(addOrder).toHaveBeenCalledTimes(1);
        const written = addOrder.mock.calls[0][0];
        expect(written.couponCode).toBe(COUPON);
        expect(written.storeCreditApplied).toBe(0);
        expect(callsTo(fetchFn, '/api/place-order-credits')).toHaveLength(0);
    });

    for (const method of ['cashapp', 'crypto'] as const) {
        it('POSTS_CREDIT_' + method.toUpperCase() + ': the order carries the credit the server applied, and the client debits nothing', async () => {
            const fetchFn = mockApiFetch();
            seedCheckout(method);
            await act(async () => { root.render(createElement(Checkout)); });
            await flushServerCalls();
            await applyStoreCredit(container);

            const confirm = [...container.querySelectorAll('button')]
                .find(b => /I Have Sent the Payment/.test(b.textContent || ''));
            expect(confirm, 'the manual confirm button is not rendered').toBeTruthy();

            await act(async () => {
                confirm!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                await Promise.resolve();
                await Promise.resolve();
                await Promise.resolve();
            });

            const { addOrder } = vi.mocked(useApp).mock.results[0].value;
            expect(addOrder).toHaveBeenCalledTimes(1);
            const written = addOrder.mock.calls[0][0];
            expect(written.paymentMethod).toBe(method);
            // Posting 0 here is exactly the pre-fix bug: the server then prices
            // the order at full price and never debits the balance.
            expect(written.storeCreditApplied).toBe(APPLIED_CENTS / 100);

            // One debit owner: the credit handler must not be called as well.
            expect(callsTo(fetchFn, '/api/place-order-credits')).toHaveLength(0);
        });
    }
});
