import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Eye, Calendar, Wallet, Mail, DollarSign, FileText, Loader, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { getAllPurchaseRequests, approvePurchaseRequest, rejectPurchaseRequest, PurchaseRequest } from '../../services/purchaseRequest';
import { sendApprovalEmail, sendRejectionEmail } from '../../services/emailService';

interface SGCoinRequestManagerProps {
    adminWalletAddress: string;
}

const SGCoinRequestManager: React.FC<SGCoinRequestManagerProps> = ({ adminWalletAddress }) => {
    const { addToast } = useToast();
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [filteredRequests, setFilteredRequests] = useState<PurchaseRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);

    useEffect(() => {
        loadRequests();
    }, []);

    useEffect(() => {
        filterRequests();
    }, [requests, statusFilter]);

    const loadRequests = async () => {
        setIsLoading(true);
        try {
            const data = await getAllPurchaseRequests();
            setRequests(data);
        } catch (error) {
            console.error('Error loading requests:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const filterRequests = () => {
        if (statusFilter === 'all') {
            setFilteredRequests(requests);
        } else {
            setFilteredRequests(requests.filter(r => r.status === statusFilter));
        }
    };

    const handleApprove = async (request: PurchaseRequest) => {
        if (!confirm(`Approve ${request.amount.toLocaleString()} SGCoin for ${request.email}?\n\nMake sure you have manually sent the SGCoin to their wallet before approving.`)) {
            return;
        }

        setIsProcessing(true);
        try {
            await approvePurchaseRequest(request.id, adminWalletAddress, adminWalletAddress);
            await sendApprovalEmail(request.email, request.amount, request.walletAddress);
            await loadRequests();
            setSelectedRequest(null);
            addToast('Request approved and customer notified!', 'success');
        } catch (error: any) {
            addToast('Error approving request: ' + error.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        if (!rejectionReason.trim()) {
            addToast('Please provide a reason for rejection', 'warning');
            return;
        }

        setIsProcessing(true);
        try {
            await rejectPurchaseRequest(selectedRequest.id, adminWalletAddress, adminWalletAddress, rejectionReason);
            await sendRejectionEmail(selectedRequest.email, selectedRequest.amount, rejectionReason);
            await loadRequests();
            setSelectedRequest(null);
            setShowRejectModal(false);
            setRejectionReason('');
            addToast('Request rejected and customer notified', 'success');
        } catch (error: any) {
            addToast('Error rejecting request: ' + error.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
            approved: 'bg-green-500/20 text-green-400 border-green-500/30',
            rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
        };
        return styles[status as keyof typeof styles] || styles.pending;
    };

    const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        approved: requests.filter(r => r.status === 'approved').length,
        rejected: requests.filter(r => r.status === 'rejected').length
    };

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="text-sm text-gray-400">Total Requests</div>
                    <div className="text-2xl font-bold text-white">{stats.total}</div>
                </div>
                <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-lg">
                    <div className="text-sm text-yellow-400">Pending</div>
                    <div className="text-2xl font-bold text-yellow-300">{stats.pending}</div>
                </div>
                <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-lg">
                    <div className="text-sm text-green-400">Approved</div>
                    <div className="text-2xl font-bold text-green-300">{stats.approved}</div>
                </div>
                <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
                    <div className="text-sm text-red-400">Rejected</div>
                    <div className="text-2xl font-bold text-red-300">{stats.rejected}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-lg font-medium capitalize transition ${statusFilter === status
                            ? 'bg-white text-black'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Requests List */}
            {isLoading ? (
                <div className="text-center py-12">
                    <Loader className="w-8 h-8 animate-spin mx-auto text-gray-500" />
                    <p className="text-gray-500 mt-4">Loading requests...</p>
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="text-center py-12 bg-gray-800 rounded-lg">
                    <FileText className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400">No {statusFilter !== 'all' ? statusFilter : ''} requests found</p>
                </div>
            ) : (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-900">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Payment</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredRequests.map(request => (
                                <tr key={request.id} className="hover:bg-gray-700/50 transition">
                                    <td className="px-4 py-3 text-sm text-gray-300">
                                        {new Date(request.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-white">{request.email}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-white">
                                        {request.amount.toLocaleString()} SGC
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-300 capitalize">
                                        {request.paymentMethod}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block px-2 py-1 text-xs font-bold rounded border capitalize ${getStatusBadge(request.status)}`}>
                                            {request.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => setSelectedRequest(request)}
                                            className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm"
                                        >
                                            <Eye className="w-4 h-4" /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Request Detail Modal */}
            {selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h2 className="text-2xl font-bold text-white">Purchase Request Details</h2>
                            <button
                                onClick={() => setSelectedRequest(null)}
                                className="p-2 hover:bg-gray-800 rounded-lg transition"
                                aria-label="Close details"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Status */}
                            <div className="flex items-center justify-between">
                                <span className={`px-4 py-2 rounded-lg border font-bold uppercase text-sm ${getStatusBadge(selectedRequest.status)}`}>
                                    {selectedRequest.status}
                                </span>
                                <span className="text-sm text-gray-400">
                                    {new Date(selectedRequest.createdAt).toLocaleString()}
                                </span>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                                        <Mail className="w-4 h-4" /> Email
                                    </div>
                                    <div className="text-white font-medium">{selectedRequest.email}</div>
                                </div>

                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                                        <DollarSign className="w-4 h-4" /> Amount
                                    </div>
                                    <div className="text-white font-bold text-xl">
                                        {selectedRequest.amount.toLocaleString()} SGC
                                    </div>
                                </div>

                                <div className="col-span-2 bg-gray-800 p-4 rounded-lg">
                                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                                        <Wallet className="w-4 h-4" /> Wallet Address
                                    </div>
                                    <div className="text-white font-mono text-sm break-all">
                                        {selectedRequest.walletAddress}
                                    </div>
                                </div>

                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                                        <FileText className="w-4 h-4" /> Payment Method
                                    </div>
                                    <div className="text-white capitalize">{selectedRequest.paymentMethod}</div>
                                </div>

                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                                        <Calendar className="w-4 h-4" /> Submitted
                                    </div>
                                    <div className="text-white">{new Date(selectedRequest.createdAt).toLocaleString()}</div>
                                </div>
                            </div>

                            {/* Payment Proof */}
                            {selectedRequest.proofUrl && (
                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <div className="text-gray-400 text-sm mb-3">Payment Proof</div>
                                    <img
                                        src={selectedRequest.proofUrl}
                                        alt="Payment proof"
                                        className="w-full rounded-lg border border-gray-700"
                                    />
                                    <a
                                        href={selectedRequest.proofUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
                                    >
                                        Open in new tab →
                                    </a>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedRequest.notes && (
                                <div className="bg-gray-800 p-4 rounded-lg">
                                    <div className="text-gray-400 text-sm mb-2">Customer Notes</div>
                                    <div className="text-white">{selectedRequest.notes}</div>
                                </div>
                            )}

                            {/* Rejection Reason */}
                            {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
                                <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
                                    <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
                                        <AlertTriangle className="w-4 h-4" /> Rejection Reason
                                    </div>
                                    <div className="text-white">{selectedRequest.rejectionReason}</div>
                                </div>
                            )}

                            {/* Actions */}
                            {selectedRequest.status === 'pending' && (
                                <div className="flex gap-3 pt-4 border-t border-gray-800">
                                    <button
                                        onClick={() => handleApprove(selectedRequest)}
                                        disabled={isProcessing}
                                        className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isProcessing ? (
                                            <Loader className="w-5 h-5 animate-spin" />
                                        ) : (
                                            <>
                                                <CheckCircle className="w-5 h-5" /> Approve
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setShowRejectModal(true)}
                                        disabled={isProcessing}
                                        className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <XCircle className="w-5 h-5" /> Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && selectedRequest && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-4">Reject Request</h3>
                            <p className="text-gray-400 mb-4">
                                Please provide a reason for rejecting this request. The customer will receive this in an email.
                            </p>
                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="e.g., Payment proof is unclear, incorrect amount sent, etc."
                                className="w-full bg-gray-800 border border-gray-700 p-3 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none h-32 resize-none"
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false);
                                        setRejectionReason('');
                                    }}
                                    className="flex-1 bg-gray-800 text-white py-2 rounded-lg font-medium hover:bg-gray-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={isProcessing || !rejectionReason.trim()}
                                    className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50"
                                >
                                    {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SGCoinRequestManager;
