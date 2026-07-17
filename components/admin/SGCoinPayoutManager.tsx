// components/admin/SGCoinPayoutManager.tsx
//
// Admin UI for reviewing SGCOIN payout (withdrawal) requests.
// Mirrors SGCoinRequestManager.tsx but adds the Approved -> Completed
// transition (which requires an admin-recorded Polygon tx hash).

import React, { useState, useEffect } from 'react';
import {
    X, CheckCircle, XCircle, Eye, Calendar, Wallet, Mail,
    DollarSign, FileText, Loader, AlertTriangle, Hash, ArrowRight
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import ConfirmationModal from './ConfirmationModal';
import {
    getAllPayoutRequests, approvePayoutRequest, completePayoutRequest,
    rejectPayoutRequest, getPayoutRequestStats, PayoutRequest,
} from '../../services/payoutRequest';
import {
    sendPayoutApprovedEmail, sendPayoutCompletedEmail, sendPayoutRejectedEmail,
} from '../../services/emailService';

interface SGCoinPayoutManagerProps {
    adminUserId: string;
}

const STATUS_STYLES = {
    pending:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    approved:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    rejected:  'bg-red-500/20 text-red-400 border-red-500/30',
} as const;

const POLYGON_TX_BASE = 'https://polygonscan.com/tx/';

const SGCoinPayoutManager: React.FC<SGCoinPayoutManagerProps> = ({ adminUserId }) => {
    const { addToast } = useToast();
    const [requests, setRequests] = useState<PayoutRequest[]>([]);
    const [filteredRequests, setFilteredRequests] = useState<PayoutRequest[]>([]);
    const [selectedRequest, setSelectedRequest] = useState<PayoutRequest | null>(null);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'completed' | 'rejected'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showApproveConfirm, setShowApproveConfirm] = useState(false);
    const [txHash, setTxHash] = useState('');
    const [adminNotes, setAdminNotes] = useState('');
    const [stats, setStats] = useState({
        total: 0, pending: 0, approved: 0, completed: 0, rejected: 0,
        totalRequested: 0, totalCompleted: 0,
    });

    useEffect(() => { loadRequests(); }, []);

    useEffect(() => {
        if (statusFilter === 'all') setFilteredRequests(requests);
        else setFilteredRequests(requests.filter(r => r.status === statusFilter));
    }, [requests, statusFilter]);

    const loadRequests = async () => {
        setIsLoading(true);
        try {
            const [data, s] = await Promise.all([getAllPayoutRequests(), getPayoutRequestStats()]);
            setRequests(data);
            setStats({
                total: s.totalRequests,
                pending: s.pendingRequests,
                approved: s.approvedRequests,
                completed: s.completedRequests,
                rejected: s.rejectedRequests,
                totalRequested: s.totalAmountRequested,
                totalCompleted: s.totalAmountCompleted,
            });
        } catch (err) {
            addToast('Failed to load payout requests', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Approve gate: opens the ConfirmationModal. The heavy lifting happens in
    // performApprove, which the modal calls via onConfirm and is also wrapped
    // in isLoading so the button is disabled while the RPC is in flight.
    const handleApproveClick = () => {
        if (!selectedRequest) return;
        setShowApproveConfirm(true);
    };

    const performApprove = async () => {
        if (!selectedRequest) return;
        setIsProcessing(true);
        try {
            await approvePayoutRequest(selectedRequest.id, adminUserId);
            await sendPayoutApprovedEmail(
                selectedRequest.email,
                selectedRequest.amount,
                selectedRequest.walletAddress,
            );
            await loadRequests();
            setSelectedRequest(null);
            // Close the confirmation modal ONLY on success (matches handleComplete
            // and handleReject's modal-close behavior). On RPC error the modal
            // stays open so the admin can read the failure toast + retry via
            // Confirm without re-opening the detail modal.
            setShowApproveConfirm(false);
            addToast('Payout approved + customer notified', 'success');
        } catch (err: any) {
            addToast('Approve failed: ' + (err?.message || 'Unknown error'), 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleComplete = async () => {
        if (!selectedRequest) return;
        if (!txHash.trim() || txHash.trim().length < 10) {
            addToast('Please enter a valid Polygon transaction hash', 'warning');
            return;
        }
        setIsProcessing(true);
        try {
            await completePayoutRequest(selectedRequest.id, adminUserId, txHash.trim(), adminNotes.trim() || undefined);
            await sendPayoutCompletedEmail(selectedRequest.email, selectedRequest.amount, txHash.trim());
            await loadRequests();
            setSelectedRequest(null);
            setShowCompleteModal(false);
            setTxHash('');
            setAdminNotes('');
            addToast('Payout completed + customer notified', 'success');
        } catch (err: any) {
            addToast('Complete failed: ' + (err?.message || 'Unknown error'), 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!selectedRequest) return;
        const wasApproved = selectedRequest.status === 'approved';
        if (!rejectionReason.trim()) {
            addToast('Please provide a rejection reason', 'warning');
            return;
        }
        setIsProcessing(true);
        try {
            await rejectPayoutRequest(selectedRequest.id, adminUserId, rejectionReason.trim());
            await sendPayoutRejectedEmail(selectedRequest.email, selectedRequest.amount, rejectionReason.trim(), wasApproved);
            await loadRequests();
            setSelectedRequest(null);
            setShowRejectModal(false);
            setRejectionReason('');
            addToast('Payout rejected' + (wasApproved ? ' + balance refunded' : ''), 'success');
        } catch (err: any) {
            addToast('Reject failed: ' + (err?.message || 'Unknown error'), 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const renderActions = (r: PayoutRequest): React.ReactNode => {
        if (r.status === 'pending') {
            return (
                <div className="flex gap-3 pt-4 border-t border-gray-800">
                    <button onClick={handleApproveClick} disabled={isProcessing} className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                        {isProcessing ? <Loader className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Approve</>}
                    </button>
                    <button onClick={() => setShowRejectModal(true)} disabled={isProcessing} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                        <XCircle className="w-5 h-5" /> Reject
                    </button>
                </div>
            );
        }
        if (r.status === 'approved') {
            return (
                <div className="flex gap-3 pt-4 border-t border-gray-800">
                    <button onClick={() => setShowCompleteModal(true)} disabled={isProcessing} className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                        <ArrowRight className="w-5 h-5" /> Mark Completed
                    </button>
                    <button onClick={() => setShowRejectModal(true)} disabled={isProcessing} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                        <XCircle className="w-5 h-5" /> Reject + Refund
                    </button>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg"><div className="text-sm text-gray-400">Total</div><div className="text-2xl font-bold text-white">{stats.total}</div></div>
                <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-lg"><div className="text-sm text-yellow-400">Pending</div><div className="text-2xl font-bold text-yellow-300">{stats.pending}</div></div>
                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg"><div className="text-sm text-blue-400">Approved</div><div className="text-2xl font-bold text-blue-300">{stats.approved}</div></div>
                <div className="bg-green-900/20 border border-green-500/30 p-4 rounded-lg"><div className="text-sm text-green-400">Completed</div><div className="text-2xl font-bold text-green-300">{stats.completed}</div></div>
                <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg"><div className="text-sm text-red-400">Rejected</div><div className="text-2xl font-bold text-red-300">{stats.rejected}</div></div>
            </div>

            <div className="flex flex-wrap gap-2">
                {(['all', 'pending', 'approved', 'completed', 'rejected'] as const).map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)} className={`px-4 py-2 rounded-lg font-medium capitalize transition ${statusFilter === s ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                        {s}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="text-center py-12"><Loader className="w-8 h-8 animate-spin mx-auto text-gray-500" /><p className="text-gray-500 mt-4">Loading payout requests...</p></div>
            ) : filteredRequests.length === 0 ? (
                <div className="text-center py-12 bg-gray-800 rounded-lg"><FileText className="w-12 h-12 mx-auto text-gray-600 mb-4" /><p className="text-gray-400">No {statusFilter !== 'all' ? statusFilter : ''} payout requests found</p></div>
            ) : (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-900">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredRequests.map(r => (
                                <tr key={r.id} className="hover:bg-gray-700/50 transition">
                                    <td className="px-4 py-3 text-sm text-gray-300">{new Date(r.createdAt).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 text-sm text-white">{r.email}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-white">{r.amount.toLocaleString()} SGCOIN</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block px-2 py-1 text-xs font-bold rounded border capitalize ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => setSelectedRequest(r)} className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm">
                                            <Eye className="w-4 h-4" /> View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-800">
                            <h2 className="text-2xl font-bold text-white">Payout Request Details</h2>
                            <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-gray-800 rounded-lg transition" aria-label="Close details">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between">
                                <span className={`px-4 py-2 rounded-lg border font-bold uppercase text-sm ${STATUS_STYLES[selectedRequest.status]}`}>{selectedRequest.status}</span>
                                <span className="text-sm text-gray-400">{new Date(selectedRequest.createdAt).toLocaleString()}</span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-800 p-4 rounded-lg"><div className="flex items-center gap-2 text-gray-400 text-sm mb-1"><Mail className="w-4 h-4" /> Email</div><div className="text-white font-medium">{selectedRequest.email}</div></div>
                                <div className="bg-gray-800 p-4 rounded-lg"><div className="flex items-center gap-2 text-gray-400 text-sm mb-1"><DollarSign className="w-4 h-4" /> Amount</div><div className="text-white font-bold text-xl">{selectedRequest.amount.toLocaleString()} SGCOIN</div></div>
                                <div className="col-span-2 bg-gray-800 p-4 rounded-lg"><div className="flex items-center gap-2 text-gray-400 text-sm mb-1"><Wallet className="w-4 h-4" /> Destination Wallet</div><div className="text-white font-mono text-sm break-all">{selectedRequest.walletAddress}</div></div>
                                <div className="bg-gray-800 p-4 rounded-lg"><div className="flex items-center gap-2 text-gray-400 text-sm mb-1"><Calendar className="w-4 h-4" /> Submitted</div><div className="text-white text-sm">{new Date(selectedRequest.createdAt).toLocaleString()}</div></div>
                                {selectedRequest.txHash && (
                                    <div className="col-span-2 bg-gray-800 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 text-gray-400 text-sm mb-1"><Hash className="w-4 h-4" /> Completed Tx Hash</div>
                                        <a href={`${POLYGON_TX_BASE}${selectedRequest.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm font-mono break-all underline">
                                            {selectedRequest.txHash}
                                        </a>
                                    </div>
                                )}
                                {selectedRequest.adminNotes && (
                                    <div className="col-span-2 bg-gray-800 p-4 rounded-lg"><div className="text-gray-400 text-sm mb-1">Admin Notes</div><div className="text-white">{selectedRequest.adminNotes}</div></div>
                                )}
                                {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
                                    <div className="col-span-2 bg-red-900/20 border border-red-500/30 p-4 rounded-lg">
                                        <div className="flex items-center gap-2 text-red-400 text-sm mb-2"><AlertTriangle className="w-4 h-4" /> Rejection Reason</div>
                                        <div className="text-white">{selectedRequest.rejectionReason}</div>
                                    </div>
                                )}
                            </div>

                            {renderActions(selectedRequest)}
                        </div>
                    </div>
                </div>
            )}

            {showApproveConfirm && selectedRequest && (
                <ConfirmationModal
                    isOpen={showApproveConfirm}
                    onClose={() => {
                        if (!isProcessing) setShowApproveConfirm(false);
                    }}
                    onConfirm={performApprove}
                    title={`Approve ${selectedRequest.amount.toLocaleString()} SGCOIN payout?`}
                    message={
                        <>
              Approve this payout for <strong>{selectedRequest.email}</strong>? This will deduct{' '}
              {selectedRequest.amount.toLocaleString()} SGCOIN from their store-credit balance and queue the on-chain transfer. Do NOT transfer until you have actually gas-paid the on-chain send.
                        </>
                    }
                    confirmText="Approve + Queue Transfer"
                    cancelText="Cancel"
                    isLoading={isProcessing}
                />
            )}

            {showCompleteModal && selectedRequest && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-2">Mark Payout Completed</h3>
                            <p className="text-gray-400 text-sm mb-4">
                                Paste the Polygon transaction hash for the on-chain transfer you executed.
                                Confirm you sent <strong>{selectedRequest.amount.toLocaleString()} SGCOIN</strong> to <code className="break-all">{selectedRequest.walletAddress}</code> before recording.
                            </p>
                            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Transaction Hash *</label>
                            <input value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="0x..." className="w-full bg-gray-800 border border-gray-700 p-3 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none font-mono text-sm" />
                            <label className="block text-xs font-bold uppercase text-gray-400 mb-1 mt-4">Admin Notes (optional)</label>
                            <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="e.g. used Polygon gas tier 30..." className="w-full bg-gray-800 border border-gray-700 p-3 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none h-24 resize-none text-sm" />
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => { setShowCompleteModal(false); setTxHash(''); setAdminNotes(''); }} className="flex-1 bg-gray-800 text-white py-2 rounded-lg font-medium hover:bg-gray-700 transition">Cancel</button>
                                <button onClick={handleComplete} disabled={isProcessing || !txHash.trim() || txHash.trim().length < 10} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50">
                                    {isProcessing ? 'Recording...' : 'Confirm + Notify Customer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showRejectModal && selectedRequest && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 rounded-xl shadow-2xl max-w-md w-full">
                        <div className="p-6">
                            <h3 className="text-xl font-bold text-white mb-2">Reject Payout Request</h3>
                            {selectedRequest.status === 'approved' && (
                                <p className="text-yellow-300 text-sm mb-3">This request was already approved. Rejecting will refund the deducted SGCOIN back to the customer's store-credit balance.</p>
                            )}
                            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Rejection Reason *</label>
                            <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Explain why this payout cannot be processed." className="w-full bg-gray-800 border border-gray-700 p-3 rounded-lg text-white placeholder-gray-500 focus:border-gray-600 focus:outline-none h-32 resize-none text-sm" />
                            <div className="flex gap-3 mt-4">
                                <button onClick={() => { setShowRejectModal(false); setRejectionReason(''); }} className="flex-1 bg-gray-800 text-white py-2 rounded-lg font-medium hover:bg-gray-700 transition">Cancel</button>
                                <button onClick={handleReject} disabled={isProcessing || !rejectionReason.trim()} className="flex-1 bg-red-600 text-white py-2 rounded-lg font-bold hover:bg-red-700 transition disabled:opacity-50">
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

export default SGCoinPayoutManager;
