import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Wallet, FileText, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { getUserPurchaseRequests, PurchaseRequest } from '../../services/purchaseRequest';

interface PurchaseRequestsTabProps {
    userId: string;
}

const PurchaseRequestsTab: React.FC<PurchaseRequestsTabProps> = ({ userId }) => {
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadRequests();
    }, [userId]);

    const loadRequests = async () => {
        setIsLoading(true);
        try {
            const data = await getUserPurchaseRequests(userId);
            setRequests(data);
        } catch (error) {
            console.error('Error loading purchase requests:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'rejected':
                return <AlertTriangle className="w-5 h-5 text-red-500" />;
            default:
                return <Clock className="w-5 h-5 text-yellow-500" />;
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

    if (isLoading) {
        return (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
                <p className="text-gray-400 mt-4">Loading your requests...</p>
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="text-center py-12 bg-white/5 rounded-lg border border-white/10">
                <FileText className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">No Purchase Requests</h3>
                <p className="text-gray-400 mb-6">You haven't submitted any SGCoin purchase requests yet.</p>
                <a
                    href="/#/buy-sgcoin"
                    className="inline-block bg-white text-black px-6 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition"
                >
                    Buy SGCoin
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Purchase Requests</h2>
                <a
                    href="/#/buy-sgcoin"
                    className="bg-white text-black px-4 py-2 rounded-lg font-bold text-sm uppercase tracking-wider hover:bg-gray-200 transition"
                >
                    New Request
                </a>
            </div>

            <div className="space-y-4">
                {requests.map(request => (
                    <div
                        key={request.id}
                        className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {getStatusIcon(request.status)}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-bold text-white">
                                            {request.amount.toLocaleString()} SGC
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-bold rounded border capitalize ${getStatusBadge(request.status)}`}>
                                            {request.status}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-400 mt-1">
                                        {new Date(request.createdAt).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-black/30 p-3 rounded-lg">
                                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                    <Wallet className="w-3 h-3" /> Wallet Address
                                </div>
                                <div className="text-white text-sm font-mono break-all">
                                    {request.walletAddress}
                                </div>
                            </div>

                            <div className="bg-black/30 p-3 rounded-lg">
                                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                    <FileText className="w-3 h-3" /> Payment Method
                                </div>
                                <div className="text-white text-sm capitalize">
                                    {request.paymentMethod}
                                </div>
                            </div>
                        </div>

                        {request.notes && (
                            <div className="mt-4 bg-black/30 p-3 rounded-lg">
                                <div className="text-gray-400 text-xs mb-1">Your Notes</div>
                                <div className="text-white text-sm">{request.notes}</div>
                            </div>
                        )}

                        {request.status === 'approved' && request.processedAt && (
                            <div className="mt-4 bg-green-900/20 border border-green-500/30 p-3 rounded-lg">
                                <div className="flex items-center gap-2 text-green-400 text-sm">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="font-bold">Approved on {new Date(request.processedAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-green-300 text-xs mt-1">
                                    SGCoin has been sent to your wallet
                                </p>
                            </div>
                        )}

                        {request.status === 'rejected' && request.rejectionReason && (
                            <div className="mt-4 bg-red-900/20 border border-red-500/30 p-3 rounded-lg">
                                <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span className="font-bold">Request Rejected</span>
                                </div>
                                <div className="text-red-300 text-sm">
                                    <span className="font-medium">Reason:</span> {request.rejectionReason}
                                </div>
                                {request.processedAt && (
                                    <div className="text-red-400 text-xs mt-1">
                                        Rejected on {new Date(request.processedAt).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        )}

                        {request.status === 'pending' && (
                            <div className="mt-4 bg-yellow-900/20 border border-yellow-500/30 p-3 rounded-lg">
                                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                                    <Clock className="w-4 h-4" />
                                    <span className="font-bold">Under Review</span>
                                </div>
                                <p className="text-yellow-300 text-xs mt-1">
                                    Our team is reviewing your request. You'll receive an email once it's processed.
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PurchaseRequestsTab;
