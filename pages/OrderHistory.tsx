import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Package, Calendar, DollarSign, ChevronRight } from 'lucide-react';

const OrderHistory = () => {
    const { orders, products } = useApp();
    const navigate = useNavigate();
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const filteredOrders = orders.filter(order => {
        if (filterStatus === 'all') return true;
        return order.status === filterStatus;
    });

    const getProductDetails = (productId: string) => {
        return products.find(p => p.id === productId);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'processing': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            case 'shipped': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
            case 'delivered': return 'text-green-500 bg-green-500/10 border-green-500/20';
            case 'cancelled': return 'text-red-500 bg-red-500/10 border-red-500/20';
            default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold font-display uppercase mb-2">Order History</h1>
                <p className="text-gray-400">View and track all your orders</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto">
                {['all', 'pending', 'processing', 'shipped', 'delivered', 'cancelled'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm uppercase whitespace-nowrap transition ${filterStatus === status
                                ? 'bg-white text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/50 rounded-xl border border-white/10 border-dashed">
                    <Package className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                    <h2 className="text-xl font-bold mb-2">No orders found</h2>
                    <p className="text-gray-400 mb-6">
                        {filterStatus === 'all'
                            ? "You haven't placed any orders yet"
                            : `No ${filterStatus} orders`
                        }
                    </p>
                    <button
                        onClick={() => navigate('/shop')}
                        className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition"
                    >
                        Start Shopping
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredOrders.map(order => (
                        <div key={order.id} className="bg-gray-900 border border-white/10 rounded-xl p-6 hover:border-white/20 transition">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-bold text-lg">Order #{order.id.slice(-8).toUpperCase()}</h3>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-4 h-4" />
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Package className="w-4 h-4" />
                                            {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-400 mb-1">Total</p>
                                    <p className="text-2xl font-bold">${order.total.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Order Items */}
                            <div className="space-y-3 mb-4">
                                {order.items.map((item, index) => {
                                    const product = getProductDetails(item.productId);
                                    return (
                                        <div key={index} className="flex items-center gap-4 bg-black/30 p-3 rounded-lg">
                                            {product && (
                                                <img
                                                    src={product.images[0]}
                                                    alt={product.name}
                                                    className="w-16 h-16 object-cover rounded border border-white/10"
                                                />
                                            )}
                                            <div className="flex-1">
                                                <h4 className="font-bold text-sm">{product?.name || 'Product'}</h4>
                                                <p className="text-xs text-gray-400">
                                                    {item.size && `Size: ${item.size} • `}
                                                    Qty: {item.quantity}
                                                </p>
                                            </div>
                                            <p className="font-bold">${item.price.toFixed(2)}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* View Details Button */}
                            <button
                                onClick={() => navigate(`/order/${order.id}`)}
                                className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-bold text-sm transition"
                            >
                                View Details
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrderHistory;
