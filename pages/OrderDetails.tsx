import React, { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Calendar, Package, CreditCard, MapPin, Truck, Clock3, AlertTriangle, ShoppingBag } from 'lucide-react';

const OrderDetails = () => {
    const { orderId } = useParams<{ orderId: string }>();
    const navigate = useNavigate();
    const { orders, products, user, isLoading } = useApp();

    const order = useMemo(() => orders.find(item => item.id === orderId), [orders, orderId]);

    const canViewPrivateDetails = !!order && (
        user?.isAdmin ||
        (user?.uid && order.userId === user.uid) ||
        (user?.email && order.customerEmail === user.email)
    );

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pending':
                return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300';
            case 'processing':
                return 'border-blue-500/20 bg-blue-500/10 text-blue-300';
            case 'paid':
                return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300';
            case 'shipped':
                return 'border-purple-500/20 bg-purple-500/10 text-purple-300';
            case 'delivered':
                return 'border-green-500/20 bg-green-500/10 text-green-300';
            case 'cancelled':
                return 'border-red-500/20 bg-red-500/10 text-red-300';
            case 'failed':
                return 'border-orange-500/20 bg-orange-500/10 text-orange-300';
            case 'refunded':
                return 'border-pink-500/20 bg-pink-500/10 text-pink-300';
            default:
                return 'border-white/10 bg-white/5 text-gray-300';
        }
    };

    const getProduct = (productId: string) => products.find(product => product.id === productId);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black px-4 py-12 text-white">
                <div className="mx-auto flex max-w-4xl items-center justify-center py-32 text-gray-400">
                    Loading order details...
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-black px-4 py-12 text-white">
                <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-sm">
                    <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-amber-400" />
                    <h1 className="font-display text-3xl font-black uppercase tracking-tighter">Order not found</h1>
                    <p className="mt-3 text-sm text-gray-400">
                        We could not find that order in the current session.
                    </p>
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                        <button
                            onClick={() => navigate('/order-history')}
                            className="rounded-full bg-white px-6 py-3 text-sm font-bold uppercase tracking-widest text-black transition hover:bg-gray-200"
                        >
                            Back to History
                        </button>
                        <Link
                            to="/shop"
                            className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
                        >
                            Continue Shopping
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black px-4 py-12 text-white">
            <div className="mx-auto max-w-6xl">
                <button
                    onClick={() => navigate('/order-history')}
                    className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to History
                </button>

                <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">
                            <ShoppingBag className="h-3 w-3 text-brand-accent" />
                            Order Receipt
                        </div>
                        <h1 className="font-display text-4xl font-black uppercase tracking-tighter md:text-5xl">
                            Order #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                        </h1>
                        <p className="mt-3 text-sm text-gray-400">
                            Placed on {new Date(order.createdAt).toLocaleString()}.
                        </p>
                    </div>

                    <span className={`inline-flex items-center rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-widest ${getStatusStyle(order.paymentStatus)}`}>
                        {order.paymentStatus}
                    </span>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Total</p>
                                <p className="mt-3 font-display text-3xl font-black uppercase tracking-tight">${order.total.toFixed(2)}</p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Payment</p>
                                <p className="mt-3 font-display text-2xl font-black uppercase tracking-tight">{order.paymentMethod}</p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Type</p>
                                <p className="mt-3 font-display text-2xl font-black uppercase tracking-tight">{order.orderType}</p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Items</p>
                                <p className="mt-3 font-display text-2xl font-black uppercase tracking-tight">{order.items.length}</p>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                            <div className="mb-5 flex items-center gap-2">
                                <Package className="h-5 w-5 text-purple-400" />
                                <h2 className="text-xl font-bold uppercase tracking-tight">Items</h2>
                            </div>

                            <div className="space-y-3">
                                {order.items.map((item) => {
                                    const product = getProduct(item.productId);

                                    return (
                                        <div key={`${item.productId}-${item.selectedSize}`} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/30 p-3">
                                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
                                                <img
                                                    src={item.productImage || product?.images?.[0] || ''}
                                                    alt={item.productName}
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="truncate font-bold text-white">
                                                    {item.productName || product?.name || 'Product'}
                                                </h3>
                                                <p className="mt-1 text-xs text-gray-400">
                                                    Size: {item.selectedSize} • Qty: {item.quantity}
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="font-bold text-white">${item.total.toFixed(2)}</p>
                                                <p className="text-xs text-gray-500">${item.price.toFixed(2)} each</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                            <div className="mb-5 flex items-center gap-2">
                                <Clock3 className="h-5 w-5 text-emerald-400" />
                                <h2 className="text-xl font-bold uppercase tracking-tight">Timeline</h2>
                            </div>

                            <div className="space-y-4 text-sm">
                                <div className="flex items-start gap-3">
                                    <Calendar className="mt-0.5 h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="font-bold text-white">Created</p>
                                        <p className="text-gray-400">{new Date(order.createdAt).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CreditCard className="mt-0.5 h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="font-bold text-white">Payment status</p>
                                        <p className="text-gray-400 capitalize">{order.paymentStatus}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Truck className="mt-0.5 h-4 w-4 text-gray-500" />
                                    <div>
                                        <p className="font-bold text-white">Shipment</p>
                                        <p className="text-gray-400">
                                            {order.paymentStatus === 'delivered'
                                                ? 'Delivered'
                                                : order.paymentStatus === 'shipped'
                                                    ? 'In transit'
                                                    : order.paymentStatus === 'processing'
                                                        ? 'Preparing for shipment'
                                                        : 'Awaiting fulfillment'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                            <div className="mb-5 flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-sky-400" />
                                <h2 className="text-xl font-bold uppercase tracking-tight">Shipping</h2>
                            </div>

                            {canViewPrivateDetails && order.shippingAddress ? (
                                <div className="space-y-2 text-sm text-gray-300">
                                    <p className="font-bold text-white">{order.customerName}</p>
                                    <p>{order.customerEmail}</p>
                                    <p>{order.shippingAddress.address1}</p>
                                    <p>
                                        {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}
                                    </p>
                                    <p>{order.shippingAddress.country}</p>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">
                                    Shipping details are hidden for privacy unless you are the account owner or an admin.
                                </p>
                            )}
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                            <div className="mb-5 flex items-center gap-2">
                                <RotateCcw className="h-5 w-5 text-purple-400" />
                                <h2 className="text-xl font-bold uppercase tracking-tight">Next step</h2>
                            </div>
                            <p className="text-sm leading-relaxed text-gray-400">
                                Need a new drop? Head back to the shop or review your current items in history.
                            </p>
                            <div className="mt-5 flex gap-3">
                                <Link
                                    to="/shop"
                                    className="rounded-full bg-white px-5 py-3 text-xs font-bold uppercase tracking-widest text-black transition hover:bg-gray-200"
                                >
                                    Shop Now
                                </Link>
                                <button
                                    onClick={() => navigate('/order-history')}
                                    className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
                                >
                                    Back to History
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderDetails;
