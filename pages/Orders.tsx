import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Order, OrderStatus } from '../types';
import { Download, Search, Filter, Eye, Edit2, Trash2, FileText, Plus } from 'lucide-react';
import ManualOrderForm from '../components/ManualOrderForm';
import Invoice from '../components/Invoice';

export const Orders: React.FC = () => {
    const { orders, deleteOrder } = useApp();
    const { addToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showManualOrderForm, setShowManualOrderForm] = useState(false);
    const [showInvoice, setShowInvoice] = useState<Order | null>(null);

    // Filter and search orders
    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const matchesSearch =
                order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = filterStatus === 'all' || order.paymentStatus === filterStatus;
            const matchesType = filterType === 'all' || order.orderType === filterType;

            return matchesSearch && matchesStatus && matchesType;
        }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [orders, searchTerm, filterStatus, filterType]);

    // Export to CSV
    const exportToCSV = () => {
        const headers = ['Order Number', 'Date', 'Customer Name', 'Email', 'Items', 'Total', 'Payment Method', 'Status', 'Type'];
        const rows = filteredOrders.map(order => [
            order.orderNumber,
            new Date(order.createdAt).toLocaleDateString(),
            order.customerName,
            order.customerEmail,
            order.items.length,
            `$${order.total.toFixed(2)}`,
            order.paymentMethod,
            order.paymentStatus,
            order.orderType
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const handleDelete = async (orderId: string) => {
        try {
            await deleteOrder(orderId);
            setShowDeleteConfirm(null);
        } catch (error) {
            console.error('Failed to delete order:', error);
            addToast('Failed to delete order', 'error');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'bg-green-100 text-green-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'refunded': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getTypeColor = (type: string) => {
        return type === 'online' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
                        <p className="text-gray-600 mt-1">Manage all online and manual orders</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <Download size={18} />
                            Export CSV
                        </button>
                        <button
                            onClick={() => setShowManualOrderForm(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            <Plus size={18} />
                            Create Manual Order
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <p className="text-sm text-gray-600 font-medium">Total Orders</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{orders.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <p className="text-sm text-gray-600 font-medium">Total Revenue</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">
                            ${orders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <p className="text-sm text-gray-600 font-medium">Pending Orders</p>
                        <p className="text-3xl font-bold text-yellow-600 mt-2">
                            {orders.filter(o => o.paymentStatus === 'pending').length}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <p className="text-sm text-gray-600 font-medium">Manual Orders</p>
                        <p className="text-3xl font-bold text-purple-600 mt-2">
                            {orders.filter(o => o.orderType === 'manual').length}
                        </p>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search by order number, name, or email..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div>
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="refunded">Refunded</option>
                            </select>
                        </div>
                        <div>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                            >
                                <option value="all">All Types</option>
                                <option value="online">Online</option>
                                <option value="manual">Manual</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Orders Table */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {filteredOrders.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500 text-lg">No orders found</p>
                            <p className="text-gray-400 text-sm mt-2">Try adjusting your filters or create a new order</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="font-mono text-sm font-semibold text-gray-900">{order.orderNumber}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
                                                    <p className="text-xs text-gray-500">{order.customerEmail}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                ${order.total.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">
                                                {order.paymentMethod}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.paymentStatus)}`}>
                                                    {order.paymentStatus}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(order.orderType)}`}>
                                                    {order.orderType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => setShowInvoice(order)}
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                                                        title="Generate Invoice"
                                                    >
                                                        <FileText size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(order.id)}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Delete Order"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Order Details Modal */}
                {selectedOrder && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Order Info */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Order Information</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-gray-500">Order Number</p>
                                            <p className="font-mono font-semibold">{selectedOrder.orderNumber}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Date</p>
                                            <p className="font-semibold">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Payment Method</p>
                                            <p className="font-semibold capitalize">{selectedOrder.paymentMethod}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Payment Status</p>
                                            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(selectedOrder.paymentStatus)}`}>
                                                {selectedOrder.paymentStatus}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Customer Info */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Customer Information</h3>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-xs text-gray-500">Name</p>
                                            <p className="font-semibold">{selectedOrder.customerName}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Email</p>
                                            <p className="font-semibold">{selectedOrder.customerEmail}</p>
                                        </div>
                                        {selectedOrder.customerPhone && (
                                            <div>
                                                <p className="text-xs text-gray-500">Phone</p>
                                                <p className="font-semibold">{selectedOrder.customerPhone}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Items */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Order Items</h3>
                                    <div className="space-y-3">
                                        {selectedOrder.items.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                                                <img src={item.productImage} alt={item.productName} className="w-16 h-16 object-cover rounded" />
                                                <div className="flex-1">
                                                    <p className="font-semibold">{item.productName}</p>
                                                    <p className="text-sm text-gray-600">Size: {item.selectedSize} • Qty: {item.quantity}</p>
                                                </div>
                                                <p className="font-semibold">${item.total.toFixed(2)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Totals */}
                                <div className="border-t border-gray-200 pt-4">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600">Subtotal</span>
                                            <span className="font-semibold">${selectedOrder.subtotal.toFixed(2)}</span>
                                        </div>
                                        {selectedOrder.tax > 0 && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Tax</span>
                                                <span className="font-semibold">${selectedOrder.tax.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {selectedOrder.discount > 0 && (
                                            <div className="flex justify-between text-sm text-green-600">
                                                <span>Discount</span>
                                                <span className="font-semibold">-${selectedOrder.discount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                                            <span>Total</span>
                                            <span>${selectedOrder.total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {selectedOrder.notes && (
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Notes</h3>
                                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedOrder.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-lg max-w-md w-full p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Delete Order?</h3>
                            <p className="text-gray-600 mb-6">
                                Are you sure you want to delete this order? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDelete(showDeleteConfirm)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Manual Order Form Modal */}
                {showManualOrderForm && (
                    <ManualOrderForm
                        onClose={() => setShowManualOrderForm(false)}
                        onSuccess={() => {
                            setShowManualOrderForm(false);
                            // Orders will auto-refresh from context
                        }}
                    />
                )}

                {/* Invoice Modal */}
                {showInvoice && (
                    <Invoice
                        order={showInvoice}
                        onClose={() => setShowInvoice(null)}
                    />
                )}
            </div>
        </div>
    );
};

export default Orders;
