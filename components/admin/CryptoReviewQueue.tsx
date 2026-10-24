// components/admin/CryptoReviewQueue.tsx
// Admin review queue for pending USDC (crypto) orders.
// Shows underpaid and awaiting orders with expected/received amounts,
// Polygonscan links, and confirm/top-up actions.
//
// Data is fetched from GET /api/crypto-review-queue (admin auth required).
import React, { useEffect, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { getAdminToken } from '../../services/adminSession';
import { CheckCircle, Clock, AlertCircle, Info, Link, Search, ChevronDown } from 'lucide-react';
import { XCircle } from 'lucide-react';

const STATUS_FILTERS = [
    { value: 'all', label: 'All', accent: 'text-gray-400' },
    { value: 'underpaid', label: 'Underpaid', accent: 'text-red-400' },
    { value: 'awaiting', label: 'Awaiting', accent: 'text-yellow-400' },
    { value: 'confirmed', label: 'Confirmed', accent: 'text-green-400' },
];

interface OrderQueueItem {
    id: string;
    orderNumber: string;
    total: string;
    cryptoStatus: string;
    txHash: string;
    expectedUsdc: string;
    receivedUsdc: string;
    merchantAddress: string;
    polygonscanLink: string;
    notes: string;
    displayStatus: string;
    hasTxHash: boolean;
}

interface CryptoReviewQueueProps {
    initialStatus?: string;
}

const CryptoReviewQueue: React.FC<CryptoReviewQueueProps> = ({ initialStatus = 'all' }) => {
    const { addToast } = useToast();
    // Get admin token from sessionStorage (same pattern as PaymentOptionsCard)
    const adminToken = getAdminToken();
    const [orders, setOrders] = useState<OrderQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentFilter, setCurrentFilter] = useState<typeof STATUS_FILTERS[0]>(STATUS_FILTERS[0]);
    const [currentStatus, setCurrentStatus] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [total, setTotal] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<OrderQueueItem | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // Fetch orders from the API
    const fetchOrders = async (force = false) => {
        if (!adminToken) {
            setError('Admin session required - log in via /api/admin-verify first');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const url = new URL('/api/crypto-review-queue', window.location.origin);
            if (currentStatus !== 'all') {
                url.searchParams.set('status', currentStatus);
            }
            if (searchQuery) {
                url.searchParams.set('q', searchQuery);
            }

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            setOrders(data.orders || []);
            setTotal((data.totalCount ?? data.orders?.length ?? 0) || 0);
        } catch (err: any) {
            console.error('Failed to fetch crypto review queue:', err);
            setError(err.message || 'Failed to load crypto review queue');
            addToast('Failed to load crypto review queue', 'error');
            setOrders([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    // Apply status filter
    useEffect(() => {
        setCurrentStatus(initialStatus);
        const filter = STATUS_FILTERS.find(f => f.value === initialStatus);
        if (filter) setCurrentFilter(filter);
        fetchOrders(true);
    }, [initialStatus, refreshKey]);

    // Apply filter change
    const applyFilter = (filter: typeof STATUS_FILTERS[0]) => {
        setCurrentFilter(filter);
        setCurrentStatus(filter.value);
        setPage(1); // reset to first page
        fetchOrders();
    };

    // Search change
    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setPage(1);
        fetchOrders();
    };

    // Refresh orders
    const refresh = () => {
        setRefreshKey(prev => prev + 1);
    };

    // Confirm order (flip to paid)
    const confirmOrder = async (orderId: string) => {
        if (!window.confirm(`Confirm order #${orderId} as paid? This will flip the order status to paid.`)) {
            return;
        }

        try {
            const response = await fetch('/api/crypto-verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderRef: orderId, txHash: '' }), // empty tx hash for idempotent confirm
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data.status === 'confirmed') {
                addToast(`Order #${orderId} confirmed as paid`, 'success');
                refresh();
            } else {
                addToast(`Order #${orderId}: ${data.status}`, 'info');
            }
        } catch (err: any) {
            console.error('Failed to confirm order:', err);
            addToast(err.message || 'Failed to confirm order', 'error');
        }
    };

    // Top-up action - mark for manual review
    const topUpOrder = async (orderId: string, currentTxHash: string) => {
        if (!window.confirm(`Mark order #${orderId} for manual top-up review?\n\nReceived: ${orderId.includes('received') ? 'See notes' : '—'}\nExpected: $${orderId.includes('expected') ? 'See notes' : '—'}`)) {
            return;
        }

        try {
            const response = await fetch('/api/crypto-verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ orderRef: orderId, txHash: currentTxHash }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            addToast(`Order #${orderId}: ${data.status}`, 'info');
            refresh();
        } catch (err: any) {
            console.error('Failed to top-up order:', err);
            addToast(err.message || 'Failed to top-up order', 'error');
        }
    };

    // Open Polygonscan link in new tab
    const openPolygonscan = (txHash: string) => {
        window.open(txHash, '_blank');
    };

    // Initial fetch — declared before the early return so the hook order is
    // identical on every render, whether or not an admin token is present.
    useEffect(() => {
        if (!adminToken) return;
        fetchOrders();
    }, [refreshKey, adminToken]);

    if (!adminToken) {
        return (
            <div className="min-h-screen bg-black p-8 text-white">
                <h2 className="text-2xl font-bold mb-4">Admin Login Required</h2>
                <p className="text-gray-400 mb-8">
                    Please log in to access the admin review queue.\n\n\nLog in via /api/admin-verify with the admin passphrase or wallet signature.
                </p>
                <button
                    onClick={() => window.location.href = '/api/admin-verify'}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                    Log in with Admin Wallet
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white/5 border-b border-white/10 backdrop-blur-sm min-h-screen">
            <div className="px-4 py-6">
                <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-widest">
                            Crypto Review Queue
                        </h2>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                            Pending USDC orders awaiting confirmation or manual review
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={currentFilter.value}
                            onChange={(e) => applyFilter(e.target as unknown as typeof STATUS_FILTERS[0])}
                            className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 font-mono text-xs text-gray-300 focus:border-blue-500 focus:outline-none"
                        >
                            {STATUS_FILTERS.map((filter) => (
                                <option key={filter.value} value={filter.value}>
                                    {filter.label}
                                </option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Search orders..."
                            value={searchQuery}
                            onChange={handleSearch}
                            className="w-32 bg-black/40 border border-white/10 rounded-lg px-3 py-2 font-mono text-xs text-gray-300 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                            onClick={refresh}
                            disabled={loading}
                            className="bg-blue-600/80 hover:bg-blue-500 text-white text-[11px] font-bold uppercase tracking-widest px-4 py-2 rounded-lg transition disabled:opacity-60"
                            aria-label="Refresh"
                        >
                            {loading ? 'Loading…' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {loading && <div className="flex items-center justify-center py-8 text-sm text-gray-400">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/></svg>
                    Loading...
                </div>}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg text-red-400 text-sm mb-6">
                        {error}
                    </div>
                )}

                {!loading && orders.length === 0 && !error && (
                    <div className="py-12 text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" viewBox="0 0 24 24"><path d="M21 7a2 2 0 0 0-2 2H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2zM5 7a2 2 0 0 0 0 4h14a2 2 0 0 0 0-4H5z"/></svg>
                        <p>No pending crypto orders found</p>
                        <p className="text-[10px] text-gray-400">All orders are paid or no crypto orders exist</p>
                    </div>
                )}

                {loading || orders.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg">
                        <table className="w-full min-w-full">
                            <thead>
                                <tr className="border-b border-white/10 bg-black/20">
                                    <th className="text-left text-[10px] font-bold text-white uppercase tracking-widest p-4">
                                        Order #
                                    </th>
                                    <th className="text-left text-[10px] font-bold text-white uppercase tracking-widest p-4">
                                        Total
                                    </th>
                                    <th className="text-left text-[10px] font-bold text-white uppercase tracking-widest p-4">
                                        Status
                                    </th>
                                    <th className="text-left text-[10px] font-bold text-white uppercase tracking-widest p-4">
                                        Tx Hash
                                    </th>
                                    <th className="text-left text-[10px] font-bold text-white uppercase tracking-widest p-4">
                                        Expected
                                    </th>
                                    <th className="text-left text-[10px] font-bold text-white uppercase tracking-widest p-4">
                                        Received
                                    </th>
                                    <th className="text-left text-[10px] font-bold text-white uppercase tracking-widest p-4">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => (
                                    <tr
                                        key={order.id}
                                        className="border-b border-white/10 bg-black/20 hover:bg-black/10 transition-colors"
                                    >
                                        <td className="p-4 font-medium text-white">
                                            <a
                                href={`/order/success?payment_method=crypto&order_id=${order.orderNumber}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                #{order.orderNumber}
                                            </a>
                                        </td>
                                        <td className="p-4 text-white">
                                            $${order.total}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.displayStatus === 'Underpaid' ? 'bg-red-500/20 text-red-400' : order.displayStatus === 'Awaiting' ? 'bg-yellow-500/20 text-yellow-400' : order.displayStatus === 'Confirmed' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                                {order.displayStatus}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {order.txHash === '—' ? (
                                                <span className="text-gray-400">—</span>
                                            ) : (
                                                <>
                                                    <span
                                                        className="text-blue-400 hover:underline cursor-pointer"
                                                        onClick={() => openPolygonscan(order.txHash)}
                                                        title="Open on PolygonScan"
                                                    >
                                                        {order.txHash}
                                                    </span>
                                                </>
                                            )}
                                        </td>
                                        <td className="p-4 text-white">
                                            {order.expectedUsdc === '—' ? '—' : `$${order.expectedUsdc}`}
                                        </td>
                                        <td className="p-4 text-white">
                                            {order.receivedUsdc === '—' ? '—' : `$${order.receivedUsdc}`}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                {order.hasTxHash && order.displayStatus !== 'Confirmed' && (
                                                    <button
                                                        onClick={() => confirmOrder(order.id)}
                                                        className="bg-green-600/80 hover:bg-green-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg transition"
                                                        title="Confirm as paid"
                                                    >
                                                      ✓ Confirm
                                                    </button>
                                                )}
                                                {order.displayStatus !== 'Underpaid' && (
                                                    <button
                                                        onClick={() => topUpOrder(order.id, order.txHash)}
                                                        className="bg-yellow-600/80 hover:bg-yellow-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg transition"
                                                        title="Mark for top-up review"
                                                    >
                                                      ⤴ Top-up
                                                    </button>
                                                )}
                                                {order.displayStatus === 'Underpaid' && (
                                                    <button
                                                        onClick={() => openPolygonscan(order.txHash)}
                                                        className="bg-red-600/80 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg transition"
                                                        title="View on PolygonScan"
                                                    >
                                                      🔗 View
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {orders.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-gray-500">
                                            No orders match the current filter
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="py-12 text-center text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-4 opacity-50" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/></svg>
                        <p>No pending crypto orders found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CryptoReviewQueue;