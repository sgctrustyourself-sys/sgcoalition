// tests/checkoutRedirectReturn.test.tsx
//
// REGRESSION CATCH for the PayPal Pay Later redirect-return recovery in
// pages/Checkout.tsx.
//
// PayPal Pay in 4 uses a redirect flow: the browser fully reloads
// /checkout?token=...&PayerID=... and the PayPal buttons must be re-rendered
// into the container so the SDK can fire onApprove and finish the capture.
// Previously the buttons only mounted inside the "Continue to PayPal" click
// handler, so after the redirect the order hung forever.
//
// Replicates the established pattern: createRoot + act + explicit DOM
// assertions (no snapshots). Fake timers drive the 100ms container-mount
// delay and the 250ms SDK-load poll deterministically.
//
// Mock surface:
//   - window.paypal  -> { Buttons: vi.fn(() => ({ render: vi.fn() })) }
//   - window.location -> plain-object stub with ?token=&PayerID= so the
//     effect's URL detection fires and onApprove's redirect is inert.
//   - global fetch   -> /api/paypal-order capture returns COMPLETED.
//   - ../context/AppContext (useApp) -> non-empty cart + addOrder spy.
//   - ../context/ToastContext (useToast), stripe modules, react-router-dom,
//     FloatingHelpButton, and the small utils Checkout imports.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrictMode, createElement, act } from 'react';
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
vi.mock('@stripe/react-stripe-js', () => ({
    Elements: ({ children }: { children: React.ReactNode }) => children,
    PaymentElement: () => null,
    useElements: () => null,
    useStripe: () => null,
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

const baselineUseApp = () => ({
    cart: [CART_ITEM] as any[],
    cartTotal: () => 45,
    calculateReward: (t: number) => Math.floor(t),
    clearCart: vi.fn(),
    addOrder: vi.fn().mockResolvedValue(undefined),
    generateOrderNumber: () => 'ORD-TEST-0001',
    user: null,
    deductInventory: vi.fn(),
});

interface PayPalButtonsConfig {
    createOrder?: () => Promise<string>;
    onApprove?: (data: { orderID: string }) => Promise<void>;
    onError?: (err: unknown) => void;
    onCancel?: () => void;
}

function mockPaypalGlobal(): { Buttons: ReturnType<typeof vi.fn>; renderFn: ReturnType<typeof vi.fn>; configs: PayPalButtonsConfig[] } {
    const configs: PayPalButtonsConfig[] = [];
    const renderFn = vi.fn().mockResolvedValue(undefined);
    const Buttons = vi.fn((config: PayPalButtonsConfig) => {
        configs.push(config);
        return { render: renderFn };
    });
    (window as any).paypal = { Buttons };
    return { Buttons, renderFn, configs };
}

/** Replace window.location with an inert plain-object stub (no navigation).
 *  The original Location is stashed so afterEach can restore it. */
const ORIGINAL_LOCATION = window.location;
function mockLocationWithToken(token: string, payerId: string): void {
    const href = `https://sgcoalition.xyz/checkout?token=${token}&PayerID=${payerId}`;
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            origin: 'https://sgcoalition.xyz',
            href,
            search: `?token=${token}&PayerID=${payerId}`,
            pathname: '/checkout',
            hash: '',
            assign: vi.fn(),
            replace: vi.fn(),
            reload: vi.fn(),
        },
    });
}

function mockLocationWithCancelledToken(token: string): void {
    const href = `https://sgcoalition.xyz/checkout?token=${token}`;
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            origin: 'https://sgcoalition.xyz',
            href,
            search: `?token=${token}`,
            pathname: '/checkout',
            hash: '',
            assign: vi.fn(),
            replace: vi.fn(),
            reload: vi.fn(),
        },
    });
}

function mockFetchForCapture(): ReturnType<typeof vi.fn> {
    const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        const path = String(url);
        if (path.includes('/api/paypal-order')) {
            const body = JSON.parse(String(init?.body || '{}'));
            if (body.action === 'capture') {
                return {
                    ok: true,
                    json: async () => ({
                        orderId: 'PO-123',
                        captureId: 'CAP-456',
                        captureStatus: 'COMPLETED',
                    }),
                };
            }
            return { ok: true, json: async () => ({ id: 'PO-123' }) };
        }
        // pricing-preview + any other API: benign default.
        return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchFn);
    return fetchFn;
}

describe('Checkout PayPal redirect-return recovery', () => {
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
        // Restore the real Location (Object.defineProperty bypasses
        // vi.unstubAllGlobals).
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: ORIGINAL_LOCATION,
        });
        vi.unstubAllGlobals();
        vi.useRealTimers();
        vi.restoreAllMocks();
        delete (window as any).paypal;
    });

    it('REDIRECT_RETURN: SDK loaded at mount -> buttons render into container exactly once', async () => {
        const { Buttons, renderFn, configs } = mockPaypalGlobal();
        mockLocationWithToken('TOK-123', 'PAYER-456');
        mockFetchForCapture();

        await act(async () => { root.render(createElement(Checkout)); });
        // Render commits the paypal section (paymentMethod defaults to 'paypal',
        // cart non-empty), then the effect's 100ms timer fires the re-render.
        await act(async () => {
            vi.advanceTimersByTime(100);
            await Promise.resolve();
            await Promise.resolve();
        });

        // Exactly one Buttons() call -> the container was re-rendered once.
        expect(Buttons).toHaveBeenCalledTimes(1);
        // The SDK render() targeted the checkout container.
        expect(renderFn).toHaveBeenCalledTimes(1);
        expect(renderFn).toHaveBeenCalledWith('#paypal-button-container-checkout');
        // Config carries the full callback surface the SDK needs.
        expect(configs[0].createOrder).toBeTypeOf('function');
        expect(configs[0].onApprove).toBeTypeOf('function');
        expect(configs[0].onError).toBeTypeOf('function');
        expect(configs[0].onCancel).toBeTypeOf('function');

        // Advancing further (SDK-load poll window, event) must NOT re-render.
        await act(async () => {
            window.dispatchEvent(new Event('coalition:paypal-ready'));
            vi.advanceTimersByTime(250);
            vi.advanceTimersByTime(100);
            await Promise.resolve();
        });
        expect(Buttons).toHaveBeenCalledTimes(1);
        expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it('CANCEL_RETURN: token without PayerID shows cancellation and does not render PayPal buttons', async () => {
        const { Buttons, renderFn } = mockPaypalGlobal();
        mockLocationWithCancelledToken('TOK-CANCELLED');
        mockFetchForCapture();

        await act(async () => { root.render(createElement(Checkout)); });
        await act(async () => { await Promise.resolve(); });

        expect(container.textContent).toContain('Payment was cancelled. Your cart is still saved');
        expect(Buttons).not.toHaveBeenCalled();
        expect(renderFn).not.toHaveBeenCalled();
    });

    it('REDIRECT_RETURN_LATE_SDK: SDK loads after mount (event + poll) -> single render, guard holds', async () => {
        // No window.paypal at mount -> effect registers the ready listener + poll.
        mockLocationWithToken('TOK-LATE', 'PAYER-789');
        mockFetchForCapture();

        await act(async () => { root.render(createElement(Checkout)); });
        await act(async () => {
            vi.advanceTimersByTime(50); // React commits; effect mounted listener
            await Promise.resolve();
        });

        // SDK arrives after mount: the event AND the 250ms poll could both fire.
        const { Buttons, renderFn } = mockPaypalGlobal();
        await act(async () => {
            window.dispatchEvent(new Event('coalition:paypal-ready'));
            vi.advanceTimersByTime(100); // container-mount delay after readiness
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(Buttons).toHaveBeenCalledTimes(1);
        expect(renderFn).toHaveBeenCalledTimes(1);
        expect(renderFn).toHaveBeenCalledWith('#paypal-button-container-checkout');

        // Poll window advancing must not create a second render.
        await act(async () => {
            vi.advanceTimersByTime(500);
            await Promise.resolve();
        });
        expect(Buttons).toHaveBeenCalledTimes(1);
        expect(renderFn).toHaveBeenCalledTimes(1);
    });


    it('REDIRECT_RETURN_STRICTMODE: SDK pre-loaded + StrictMode double-mount -> single render (component-scope guard)', async () => {
        // index.tsx wraps the app in <React.StrictMode>, which mounts ->
        // unmounts -> mounts effects. The redirect-return guard MUST survive
        // that cycle (component-level ref), otherwise the buttons render twice.
        const { Buttons, renderFn } = mockPaypalGlobal();
        mockLocationWithToken('TOK-SM', 'PAYER-SM');
        mockFetchForCapture();

        await act(async () => {
            root.render(
                createElement(StrictMode, null, createElement(Checkout))
            );
        });
        // First mount schedules the render; StrictMode's cleanup + re-mount
        // would double-render without the component-scope guard.
        await act(async () => {
            vi.advanceTimersByTime(100);
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(Buttons).toHaveBeenCalledTimes(1);
        expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it('REDIRECT_RETURN_ONAPPROVE: returned order ID is captured once -> order created with PayPal method + success redirect', async () => {
        const { configs } = mockPaypalGlobal();
        mockLocationWithToken('TOK-123', 'PAYER-456');
        const fetchFn = mockFetchForCapture();
        const addOrder = vi.fn().mockResolvedValue(undefined);
        vi.mocked(useApp).mockReturnValue({ ...baselineUseApp(), addOrder } as any);

        await act(async () => { root.render(createElement(Checkout)); });
        await act(async () => {
            vi.advanceTimersByTime(100);
            await Promise.resolve();
            await Promise.resolve();
        });

        // The SDK's redirect-return fires onApprove with the token as orderID.
        const onApprove = configs[0].onApprove!;
        await act(async () => { await onApprove({ orderID: 'PO-123' }); });

        // Exactly one capture call for this order.
        const captureCalls = fetchFn.mock.calls.filter(([url, init]) =>
            String(url).includes('/api/paypal-order') &&
            (JSON.parse(String((init as any)?.body || '{}')).action === 'capture')
        );
        expect(captureCalls).toHaveLength(1);
        expect(JSON.parse(String((captureCalls[0][1] as any).body))).toEqual({
            action: 'capture',
            orderId: 'PO-123',
        });

        // Order written through the shared path with PayPal verification data.
        expect(addOrder).toHaveBeenCalledTimes(1);
        const order = (addOrder.mock.calls[0][0] as any);
        expect(order.paymentMethod).toBe('paypal');
        expect(order.paypalOrderId).toBe('PO-123');
        expect(order.paypalCaptureId).toBe('CAP-456');
        expect(order.orderNumber).toBe('ORD-TEST-0001');

        // Success redirect + session payload stashed for the success page.
        expect((window.location as any).href).toContain('/order/success?payment_method=paypal');
        expect(sessionStorage.getItem('orderNumber')).toBe('ORD-TEST-0001');
        expect(sessionStorage.getItem('shippingInfo')).toBeTruthy();
    });
});
