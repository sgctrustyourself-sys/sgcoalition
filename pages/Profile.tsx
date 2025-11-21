import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Hexagon, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';

interface Order {
    id: string;
    items: any[];
    total: number;
    status: string;
    shippingStatus: string;
    trackingNumber: string | null;
    createdAt: string;
    paymentMethod: string;
}

const Profile = () => {
    const { user, products } = useApp();
    const [orders, setOrders] = useState<Order[]>([]);
    const [activeTab, setActiveTab] = useState<'favorites' | 'orders'>('orders');

    useEffect(() => {
        // Load orders from localStorage
        const savedOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        // Filter orders for current user if logged in
        const userOrders = user?.uid
            ? savedOrders.filter((o: Order) => o.userId === user.uid)
            : savedOrders;
        setOrders(userOrders.reverse()); // Show newest first
    }, [user]);

    if (!user) return <Navigate to="/" />;

    const favorites = products.filter(p => user.favorites.includes(p.id));

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'processing':
                return <Clock className="w-5 h-5 text-yellow-600" />;
            case 'shipped':
                return <Truck className="w-5 h-5 text-blue-600" />;
            case 'delivered':
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            default:
                return <Package className="w-5 h-5 text-gray-600" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'processing':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'shipped':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'delivered':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'pending_verification':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Profile Header */}
            <div className="bg-black text-white rounded-2xl p-8 md:p-12 mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="font-display text-3xl md:text-4xl font-bold uppercase mb-2">
                            Welcome back, {user.displayName || 'Member'}
                        </h1>
                        <p className="text-gray-400 font-mono text-sm">
                            {user.walletAddress ? user.walletAddress : user.email}
                        </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/10 min-w-[250px]">
                        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">SGCoin Balance</div>
                        <div className="text-4xl font-bold text-brand-accent flex items-center">
                            <Hexagon className="w-8 h-8 mr-3 fill-current" />
                            {user.sgCoinBalance.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400 mt-2">
                            Current Value: ${(user.sgCoinBalance * 0.002).toFixed(2)} USD
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-8 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('orders')}
                    className={`pb-4 px-2 font-bold uppercase tracking-wide transition border-b-2 ${activeTab === 'orders'
                            ? 'border-black text-black'
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <Package className="w-5 h-5 inline mr-2" />
                    Orders ({orders.length})
                </button>
                <button
                    onClick={() => setActiveTab('favorites')}
                    className={`pb-4 px-2 font-bold uppercase tracking-wide transition border-b-2 ${activeTab === 'favorites'
                            ? 'border-black text-black'
                            : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    ❤️ Favorites ({favorites.length})
                </button>
            </div>

            {/* Orders Tab */}
            {activeTab === 'orders' && (
                <div>
                    <h2 className="font-display text-2xl font-bold uppercase mb-6">Your Orders</h2>
                    {orders.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 mb-4">No orders yet</p>
                            <a
                                href="/#/shop"
                                className="inline-block bg-black text-white px-6 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition"
                            >
                                Start Shopping
                            </a>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {orders.map((order) => (
                                <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    {/* Order Header */}
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                                    Order Number
                                                </p>
                                                <p className="font-mono text-sm font-bold">{order.id}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                    })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                                        Total
                                                    </p>
                                                    <p className="text-xl font-bold">${order.total.toFixed(2)}</p>
                                                </div>
                                                <div className={`flex items-center gap-2 px-3 py-2 rounded-full border ${getStatusColor(order.shippingStatus)}`}>
                                                    {getStatusIcon(order.shippingStatus)}
                                                    <span className="text-sm font-medium capitalize">
                                                        {order.shippingStatus.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order Items */}
                                    <div className="px-6 py-4">
                                        <div className="space-y-3">
                                            {order.items.map((item: any, index: number) => (
                                                <div key={index} className="flex items-center gap-4">
                                                    <img
                                                        src={item.image}
                                                        alt={item.name}
                                                        className="w-16 h-16 object-cover rounded bg-gray-100"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="font-medium">{item.name}</p>
                                                        <p className="text-sm text-gray-500">
                                                            Size: {item.size} • Qty: {item.quantity}
                                                        </p>
                                                    </div>
                                                    <p className="font-bold">${item.price.toFixed(2)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tracking Info */}
                                    {order.trackingNumber && (
                                        <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
                                            <div className="flex items-center gap-3">
                                                <Truck className="w-5 h-5 text-blue-600" />
                                                <div>
                                                    <p className="text-sm font-medium text-blue-900">
                                                        Tracking Number
                                                    </p>
                                                    <p className="text-sm font-mono text-blue-700">
                                                        {order.trackingNumber}
                                                    </p>
                                                </div>
                                                <a
                                                    href={`https://www.ups.com/track?tracknum=${order.trackingNumber}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ml-auto text-sm font-bold text-blue-600 hover:text-blue-800 underline"
                                                >
                                                    Track Package →
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payment Method */}
                                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                                        <p className="text-xs text-gray-500">
                                            Payment: {order.paymentMethod === 'crypto' ? '🔗 Cryptocurrency' : '💳 Card'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Favorites Tab */}
            {activeTab === 'favorites' && (
                <div>
                    <h2 className="font-display text-2xl font-bold uppercase mb-6">Your Favorites</h2>
                    {favorites.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <p className="text-gray-500 mb-4">No favorites yet. Go shop!</p>
                            <a
                                href="/#/shop"
                                className="inline-block bg-black text-white px-6 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition"
                            >
                                Browse Products
                            </a>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {favorites.map(p => <ProductCard key={p.id} product={p} />)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Profile;
