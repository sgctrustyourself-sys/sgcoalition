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

describe('OrderSuccess Stripe redirect-return recovery', () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => {
    vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams('payment_intent=pi_3ds_123&redirect_status=succeeded'), vi.fn()] as any);
    container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); if (container.parentNode) container.parentNode.removeChild(container); vi.restoreAllMocks(); });
  it('completes once and clears cart plus persisted checkout state', async () => {
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ shippingInfo: { name: 'Guest Buyer', email: 'guest@example.com', address1: '1 Coalition Way', city: 'Baltimore', state: 'MD', zip: '21201', country: 'US' }, shippingMethod: 'standard', shippingCost: 0, orderSeed: { orderId: 'order-3ds-1', orderNumber: 'ORD-3DS-0001' } }));
    const clearCart = vi.fn(); const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => savedOrder() }); vi.stubGlobal('fetch', fetchFn);
    vi.mocked(useApp).mockReturnValue({ cart: [item], cartTotal: () => 45, calculateReward: (n: number) => Math.floor(n / 10), clearCart, user: null, updateUser: vi.fn() } as any);
    await act(async () => { root.render(createElement(StrictMode, null, createElement(OrderSuccess))); for (let i = 0; i < 8; i++) await Promise.resolve(); });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('/api/complete-order', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }));
    const request = JSON.parse(String(fetchFn.mock.calls[0][1]?.body));
    expect(request.order).toEqual(expect.objectContaining({
      id: 'order-3ds-1', orderNumber: 'ORD-3DS-0001', paymentMethod: 'stripe', paymentStatus: 'paid',
      paymentReference: 'pi_3ds_123', customerEmail: 'guest@example.com', guestEmail: 'guest@example.com',
      isGuest: true, total: 45,
      shippingAddress: expect.objectContaining({ address1: '1 Coalition Way', city: 'Baltimore', state: 'MD', zip: '21201', shippingMethod: 'standard', shippingCost: 0 }),
    }));
    expect(request.order.items).toEqual([expect.objectContaining({ productId: 'prod-tee', selectedSize: 'M', quantity: 1, price: 45 })]);
    expect(clearCart).toHaveBeenCalledTimes(1); expect(sessionStorage.getItem(STATE_KEY)).toBeNull(); expect(container.textContent).toContain('Order Confirmed!');
  });
});
