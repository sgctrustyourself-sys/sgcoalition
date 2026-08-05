// context/useOrders.ts
// Domain hook for Orders — single owner of fetch, admin-API bypass,
// optimistic mutations, realtime sync, and customer-lifetime stats.

import { useState, useEffect, useCallback } from 'react';
import { Order, OrderStatus } from '../types';
import { INITIAL_ORDERS } from '../constants';
import { supabase } from '../services/supabase';
import { WALLET_KEYCHAIN_CLIP_LABEL, WALLET_KEYCHAIN_CLIP_PRICE } from '../utils/walletAddOns';
import { updateLifetimeStats } from '../utils/customerProfile';

export function useOrders(
    isSupabaseConfigured: boolean,
    isAdminMode: boolean,
    addToast: (msg: string, type: 'success' | 'error' | 'info') => void,
) {
    const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);

    const mapAndSetOrders = useCallback((data: any[]) => {
        if (!data || !Array.isArray(data)) return orders;
        const mapped = data.map((o: any) => {
            const items = Array.isArray(o.items) ? o.items : Array.isArray(o.line_items) ? o.line_items : [];
            const normalizedItems = items.map((item: any, index: number) => {
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
                userId: o.user_id || o.userId || null, isGuest: o.is_guest ?? o.isGuest ?? true,
                customerName: o.customer_name || o.customerName || 'Anonymous',
                customerEmail: o.customer_email || o.customerEmail || '',
                customerPhone: o.customer_phone || o.customerPhone || '',
                items: normalizedItems,
                subtotal: Number(o.subtotal || o.sub_total || 0),
                tax: Number(o.tax || 0), discount: Number(o.discount || 0),
                total: Number(o.total || o.total_amount || 0),
                paymentMethod: o.payment_method || o.paymentMethod || 'unknown',
                paymentStatus: o.payment_status || o.paymentStatus || o.status || 'pending',
                orderType: o.order_type || o.orderType || 'online',
                shippingAddress: o.shipping_address || o.shipping_info || o.shippingInfo || o.shippingAddress || null,
                notes: o.notes || '',
                createdAt: o.created_at || o.createdAt || new Date().toISOString(),
                paidAt: o.paid_at || o.paidAt || null,
                sgCoinReward: Number(o.sg_coin_reward || o.sgCoinReward || 0),
                paidAmount: o.paid_amount != null ? Number(o.paid_amount) : (o.paidAmount != null ? Number(o.paidAmount) : undefined),
                balanceDue: o.balance_due != null ? Number(o.balance_due) : (o.balanceDue != null ? Number(o.balanceDue) : undefined)
            };
        });
        setOrders(mapped);
        return mapped;
    }, []);

    const fetchOrdersViaApi = useCallback(async () => {
        try {
            console.log('🚀 Calling admin API bypass for orders...');
            const token = sessionStorage.getItem('coalition_admin_token');
            const response = await fetch('/api/complete-order', { method: 'GET', headers: { Authorization: 'Bearer ' + token } });
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

    const addOrder = useCallback(async (order: Order, verification?: { paypalOrderId?: string; paypalCaptureId?: string }) => {
        const mustUseOrderApi = order.paymentMethod === 'paypal';
        if (isSupabaseConfigured || mustUseOrderApi) {
            try {
                const response = await fetch('/api/complete-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order, verification }) });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error || 'Order completion failed');
                }
                setOrders(prev => [order, ...prev.filter(existing => existing.id !== order.id)]);
                fetchOrders();
                if (order.userId && !order.userId.startsWith('user_eth_')) {
                    void updateLifetimeStats(order.userId, order.total);
                }
            } catch (err) { console.error('Order failed:', err); throw err; }
            return;
        }
        setOrders(prev => [order, ...prev]);
    }, [isSupabaseConfigured, fetchOrders]);

    const updateOrderStatus = useCallback(async (orderId: string, newStatus: string) => {
        const originalStatus = orders.find(o => o.id === orderId)?.paymentStatus;
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: newStatus as OrderStatus } : o));
        if (isSupabaseConfigured) {
            try {
                const token = sessionStorage.getItem('coalition_admin_token');
                const response = await fetch('/api/complete-order', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
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
