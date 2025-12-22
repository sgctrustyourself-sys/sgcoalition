import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Mail, MessageSquare, Download, UserX, Search, AlertTriangle, TrendingUp } from 'lucide-react';

interface Subscriber {
    id: string;
    subscriber_type: 'sms' | 'email';
    contact_value: string;
    country_code?: string;
    status: 'active' | 'unsubscribed' | 'bounced';
    source: string;
    subscribed_at: string;
    unsubscribed_at?: string;
    last_sent_at?: string;
}

const CoalitionSignalManager = () => {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [filter, setFilter] = useState<'all' | 'sms' | 'email'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unsubscribed'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [showUnsubscribeModal, setShowUnsubscribeModal] = useState(false);
    const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);

    useEffect(() => {
        fetchSubscribers();
    }, [filter, statusFilter]);

    const fetchSubscribers = async () => {
        setLoading(true);
        let query = supabase
            .from('coalition_signal_subscribers')
            .select('*')
            .order('created_at', { ascending: false });

        if (filter !== 'all') {
            query = query.eq('subscriber_type', filter);
        }

        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching subscribers:', error);
        } else {
            setSubscribers(data || []);
        }
        setLoading(false);
    };

    const handleUnsubscribeClick = (subscriber: Subscriber) => {
        setSelectedSubscriber(subscriber);
        setShowUnsubscribeModal(true);
    };

    const confirmUnsubscribe = async () => {
        if (!selectedSubscriber) return;

        const { error } = await supabase
            .from('coalition_signal_subscribers')
            .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
            .eq('id', selectedSubscriber.id);

        if (error) {
            alert('Failed to unsubscribe');
        } else {
            fetchSubscribers();
            setShowUnsubscribeModal(false);
            setSelectedSubscriber(null);
        }
    };

    const handleExportCSV = () => {
        const csv = [
            ['Type', 'Contact', 'Country Code', 'Status', 'Source', 'Subscribed At', 'Last Sent'],
            ...subscribers.map(s => [
                s.subscriber_type,
                s.contact_value,
                s.country_code || '',
                s.status,
                s.source,
                new Date(s.subscribed_at).toLocaleDateString(),
                s.last_sent_at ? new Date(s.last_sent_at).toLocaleDateString() : 'Never'
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coalition-signal-${Date.now()}.csv`;
        a.click();
    };

    const stats = {
        total: subscribers.length,
        sms: subscribers.filter(s => s.subscriber_type === 'sms').length,
        email: subscribers.filter(s => s.subscriber_type === 'email').length,
        active: subscribers.filter(s => s.status === 'active').length
    };

    const filteredSubscribers = subscribers.filter(s =>
        s.contact_value.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Coalition Signal Subscribers</h2>
                    <p className="text-gray-400 text-sm">Manage SMS and email notification signups</p>
                </div>
                <button
                    onClick={handleExportCSV}
                    className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-2xl font-bold text-white">{stats.total}</div>
                        <TrendingUp className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="text-sm text-gray-400">Total Subscribers</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-2xl font-bold text-blue-400">{stats.sms}</div>
                        <MessageSquare className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-sm text-gray-400">SMS Subscribers</div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-2xl font-bold text-green-400">{stats.email}</div>
                        <Mail className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-sm text-gray-400">Email Subscribers</div>
                </div>
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-2xl font-bold text-purple-400">{stats.active}</div>
                    </div>
                    <div className="text-sm text-gray-400">Active</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === 'all'
                                ? 'bg-white text-black'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('sms')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all ${filter === 'sms'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        <MessageSquare className="w-4 h-4" />
                        SMS
                    </button>
                    <button
                        onClick={() => setFilter('email')}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-all ${filter === 'email'
                                ? 'bg-green-500 text-white'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        <Mail className="w-4 h-4" />
                        Email
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setStatusFilter('active')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${statusFilter === 'active'
                                ? 'bg-white text-black'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setStatusFilter('unsubscribed')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${statusFilter === 'unsubscribed'
                                ? 'bg-white text-black'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        Unsubscribed
                    </button>
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${statusFilter === 'all'
                                ? 'bg-white text-black'
                                : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                    >
                        All Statuses
                    </button>
                </div>

                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by phone or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="text-left p-4 text-gray-400 font-medium text-sm">Type</th>
                                <th className="text-left p-4 text-gray-400 font-medium text-sm">Contact</th>
                                <th className="text-left p-4 text-gray-400 font-medium text-sm">Status</th>
                                <th className="text-left p-4 text-gray-400 font-medium text-sm">Source</th>
                                <th className="text-left p-4 text-gray-400 font-medium text-sm">Subscribed</th>
                                <th className="text-left p-4 text-gray-400 font-medium text-sm">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-gray-400">
                                        Loading subscribers...
                                    </td>
                                </tr>
                            ) : filteredSubscribers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center p-8 text-gray-400">
                                        No subscribers found
                                    </td>
                                </tr>
                            ) : (
                                filteredSubscribers.map(sub => (
                                    <tr key={sub.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            {sub.subscriber_type === 'sms' ? (
                                                <span className="flex items-center gap-2 text-blue-400">
                                                    <MessageSquare className="w-4 h-4" />
                                                    <span className="font-medium">SMS</span>
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2 text-green-400">
                                                    <Mail className="w-4 h-4" />
                                                    <span className="font-medium">Email</span>
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 font-mono text-sm text-white">
                                            {sub.subscriber_type === 'sms' && sub.country_code && (
                                                <span className="text-gray-400">{sub.country_code} </span>
                                            )}
                                            {sub.contact_value}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${sub.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                                    sub.status === 'unsubscribed' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' :
                                                        'bg-red-500/20 text-red-400 border border-red-500/30'
                                                }`}>
                                                {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-400 text-sm">{sub.source}</td>
                                        <td className="p-4 text-gray-400 text-sm">
                                            {new Date(sub.subscribed_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            {sub.status === 'active' && (
                                                <button
                                                    onClick={() => handleUnsubscribeClick(sub)}
                                                    className="text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors text-sm font-medium"
                                                >
                                                    <UserX className="w-4 h-4" />
                                                    Unsubscribe
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Unsubscribe Modal */}
            {showUnsubscribeModal && selectedSubscriber && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 max-w-md w-full">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Unsubscribe User?</h3>
                                <p className="text-gray-400 text-sm mb-3">
                                    This will unsubscribe <span className="font-mono text-white">{selectedSubscriber.contact_value}</span> from Coalition Signal notifications.
                                </p>
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
                                    <p className="text-yellow-400 text-sm font-medium">
                                        ⚠️ They will also be opted out of all Coalition rewards and exclusive offers.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowUnsubscribeModal(false);
                                    setSelectedSubscriber(null);
                                }}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmUnsubscribe}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                                Unsubscribe
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoalitionSignalManager;
