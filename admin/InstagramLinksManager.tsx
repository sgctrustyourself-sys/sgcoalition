import React, { useState, useEffect } from 'react';
import { Instagram, CheckCircle, Wallet, Mail, Clock, ExternalLink, RefreshCw, Copy, AlertCircle } from 'lucide-react';
import { getPendingInstagramLinks, markRewardSent } from '@/services/socialLinking';
import { useToast } from '@/context/ToastContext';
import ConfirmationModal from '@/components/admin/ConfirmationModal';

const InstagramLinksManager = () => {
    const { addToast } = useToast();
    const [pendingLinks, setPendingLinks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    // Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedLink, setSelectedLink] = useState<{ id: string, username: string } | null>(null);

    useEffect(() => {
        loadPendingLinks();
    }, []);

    const loadPendingLinks = async () => {
        setLoading(true);
        const links = await getPendingInstagramLinks();
        setPendingLinks(links);
        setLoading(false);
    };

    const confirmMarkSent = (link: { id: string, username: string }) => {
        setSelectedLink(link);
        setModalOpen(true);
    };

    const handleMarkSent = async () => {
        if (!selectedLink) return;

        setProcessing(selectedLink.id);
        const result = await markRewardSent(selectedLink.id, 'Reward sent manually');

        if (result.success) {
            addToast(`Reward marked as sent for @${selectedLink.username}`, 'success');
            loadPendingLinks();
        } else {
            addToast(result.error || 'Failed to update', 'error');
        }

        setProcessing(null);
        setModalOpen(false);
        setSelectedLink(null);
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        addToast(`${label} copied to clipboard`, 'success');
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="animate-pulse flex justify-between">
                    <div className="h-8 bg-gray-800 rounded w-1/3"></div>
                    <div className="h-8 bg-gray-800 rounded w-24"></div>
                </div>
                <div className="h-64 bg-gray-800 rounded-xl"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-white">
                        <Instagram className="w-6 h-6 text-pink-400" />
                        Instagram Link Requests
                    </h2>
                    <p className="text-gray-400 text-sm">
                        Users waiting for 1,000 SGCoin reward
                    </p>
                </div>
                <button
                    onClick={loadPendingLinks}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition border border-white/10"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-2xl font-bold text-white">{pendingLinks.length}</div>
                            <div className="text-sm text-gray-400">Pending Rewards</div>
                        </div>
                        <Clock className="w-8 h-8 text-purple-400" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black/40 text-gray-400 uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="p-4">User / Instagram</th>
                                <th className="p-4">Linked Date</th>
                                <th className="p-4">Wallet Address</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {pendingLinks.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center text-gray-500">
                                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                                        <p>All rewards sent! No pending links.</p>
                                    </td>
                                </tr>
                            ) : (
                                pendingLinks.map((link) => (
                                    <tr key={link.id} className="hover:bg-white/5 transition">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <Instagram className="w-5 h-5 text-white" />
                                                </div>
                                                <div>
                                                    <a
                                                        href={`https://instagram.com/${link.username}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="font-bold text-white hover:text-pink-400 transition flex items-center gap-1"
                                                    >
                                                        @{link.username}
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                                        <Mail className="w-3 h-3" />
                                                        {link.user?.email || 'No email'}
                                                        {link.user?.email && (
                                                            <button
                                                                onClick={() => copyToClipboard(link.user.email, 'Email')}
                                                                className="hover:text-white transition"
                                                                title="Copy Email"
                                                            >
                                                                <Copy className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-400">
                                            {new Date(link.linked_at).toLocaleDateString()}
                                            <div className="text-xs opacity-50">
                                                {new Date(link.linked_at).toLocaleTimeString()}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {link.wallet_address ? (
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-black/30 px-2 py-1 rounded text-green-400 font-mono text-xs border border-green-500/20">
                                                        {link.wallet_address.substring(0, 6)}...{link.wallet_address.substring(link.wallet_address.length - 4)}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(link.wallet_address, 'Wallet Address')}
                                                        className="text-gray-500 hover:text-white transition"
                                                        title="Copy Address"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : link.wallet && link.wallet.length > 0 ? (
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-black/30 px-2 py-1 rounded text-green-400 font-mono text-xs border border-green-500/20">
                                                        {link.wallet[0].wallet_address.substring(0, 6)}...{link.wallet[0].wallet_address.substring(link.wallet[0].wallet_address.length - 4)}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(link.wallet[0].wallet_address, 'Wallet Address')}
                                                        className="text-gray-500 hover:text-white transition"
                                                        title="Copy Address"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="flex items-center gap-1 text-yellow-500 text-xs font-bold bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">
                                                    <AlertCircle className="w-3 h-3" />
                                                    No Wallet
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => confirmMarkSent(link)}
                                                disabled={processing === link.id}
                                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition disabled:opacity-50 ml-auto"
                                            >
                                                <CheckCircle className="w-4 h-4" />
                                                Mark Sent
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmationModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onConfirm={handleMarkSent}
                title="Confirm Reward Sent"
                message={`Are you sure you have sent 1,000 SGCoin to @${selectedLink?.username}? This will mark the request as completed.`}
                confirmText="Yes, Mark as Sent"
                isLoading={!!processing}
            />
        </div>
    );
};

export default InstagramLinksManager;
