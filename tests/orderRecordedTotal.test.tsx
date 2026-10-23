// tests/orderRecordedTotal.test.tsx
//
// REGRESSION CATCH for the total the app shows after checkout.
//
// Before this, addOrder (context/useOrders.ts) kept the CLIENT's own order
// object and threw away the row /api/complete-order returned. The server
// re-prices every order from the catalog — coupon, set bonus, crypto discount,
// store credit — so for a coupon-comped order (a flow that could not even write
// an order before PR #30) the client object still carried the pre-coupon
// estimate: /order/success rendered "Order Total $45.00" out of
// sessionStorage.pendingOrder while the stored row and the confirmation email
// said $0.00, and updateLifetimeStats counted the estimate as customer spend.
//
// Three pins, all load-bearing:
//
//   1. RECORDED_ORDER_IS_RETURNED — drives the REAL useOrders().addOrder against
//      a stubbed /api/complete-order that answers with the recorded row (total 0)
//      while the client's object says 45. Revert the recorded-row mapping and
//      this goes red: the resolved order, the state the app keeps, and the
//      lifetime-stats call all go back to the 45 estimate.
//
//   2. SUCCESS_PAGE_SHOWS_THE_RECORDED_TOTAL — feeds the order addOrder actually
//      resolved (what Checkout stores, since the cart is cleared before the
//      redirect) to the REAL OrderSuccess, using the same render harness as
//      tests/orderSuccessStripeRedirect.test.tsx, and asserts the rendered
//      "Order Total" is the recorded $0.00 rather than the client's $45.00.
//
//   3. MISSING_RECORDED_ROW_FAILS_CLOSED — a 200 that carries no row (or an
//      unreadable body) makes addOrder REJECT. Put the old `: order` fallback
//      back and it goes green on the client's $45.00 estimate, which is the
//      defect: the server is the only writer, so "it answered 200" is not
//      "an order exists".
//
// The Checkout end of the chain — that pendingOrder is written from addOrder's
// return value — is pinned in tests/checkoutCouponIntent.test.tsx, which drives
// the real coupon-comped Complete Order click.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mockSupabase } from './_helpers/supabaseClientMock';

vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('../utils/customerProfile', () => ({ updateLifetimeStats: vi.fn(async () => undefined) }));
vi.mock('react-router-dom', () => ({ Link: ({ children }: any) => children, useSearchParams: vi.fn() }));
vi.mock('lucide-react', () => {
    const Icon = () => null;
    return { CheckCircle: Icon, Package: Icon, Hexagon: Icon, Home: Icon, Loader: Icon, Copy: Icon, Check: Icon, Users: Icon };
});
vi.mock('../utils/walletAddOns', () => ({
    getCartItemUnitPrice: (i: any) => i.price,
    getCartItemLineTotal: (i: any) => i.price * i.quantity,
    WALLET_KEYCHAIN_CLIP_LABEL: 'Keychain clip',
    WALLET_KEYCHAIN_CLIP_PRICE: 10,
}));
vi.mock('../utils/referralSystem', () => ({ getReferralStats: vi.fn(), generateReferralLink: vi.fn() }));
vi.mock('../utils/referralAnalytics', () => ({ trackReferralShare: vi.fn() }));

import { useApp } from '../context/AppContext';
import { useSearchParams } from 'react-router-dom';
import { updateLifetimeStats } from '../utils/customerProfile';
import { useOrders } from '../context/useOrders';
import { ORDER_WRITE_TIMEOUT_MS } from '../utils/fetchWithTimeout';
import OrderSuccess from '../pages/OrderSuccess';

// useOrders subscribes to a realtime channel; the shared mock client has no
// channel factory, so give it the same no-op shape supabase-js returns.
(mockSupabase.client as any).channel = () => ({
    on: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) }),
});

// A coupon-comped order: the client priced nothing (its estimate is the raw
// cart, 45) and the server priced it at 0.
const CLIENT_ORDER: any = {
    id: 'order_test_1',
    orderNumber: 'ORD-TEST-1',
    userId: 'user-1',
    isGuest: false,
    customerName: 'Guest Buyer',
    customerEmail: 'buyer@example.com',
    items: [{ productId: 'prod-tee', productName: 'Coalition Classic Tee', productImage: '/tee.jpg', image: '/tee.jpg', name: 'Coalition Classic Tee', selectedSize: 'M', quantity: 1, price: 45, total: 45 }],
    subtotal: 45,
    tax: 0,
    discount: 0,
    total: 45,
    paymentMethod: 'store_credit',
    paymentStatus: 'paid',
    orderType: 'online',
    createdAt: '2026-09-20T00:00:00.000Z',
    paidAt: '2026-09-20T00:00:00.000Z',
    couponCode: 'DROP-202608-C0G7',
};

// The recorded row /api/complete-order answers with: server-priced 0, with the
// coupon noted — and, like every row acceptCheckout writes, no product image.
const RECORDED_ROW: any = {
    id: 'order_test_1',
    order_number: 'ORD-TEST-1',
    user_id: 'user-1',
    is_guest: false,
    customer_name: 'Guest Buyer',
    customer_email: 'buyer@example.com',
    items: [{ productId: 'prod-tee', productName: 'Coalition Classic Tee', productImage: '', selectedSize: 'M', quantity: 1, price: 45, total: 45 }],
    subtotal: 45,
    tax: 0,
    discount: 45,
    total: 0,
    total_amount: 0,
    payment_method: 'store_credit',
    payment_status: 'paid',
    payment_reference: null,
    order_type: 'online',
    notes: 'Coupon: DROP-202608-C0G7 (-$45.00)',
    created_at: '2026-09-20T00:00:00.000Z',
    paid_at: '2026-09-20T00:00:00.000Z',
    sg_coin_reward: 45,
    shipping_address: { address1: '1 Coalition Way', city: 'Baltimore', state: 'MD', zip: '21201', country: 'US', shippingMethod: 'standard', shippingCost: 0 },
};

describe('the order the app shows is the order the server recorded', () => {
    let container: HTMLDivElement;
    let root: Root;
    let api: any;

    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        localStorage.clear();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
        // The real redirects always carry the method the customer paid with
        // (Checkout appends `payment_method=...`); without it the page stops
        // before reading the stored order.
        vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('payment_method=store_credit'), vi.fn()] as any);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        api = null;
    });

    afterEach(() => {
        act(() => root.unmount());
        if (container.parentNode) container.parentNode.removeChild(container);
        vi.restoreAllMocks();
    });

    /** Mounts the real useOrders hook and returns whatever addOrder resolves. */
    async function driveAddOrder(): Promise<any> {
        function Probe() {
            api = useOrders(true, false, () => undefined);
            return null;
        }
        await act(async () => { root.render(createElement(Probe)); });
        expect(api).toBeTruthy();
        let recorded: any = null;
        await act(async () => { recorded = await api.addOrder(CLIENT_ORDER); });
        return recorded;
    }

    it('RECORDED_ORDER_IS_RETURNED: addOrder resolves to the row the server wrote', async () => {
        const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => RECORDED_ROW });
        vi.stubGlobal('fetch', fetchFn);

        const recorded = await driveAddOrder();

        expect(fetchFn).toHaveBeenCalledWith('/api/complete-order', expect.objectContaining({ method: 'POST' }));
        // The recorded total, not the object we handed over.
        expect(recorded.total).toBe(0);
        expect(recorded.total).not.toBe(CLIENT_ORDER.total);
        expect(recorded.id).toBe('order_test_1');
        expect(recorded.orderNumber).toBe('ORD-TEST-1');
        // Same numbers in state and in the spend derived from it.
        expect(api.orders[0].total).toBe(0);
        expect(updateLifetimeStats).toHaveBeenCalledWith('user-1', 0);
    });

    it('SUCCESS_PAGE_SHOWS_THE_RECORDED_TOTAL: the confirmation page renders the recorded total', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => RECORDED_ROW }));
        const recorded = await driveAddOrder();
        act(() => root.unmount());

        // Exactly what Checkout persists before redirecting (the cart is cleared
        // on the way out, so this object is what the page shows).
        sessionStorage.setItem('pendingOrder', JSON.stringify(recorded));

        vi.mocked(useApp).mockReturnValue({
            cart: [], cartTotal: () => 0, calculateReward: () => 0, clearCart: vi.fn(), user: null, updateUser: vi.fn(),
        } as any);

        const pageRoot = createRoot(container);
        await act(async () => {
            pageRoot.render(createElement(OrderSuccess));
            for (let i = 0; i < 8; i++) await Promise.resolve();
        });

        const text = (container.textContent || '').replace(/\s+/g, ' ');
        expect(text).toContain('Order Confirmed!');
        // DOM traversal (the label and its value are sibling <p>s, so a flattened
        // string cannot tell them apart — same approach as the OrderManager test).
        const totalLabel = [...container.querySelectorAll('p')]
            .find(p => (p.textContent || '').trim() === 'Order Total');
        expect(totalLabel?.nextElementSibling?.textContent).toBe('$0.00');
        // The client estimate must not be anywhere on the page.
        expect(text).not.toContain('$45.00');
        // The recorded row keeps the customer's thumbnail even though the orders
        // table stores no image (acceptCheckout writes productImage: '').
        expect(container.querySelector('img')?.getAttribute('src')).toBe('/tee.jpg');

        act(() => pageRoot.unmount());
    });

    it('HUNG_WRITE_FAILS_INSTEAD_OF_HANGING: a request that never answers becomes a real error', async () => {
        // A connection the platform never closes. Unbounded, addOrder stays
        // pending forever, so the caller's pay button stays disabled (Checkout)
        // or the page stays on "Processing..." with no message — the shopper's
        // only way out is a manual reload. The bound turns that wait into the
        // error every caller already handles.
        //
        // The stub models a real fetch: it rejects when the request is
        // aborted, which is exactly the signal a bound request sends. A stub
        // that ignored the signal could not tell a bounded call from a hang.
        const hungFetch = vi.fn((_url: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));
        vi.stubGlobal('fetch', hungFetch);

        function Probe() { api = useOrders(true, false, () => undefined); return null; }
        await act(async () => { root.render(createElement(Probe)); });

        vi.useFakeTimers();
        try {
            let outcome: any = null;
            act(() => {
                void api.addOrder(CLIENT_ORDER).then(
                    () => { outcome = 'resolved'; },
                    (err: unknown) => { outcome = err; },
                );
            });
            // The request carries the bound, and nothing has settled it yet.
            expect(hungFetch.mock.calls[0][1]?.signal).toBeTruthy();
            expect(outcome).toBeNull();

            await act(async () => {
                vi.advanceTimersByTime(ORDER_WRITE_TIMEOUT_MS + 1);
                for (let i = 0; i < 4; i++) await Promise.resolve();
            });

            expect(outcome).toBeInstanceOf(Error);
            expect(String(outcome.message)).toMatch(/no answer from the order service/i);
        } finally {
            vi.useRealTimers();
        }
    });

    it('a real network failure is surfaced unchanged, not relabelled as a timeout', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

        await expect(driveAddOrder()).rejects.toThrow('Failed to fetch');
    });

    it('MISSING_RECORDED_ROW_FAILS_CLOSED: a success with no recorded row is an error, not the estimate', async () => {
        // The server answered 200 but carried no row. Resolving the object we
        // handed over would put the client's coupon-blind $45 estimate back in
        // front of the customer and in lifetime spend — the exact defect this
        // file exists to catch — so the provider must reject instead.
        const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
        vi.stubGlobal('fetch', fetchFn);

        await expect(driveAddOrder()).rejects.toThrow(/no recorded order/i);
        // The handed-over object is not kept either — it is the estimate.
        expect(api.orders.some((o: any) => o.id === CLIENT_ORDER.id)).toBe(false);
        expect(updateLifetimeStats).not.toHaveBeenCalled();

        // An unreadable body is the same failure, not a silent fallback.
        fetchFn.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('Unexpected end of JSON input'); } });
        await expect(driveAddOrder()).rejects.toThrow(/no recorded order/i);
    });
});
