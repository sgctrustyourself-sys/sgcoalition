import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
vi.mock('react-router-dom', () => ({ Link: ({ children }: any) => children, useSearchParams: vi.fn() }));
vi.mock('lucide-react', () => { const Icon = () => null; return { CheckCircle: Icon, Package: Icon, Hexagon: Icon, Home: Icon, Loader: Icon, Copy: Icon, Check: Icon, Users: Icon }; });
vi.mock('../utils/walletAddOns', () => ({ getCartItemUnitPrice: (i: any) => i.price, getCartItemLineTotal: (i: any) => i.price * i.quantity, WALLET_KEYCHAIN_CLIP_LABEL: 'Keychain clip' }));
vi.mock('../utils/referralSystem', () => ({ getReferralStats: vi.fn(), generateReferralLink: vi.fn() }));
vi.mock('../utils/referralAnalytics', () => ({ trackReferralShare: vi.fn() }));

import { useApp } from '../context/AppContext';
import { useSearchParams } from 'react-router-dom';
import OrderSuccess from '../pages/OrderSuccess';

const STATE_KEY = 'coalition_checkout_state';
const item = { id: 'prod-tee', name: 'Coalition Classic Tee', price: 45, images: ['/tee.jpg'], selectedSize: 'M', quantity: 1, keychainClipOn: false };
const savedOrder = () => ({ id: 'order-3ds-1', order_number: 'ORD-3DS-0001', user_id: null, items: [{ productId: 'prod-tee', productName: 'Coalition Classic Tee', productImage: '/tee.jpg', selectedSize: 'M', quantity: 1, price: 45 }], total: 45, sg_coin_reward: 4, payment_status: 'paid', customer_email: 'guest@example.com', customer_name: 'Guest Buyer', shipping_address: { address1: '1 Coalition Way', city: 'Baltimore', state: 'MD', zip: '21201', country: 'US', shippingMethod: 'standard', shippingCost: 0 }, created_at: '2026-08-04T19:00:00.000Z', paid_at: '2026-08-04T19:00:01.000Z' });
const recordedFallbackOrder = () => ({
  id: 'order-recorded-1', orderNumber: 'ORD-RECORDED-1', userId: null, isGuest: true,
  customerName: 'Guest Buyer', customerEmail: 'guest@example.com', total: 0,
  items: [{ productId: 'prod-tee', productName: 'Coalition Classic Tee', productImage: '/tee.jpg', image: '/tee.jpg', name: 'Coalition Classic Tee', selectedSize: 'M', size: 'M', quantity: 1, price: 45, total: 45 }],
  shippingAddress: { address1: '1 Coalition Way', city: 'Baltimore', state: 'MD', zip: '21201', country: 'US', shippingMethod: 'standard', shippingCost: 0 },
  sgCoinReward: 4, paymentMethod: 'store_credit', paymentStatus: 'paid', createdAt: '2026-08-04T19:00:00.000Z', paidAt: '2026-08-04T19:00:01.000Z',
});

describe('OrderSuccess Stripe redirect-return recovery', () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('payment_intent=pi_3ds_123&redirect_status=succeeded'), vi.fn()] as any);
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); if (container.parentNode) container.parentNode.removeChild(container); vi.restoreAllMocks(); });
  it('fallback uses the recorded order rather than writing a local estimate', async () => {
    const clearCart = vi.fn();
    const addOrder = vi.fn().mockResolvedValue(recordedFallbackOrder());
    const fetchFn = vi.fn();
    vi.stubGlobal('fetch', fetchFn);
    sessionStorage.setItem('shippingInfo', JSON.stringify({ name: 'Guest Buyer', email: 'guest@example.com', address1: '1 Coalition Way', city: 'Baltimore', state: 'MD', zip: '21201', country: 'US' }));
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('payment_method=store_credit'), vi.fn()] as any);
    vi.mocked(useApp).mockReturnValue({ cart: [item], cartTotal: () => 45, calculateReward: (n: number) => Math.floor(n / 10), clearCart, addOrder, user: null, updateUser: vi.fn() } as any);

    await act(async () => { root.render(createElement(OrderSuccess)); for (let i = 0; i < 8; i++) await Promise.resolve(); });

    expect(addOrder).toHaveBeenCalledTimes(1);
    expect(addOrder.mock.calls[0][0]).toEqual(expect.objectContaining({ total: 45, paymentMethod: 'store_credit' }));
    const label = [...container.querySelectorAll('p')].find(p => (p.textContent || '').trim() === 'Order Total');
    expect(label?.nextElementSibling?.textContent).toBe('$0.00');
    expect(localStorage.getItem('orders')).toBeNull();
    expect(fetchFn).not.toHaveBeenCalledWith('/api/send-order-confirmation', expect.anything());
    expect(clearCart).toHaveBeenCalledTimes(1);
  });

  it('completes once and clears cart plus persisted checkout state', async () => {
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ shippingInfo: { name: 'Guest Buyer', email: 'guest@example.com', address1: '1 Coalition Way', city: 'Baltimore', state: 'MD', zip: '21201', country: 'US' }, shippingMethod: 'standard', shippingCost: 0, orderSeed: { orderId: 'order-3ds-1', orderNumber: 'ORD-3DS-0001' }, storeCreditApplied: 5, couponCode: 'SAVE10' }));
    const clearCart = vi.fn(); const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => savedOrder() }); vi.stubGlobal('fetch', fetchFn);
    vi.mocked(useApp).mockReturnValue({ cart: [item], cartTotal: () => 45, calculateReward: (n: number) => Math.floor(n / 10), clearCart, user: null, updateUser: vi.fn(), addOrder: vi.fn() } as any);
    await act(async () => { root.render(createElement(StrictMode, null, createElement(OrderSuccess))); for (let i = 0; i < 8; i++) await Promise.resolve(); });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('/api/complete-order', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }));
    const request = JSON.parse(String(fetchFn.mock.calls[0][1]?.body));
    expect(request.order).toEqual(expect.objectContaining({
      id: 'order-3ds-1', orderNumber: 'ORD-3DS-0001', paymentMethod: 'stripe', paymentStatus: 'paid',
      paymentReference: 'pi_3ds_123', customerEmail: 'guest@example.com', guestEmail: 'guest@example.com',
      isGuest: true, total: 45,
      // The credit + coupon the Stripe intent priced MUST reach the server
      // so the re-pricing matches the charged PaymentIntent exactly.
      storeCreditApplied: 5, couponCode: 'SAVE10',
      shippingAddress: expect.objectContaining({ address1: '1 Coalition Way', city: 'Baltimore', state: 'MD', zip: '21201', shippingMethod: 'standard', shippingCost: 0 }),
    }));
    expect(request.order.items).toEqual([expect.objectContaining({ productId: 'prod-tee', selectedSize: 'M', quantity: 1, price: 45 })]);
    expect(clearCart).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(STATE_KEY)).toBeNull(); expect(container.textContent).toContain('Order Confirmed!');
  });

  it('cleans corrupt recovery storage without aborting the empty-cart path', async () => {
    sessionStorage.setItem(STATE_KEY, '{checkout-state-not-json');
    sessionStorage.setItem('shippingInfo', '{not-json');
    sessionStorage.setItem('pendingOrder', '{also-not-json');
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('payment_method=store_credit'), vi.fn()] as any);
    vi.mocked(useApp).mockReturnValue({
      cart: [], cartTotal: () => 0, calculateReward: () => 0,
      clearCart: vi.fn(), user: null, updateUser: vi.fn(), addOrder: vi.fn(),
    } as any);

    await act(async () => {
      root.render(createElement(OrderSuccess));
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });

    expect(sessionStorage.getItem(STATE_KEY)).toBeNull();
    expect(sessionStorage.getItem('shippingInfo')).toBeNull();
    expect(sessionStorage.getItem('pendingOrder')).toBeNull();
    expect(container.textContent).toContain('No Order Found');
  });
});
