// context/useOrders.ts
// Domain hook for Orders — single owner of fetch, admin-API bypass,
// optimistic mutations, realtime sync, and customer-lifetime stats.

import { useState, useEffect, useCallback } from 'react';
import { Order, OrderItem, OrderStatus } from '../types';
import { INITIAL_ORDERS } from '../constants';
import { supabase } from '../services/supabase';
import { getAdminAuthHeaders } from '../services/adminSession';
import { WALLET_KEYCHAIN_CLIP_LABEL, WALLET_KEYCHAIN_CLIP_PRICE } from '../utils/walletAddOns';
import { updateLifetimeStats } from '../utils/customerProfile';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

/** An item row as stored (snake_case) or as sent by the client (camelCase). */
interface OrderItemRow {
    productId?: string; product_id?: string; id?: string;
    productName?: string; name?: string; title?: string;
    productImage?: string; image?: string; thumbnail?: string; productImageUrl?: string;
    selectedSize?: string; size?: string;
    quantity?: number | string; qty?: number | string;
    price?: number | string; unit_price?: number | string;
    total?: number | string; line_total?: number | string;
    basePrice?: number | string; base_price?: number | string;
    addOnPrice?: number | string; add_on_price?: number | string;
    keychainClipOn?: boolean; keychain_clip_on?: boolean;
    addOnLabel?: string; add_on_label?: string;
}

/** Display shape: rows can carry an `image` the OrderItem type does not model. */
type DisplayOrderItem = OrderItem & { image?: string };

/** An order row as stored (snake_case) or as sent by the client (camelCase). */
interface OrderRow {
    id?: string;
    order_number?: string; orderNumber?: string;
    user_id?: string | null; userId?: string | null;
    is_guest?: boolean; isGuest?: boolean;
    customer_name?: string; customerName?: string;
    customer_email?: string; customerEmail?: string;
    customer_phone?: string; customerPhone?: string;
    items?: OrderItemRow[]; line_items?: OrderItemRow[];
    subtotal?: number | string; sub_total?: number | string;
    tax?: number | string; discount?: number | string;
    total?: number | string; total_amount?: number | string;
    payment_method?: string; paymentMethod?: string;
    payment_status?: string; paymentStatus?: string; status?: string;
    order_type?: string; orderType?: string;
    shipping_address?: Order['shippingAddress'] | null;
    shipping_info?: Order['shippingAddress'] | null;
    shippingInfo?: Order['shippingAddress'] | null;
    shippingAddress?: Order['shippingAddress'] | null;
    notes?: string;
    created_at?: string; createdAt?: string;
    paid_at?: string | null; paidAt?: string | null;
    sg_coin_reward?: number; sgCoinReward?: number;
    paid_amount?: number | string | null; paidAmount?: number | string | null;
    balance_due?: number | string | null; balanceDue?: number | string | null;
}

// The orders table stores no product image (acceptCheckout writes
// productImage: ''), so a recorded order is merged with the order the client
// built for display only: every money field stays the record's.
function withLocalItemImages(recorded: Order, local: Order): Order {
    return {
        ...recorded,
        items: recorded.items.map((item: DisplayOrderItem, index: number) => {
            const mine = local.items[index] as DisplayOrderItem | undefined;
            if (!mine) return item;
            return { ...item, image: item.image || mine.image || '', productImage: item.productImage || mine.productImage || '' };
        }),
    };
}

export function useOrders(
    isSupabaseConfigured: boolean,
    isAdminMode: boolean,
    addToast: (msg: string, type: 'success' | 'error' | 'info') => void,
) {
    const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);

    // Row -> Order mapping — the single owner, shared by the fetch path and the
    // create path. addOrder needs it because the order the app shows (and the
    // lifetime stats it derives) must be the RECORDED order: the client's own
    // object still carries the pre-coupon estimate, so a comped order would read
    // full price on the confirmation page.
    const mapOrderRows = useCallback((data: unknown): Order[] => (Array.isArray(data) ? data : []).map((o: OrderRow) => {
            const items = Array.isArray(o.items) ? o.items : Array.isArray(o.line_items) ? o.line_items : [];
            const normalizedItems = items.map((item, index) => {
                const quantity = Math.max(1, Number(item.quantity || item.qty || 1));
                const keychainClipOn = Boolean(item.keychainClipOn ?? item.keychain_clip_on);
                const basePrice = Number(item.basePrice || item.base_price || item.unit_price || item.price || 0);
                const addOnPrice = Number(item.addOnPrice || item.add_on_price || 0) || (keychainClipOn ? WALLET_KEYCHAIN_CLIP_PRICE : 0);
                const price = Number(item.price || item.unit_price || (basePrice + addOnPrice) || 0);
                const total = Number(item.total || item.line_total || price * quantity || 0);
                return {
                    productId: item.productId || item.product_id || item.id || ('item_' + index),
                    productName: item.productName || item.name || item.title || 'Product',
                    productImage: item.productImage || item.image || item.thumbnail || item.productImageUrl || '',
                    selectedSize: item.selectedSize || item.size || 'One Size',
                    quantity, price, total, basePrice, addOnPrice, keychainClipOn,
                    addOnLabel: item.addOnLabel || item.add_on_label || (keychainClipOn ? WALLET_KEYCHAIN_CLIP_LABEL : undefined),
                    name: item.name || item.productName || 'Product',
                    image: item.image || item.productImage || item.thumbnail || '',
                    size: item.size || item.selectedSize || 'One Size'
                };
            });
            return {
                id: o.id || Math.random().toString(36).substr(2, 9),
                orderNumber: o.order_number || o.orderNumber || 'ORD-UNKNOWN',
                userId: o.user_id || o.userId || undefined, isGuest: o.is_guest ?? o.isGuest ?? true,
                customerName: o.customer_name || o.customerName || 'Anonymous',
                customerEmail: o.customer_email || o.customerEmail || '',
                customerPhone: o.customer_phone || o.customerPhone || '',
                items: normalizedItems,
                subtotal: Number(o.subtotal || o.sub_total || 0),
                tax: Number(o.tax || 0), discount: Number(o.discount || 0),
                total: Number(o.total || o.total_amount || 0),
                paymentMethod: o.payment_method || o.paymentMethod || 'unknown',
                paymentStatus: (o.payment_status || o.paymentStatus || o.status || 'pending') as OrderStatus,
                orderType: (o.order_type || o.orderType || 'online') as Order['orderType'],
                shippingAddress: o.shipping_address || o.shipping_info || o.shippingInfo || o.shippingAddress || undefined,
                notes: o.notes || '',
                createdAt: o.created_at || o.createdAt || new Date().toISOString(),
                paidAt: o.paid_at || o.paidAt || undefined,
                sgCoinReward: Number(o.sg_coin_reward || o.sgCoinReward || 0),
                paidAmount: o.paid_amount != null ? Number(o.paid_amount) : (o.paidAmount != null ? Number(o.paidAmount) : undefined),
                balanceDue: o.balance_due != null ? Number(o.balance_due) : (o.balanceDue != null ? Number(o.balanceDue) : undefined)
            };
    }), []);

    const mapAndSetOrders = useCallback((data: unknown) => {
        if (!data || !Array.isArray(data)) return orders;
        const mapped = mapOrderRows(data);
        setOrders(mapped);
        return mapped;
    }, [mapOrderRows, orders]);

    const fetchOrdersViaApi = useCallback(async () => {
        try {
            console.log('🚀 Calling admin API bypass for orders...');
            const response = await fetch('/api/complete-order', { method: 'GET', headers: getAdminAuthHeaders() });
            if (!response.ok) throw new Error('API bypass failed: ' + response.statusText);
            const data = await response.json();
            console.log('✅ API bypass fetched ' + (data?.length || 0) + ' orders');
            if (data && Array.isArray(data)) return mapAndSetOrders(data);
            return orders;
        } catch (err) { console.error('❌ API bypass error:', err); return orders; }
    }, [mapAndSetOrders]);

    const fetchOrders = useCallback(async () => {
        if (!isSupabaseConfigured) return INITIAL_ORDERS;
        if (isAdminMode) return await fetchOrdersViaApi();
        try {
            console.log('🔄 Fetching orders from Supabase...');
            const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (data) return mapAndSetOrders(data);
            return [];
        } catch (err) { console.error('Error fetching orders:', err); return orders; }
    }, [isSupabaseConfigured, isAdminMode, fetchOrdersViaApi, mapAndSetOrders]);

    // Realtime orders channel
    useEffect(() => {
        if (!isSupabaseConfigured) return;
        const channel = supabase.channel('orders_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                console.log('🔂 Order change detected, refreshing...');
                fetchOrders();
            }).subscribe();
        return () => { channel.unsubscribe(); };
    }, [isSupabaseConfigured, fetchOrders]);

    // Resolves to the order the SERVER recorded, not the object it was handed.
    // The server re-prices every order from the catalog (coupon, set bonus,
    // crypto discount, store credit) and answers with the stored row, so the
    // caller must display and derive from that row: a coupon-comped order's
    // client object is the pre-coupon estimate, i.e. money nobody paid.
    const addOrder = useCallback(async (order: Order): Promise<Order> => {
        if (isSupabaseConfigured) {
            try {
                // Bounded on purpose: the caller's pay button stays disabled
                // until this settles, so a request that never answers used to
                // hold the shopper on a dead control. The timeout turns that
                // into the Error below, and the order's attempt id makes the
                // retry resolve to the recorded order rather than a second one.
                const response = await fetchWithTimeout('/api/complete-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error || 'Order completion failed');
                }
                const saved = await response.json().catch(() => null);
                // The server is the only writer of an order. A success with no
                // recorded row means none was written (or the answer was
                // unreadable), and the object we were handed is the client's
                // coupon-blind estimate: resolving it would show a price nobody
                // paid and count that estimate as customer spend.
                if (!saved || (!saved.id && !saved.order_number)) {
                    throw new Error('Order completion returned no recorded order');
                }
                const recorded = withLocalItemImages(mapOrderRows([saved])[0], order);
                setOrders(prev => [recorded, ...prev.filter(existing => existing.id !== order.id && existing.id !== recorded.id)]);
                fetchOrders();
                if (recorded.userId && !recorded.userId.startsWith('user_eth_')) {
                    void updateLifetimeStats(recorded.userId, recorded.total);
                }
                return recorded;
            } catch (err) { console.error('Order failed:', err); throw err; }
        }
        setOrders(prev => [order, ...prev]);
        return order;
    }, [isSupabaseConfigured, fetchOrders, mapOrderRows]);

    const updateOrderStatus = useCallback(async (orderId: string, newStatus: string) => {
        const originalStatus = orders.find(o => o.id === orderId)?.paymentStatus;
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: newStatus as OrderStatus } : o));
        if (isSupabaseConfigured) {
            try {
                const response = await fetch('/api/complete-order', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', ...getAdminAuthHeaders() },
                    body: JSON.stringify({ id: orderId, updates: { payment_status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : null } })
                });
                if (!response.ok) throw new Error('Status update failed');
                addToast('Order status updated!', 'success');
            } catch (err) {
                console.error('Update status failed:', err);
                if (originalStatus) {
                    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: originalStatus } : o));
                }
                addToast('Failed to update status.', 'error');
            }
        }
    }, [orders, isSupabaseConfigured, addToast]);

    const deleteOrder = useCallback(async (id: string) => {
        try {
            setOrders(prev => prev.filter(o => o.id !== id));
            if (isSupabaseConfigured) await supabase.from('orders').delete().eq('id', id);
        } catch (e) { console.error('Delete order failed:', e); }
    }, [isSupabaseConfigured]);

    const getOrderById = useCallback((id: string) => orders.find(o => o.id === id), [orders]);
    const generateOrderNumber = useCallback(() => 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase(), []);

    return { orders, fetchOrders, addOrder, updateOrderStatus, deleteOrder, getOrderById, generateOrderNumber };
}
