import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Package, Calendar, ChevronRight, Clock3, CheckCircle2, Truck, CircleX, RotateCcw, DollarSign, ShoppingBag } from 'lucide-react';
import { OrderStatus } from '../types';
import { getOrderItemAddOnLabel } from '../utils/walletAddOns';

const FILTERS = ['all', 'pending', 'processing', 'paid', 'shipped', 'delivered', 'cancelled', 'failed', 'refunded'] as const;

const OrderHistory = () => {
    const { orders, products, isLoading } = useApp();
    const navigate = useNavigate();
    const [filterStatus, setFilterStatus] = useState<(typeof FILTERS)[number]>('all');

    const filteredOrders = useMemo(() => {
        return orders.filter(order => filterStatus === 'all' || order.paymentStatus === filterStatus);
    }, [orders, filterStatus]);

    const stats = useMemo(() => {
        const totalOrders = orders.length;
        const activeOrders = orders.filter(order => ['pending', 'processing'].includes(order.paymentStatus)).length;
        const completedOrders = orders.filter(order => ['paid', 'delivered'].includes(order.paymentStatus)).length;
        const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);

        return { totalOrders, activeOrders, completedOrders, totalRevenue };
    }, [orders]);

    const getProductDetails = (productId: string) => products.find(p => p.id === productId);

    const getStatusColor = (status: OrderStatus | string) => {
        switch (status) {
            case 'pending':
                return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'processing':
                return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'paid':
                return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20';
            case 'shipped':
                return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
            case 'delivered':
                return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'cancelled':
                return 'text-red-400 bg-red-500/10 border-red-500/20';
            case 'failed':
                return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
            case 'refunded':
                return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
            default:
                return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
        }
    };

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 text-white">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">
                        <ShoppingBag className="h-3 w-3 text-brand-accent" />
                        Order Ledger
                    </div>
                    <h1 className="font-display text-3xl font-black uppercase tracking-tighter md:text-4xl">
                        Order History
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
                        View your recent orders, track their status, and jump into the full receipt when needed.
                    </p>
                </div>

                <button
                    onClick={() => navigate('/shop')}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
                >
                    <Package className="h-4 w-4" />
                    Continue Shopping
                </button>
            </div>

            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Total Orders</p>
                    <p className="mt-3 font-display text-3xl font-black uppercase tracking-tight">{stats.totalOrders}</p>
                    <p className="mt-2 text-xs text-gray-400">All loaded orders in the current session.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Active</p>
                    <p className="mt-3 font-display text-3xl font-black uppercase tracking-tight">{stats.activeOrders}</p>
                    <p className="mt-2 text-xs text-gray-400">Pending or processing orders.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Completed</p>
                    <p className="mt-3 font-display text-3xl font-black uppercase tracking-tight">{stats.completedOrders}</p>
                    <p className="mt-2 text-xs text-gray-400">Paid or delivered orders.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Revenue</p>
                    <p className="mt-3 font-display text-3xl font-black uppercase tracking-tight">${stats.totalRevenue.toFixed(2)}</p>
                    <p className="mt-2 text-xs text-gray-400">Running total of visible orders.</p>
                </div>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
                {FILTERS.map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold uppercase transition ${
                            filterStatus === status
                                ? 'border-white bg-white text-black'
                                : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-gray-400">
                    Loading orders...
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
                    <Package className="mx-auto mb-4 h-16 w-16 text-gray-700" />
                    <h2 className="mb-2 text-xl font-bold">No orders found</h2>
                    <p className="mb-6 text-gray-400">
                        {filterStatus === 'all'
                            ? "You haven't placed any orders yet."
                            : `No ${filterStatus} orders found.`
                        }
                    </p>
                    <button
                        onClick={() => navigate('/shop')}
                        className="rounded-full bg-white px-6 py-3 font-bold uppercase tracking-widest text-black transition hover:bg-gray-200"
                    >
                        Start Shopping
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map(order => {
                        const topItem = order.items[0];
                        const topProduct = topItem ? getProductDetails(topItem.productId) : null;

                        return (
                            <div key={order.id} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:border-white/20">
                                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h3 className="text-lg font-bold text-white">
                                                Order #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                                            </h3>
                                            <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${getStatusColor(order.paymentStatus)}`}>
                                                {order.paymentStatus}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gray-300">
                                                {order.orderType}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4" />
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Package className="h-4 w-4" />
                                                {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <DollarSign className="h-4 w-4" />
                                                {order.paymentMethod}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-left md:text-right">
                                        <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">Total</p>
                                        <p className="font-display text-3xl font-black uppercase tracking-tight">
                                            ${order.total.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mb-5 space-y-3">
                                    {order.items.map((item, index) => (
                                        <div key={`${item.productId}-${index}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
                                                <img
                                                    src={item.productImage || topProduct?.images?.[0] || ''}
                                                    alt={item.productName}
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="truncate text-sm font-bold text-white">
                                                    {item.productName || topProduct?.name || 'Product'}
                                                </h4>
                                                <p className="text-xs text-gray-400">
                                                    Size: {item.selectedSize}
                                                    {getOrderItemAddOnLabel(item) ? ` • ${getOrderItemAddOnLabel(item)}` : ''}
                                                    {' • '}Qty: {item.quantity}
                                                </p>
                                            </div>
                                            <p className="shrink-0 font-bold text-white">
                                                ${item.total.toFixed(2)}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-3 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between">
                                    <p className="text-xs uppercase tracking-widest text-gray-500">
                                        Paid at {order.paidAt ? new Date(order.paidAt).toLocaleString() : 'Pending'}
                                    </p>
                                    <button
                                        onClick={() => navigate(`/order/${order.id}`)}
                                        className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:border-purple-500/40 hover:bg-purple-500/10"
                                    >
                                        View Details
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default OrderHistory;
