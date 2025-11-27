import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { Order } from '../../types';
import { Download, Search, Eye, Trash2, FileText, Plus, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import ManualOrderForm from '../ManualOrderForm';
import Invoice from '../Invoice';

const OrderManager: React.FC = () => {
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
            case 'paid': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'pending': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
            case 'refunded': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="font-display text-2xl font-bold uppercase text-white">Orders</h2>
                    <p className="text-gray-400 text-sm">Manage customer orders and invoices</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg hover:bg-white/10 transition"
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                    <button
                        onClick={() => setShowManualOrderForm(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-bold uppercase text-sm hover:bg-gray-200 transition"
                    >
                        <Plus size={16} />
                        Create Order
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 p-5 rounded-xl backdrop-blur-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase">Total Orders</p>
                    <p className="text-2xl font-bold text-white mt-1">{orders.length}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-xl backdrop-blur-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-400 mt-1">
                        ${orders.reduce((sum, o) => sum + o.total, 0).toFixed(2)}
                    </p>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-xl backdrop-blur-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase">Pending</p>
                    <p className="text-2xl font-bold text-yellow-400 mt-1">
                        {orders.filter(o => o.paymentStatus === 'pending').length}
                    </p>
                </div>
                <div className="bg-white/5 border border-white/10 p-5 rounded-xl backdrop-blur-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase">Manual</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">
                        {orders.filter(o => o.orderType === 'manual').length}
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search orders..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-white/30 outline-none"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-white/30 outline-none"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="refunded">Refunded</option>
                </select>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:border-white/30 outline-none"
                >
                    <option value="all">All Types</option>
                    <option value="online">Online</option>
                    <option value="manual">Manual</option>
                </select>
            </div>

            {/* Orders Table */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black/40 text-gray-400 uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="p-4">Order #</th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Customer</th>
                                <th className="p-4">Total</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-gray-500">
                                        No orders found
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-white/5 transition">
                                        <td className="p-4 font-mono text-sm text-brand-accent">{order.orderNumber}</td>
                                        <td className="p-4 text-sm text-gray-400">
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm font-bold text-white">{order.customerName}</div>
                                            <div className="text-xs text-gray-500">{order.customerEmail}</div>
                                        </td>
                                        <td className="p-4 font-bold text-white">${order.total.toFixed(2)}</td>
                                        <td className="p-4">
                                            <span className={`text-xs px-2 py-1 rounded border font-bold uppercase ${getStatusColor(order.paymentStatus)}`}>
                                                {order.paymentStatus}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded transition"
                                                    title="View Details"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setShowInvoice(order)}
                                                    className="p-2 text-green-400 hover:bg-green-500/10 rounded transition"
                                                    title="Invoice"
                                                >
                                                    <FileText size={16} />
                                                </button>
                                                <button
                                                    onClick={() => setShowDeleteConfirm(order.id)}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded transition"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white uppercase">Order Details</h2>
                            <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-white">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Order Number</p>
                                    <p className="text-white font-mono">{selectedOrder.orderNumber}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Date</p>
                                    <p className="text-white">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Customer</p>
                                    <p className="text-white font-bold">{selectedOrder.customerName}</p>
                                    <p className="text-gray-400 text-sm">{selectedOrder.customerEmail}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">Payment</p>
                                    <p className="text-white capitalize">{selectedOrder.paymentMethod}</p>
                                    <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded border ${getStatusColor(selectedOrder.paymentStatus)}`}>
                                        {selectedOrder.paymentStatus}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500 uppercase font-bold mb-3">Items</p>
                                <div className="space-y-3">
                                    {selectedOrder.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/5">
                                            <img src={item.productImage} alt={item.productName} className="w-12 h-12 object-cover rounded bg-white/10" />
                                            <div className="flex-1">
                                                <p className="text-white font-bold text-sm">{item.productName}</p>
                                                <p className="text-gray-400 text-xs">Size: {item.selectedSize} • Qty: {item.quantity}</p>
                                            </div>
                                            <p className="text-white font-bold">${item.total.toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-white/10 pt-4 space-y-2">
                                <div className="flex justify-between text-sm text-gray-400">
                                    <span>Subtotal</span>
                                    <span>${selectedOrder.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold text-white pt-2 border-t border-white/10">
                                    <span>Total</span>
                                    <span>${selectedOrder.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 border border-white/10 rounded-xl p-6 max-w-sm w-full text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Delete Order?</h3>
                        <p className="text-gray-400 mb-6">This action cannot be undone.</p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(showDeleteConfirm)}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Order Form */}
            {showManualOrderForm && (
                <ManualOrderForm
                    onClose={() => setShowManualOrderForm(false)}
                    onSuccess={() => setShowManualOrderForm(false)}
                />
            )}

            {/* Invoice */}
            {showInvoice && (
                <Invoice
                    order={showInvoice}
                    onClose={() => setShowInvoice(null)}
                />
            )}
        </div>
    );
};

export default OrderManager;
