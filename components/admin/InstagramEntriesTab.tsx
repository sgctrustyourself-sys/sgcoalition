import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { InstagramGiveawayEntry } from '../../types';
import { useToast } from '../../context/ToastContext';
import { Download, Eye, CheckCircle, XCircle, Search, Filter, ExternalLink, Trash2 } from 'lucide-react';

interface InstagramEntriesTabProps {
    giveawayId: string;
}

const InstagramEntriesTab: React.FC<InstagramEntriesTabProps> = ({ giveawayId }) => {
    const { addToast } = useToast();
    const [entries, setEntries] = useState<InstagramGiveawayEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState<InstagramGiveawayEntry | null>(null);
    const [filter, setFilter] = useState<'all' | 'verified' | 'unverified'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchEntries();
    }, [giveawayId]);

    const fetchEntries = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('giveaway_entries')
            .select('*')
            .eq('giveaway_id', giveawayId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching entries:', error);
        } else {
            setEntries(data || []);
        }
        setLoading(false);
    };

    const toggleVerified = async (entryId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('giveaway_entries')
            .update({ verified: !currentStatus })
            .eq('id', entryId);

        if (error) {
            console.error('Error updating entry:', error);
            addToast('Failed to update verification status', 'error');
        } else {
            fetchEntries();
            if (selectedEntry?.id === entryId) {
                setSelectedEntry({ ...selectedEntry, verified: !currentStatus });
            }
        }
    };

    const deleteEntry = async (entryId: string) => {
        if (!confirm('Delete this entry? This cannot be undone.')) return;

        const { error } = await supabase
            .from('giveaway_entries')
            .delete()
            .eq('id', entryId);

        if (error) {
            console.error('Error deleting entry:', error);
            addToast('Failed to delete entry', 'error');
        } else {
            fetchEntries();
            setSelectedEntry(null);
        }
    };

    const pickRandomWinner = () => {
        const verifiedEntries = entries.filter(e => e.verified);
        if (verifiedEntries.length === 0) {
            addToast('No verified entries to pick from!', 'warning');
            return;
        }

        const randomIndex = Math.floor(Math.random() * verifiedEntries.length);
        const winner = verifiedEntries[randomIndex];

        if (confirm(`Pick ${winner.name} (${winner.email}) as the winner?`)) {
            addToast(`🎉 Winner selected: ${winner.name}!\n\nEmail: ${winner.email}\nInstagram: @${winner.instagramUsername}`, 'success');
        }
    };

    const exportToCSV = () => {
        const csv = [
            ['Name', 'Email', 'Instagram', 'Verified', 'Date'].join(','),
            ...entries.map(e => [
                e.name,
                e.email,
                `@${e.instagramUsername}`,
                e.verified ? 'Yes' : 'No',
                new Date(e.createdAt).toLocaleDateString()
            ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `giveaway-entries-${giveawayId}.csv`;
        a.click();
    };

    const filteredEntries = entries.filter(entry => {
        const matchesFilter =
            filter === 'all' ||
            (filter === 'verified' && entry.verified) ||
            (filter === 'unverified' && !entry.verified);

        const matchesSearch =
            entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.instagramUsername.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    const verifiedCount = entries.filter(e => e.verified).length;

    if (loading) {
        return <div className="text-center py-12 text-gray-400">Loading entries...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Total Entries</div>
                    <div className="text-2xl font-bold text-white">{entries.length}</div>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 p-4 rounded-lg">
                    <div className="text-green-400 text-xs font-bold uppercase mb-1">Verified</div>
                    <div className="text-2xl font-bold text-green-400">{verifiedCount}</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                    <div className="text-yellow-400 text-xs font-bold uppercase mb-1">Pending</div>
                    <div className="text-2xl font-bold text-yellow-400">{entries.length - verifiedCount}</div>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-lg flex items-center justify-center">
                    <button
                        onClick={pickRandomWinner}
                        disabled={verifiedCount === 0}
                        className="bg-white text-black px-4 py-2 rounded font-bold text-sm uppercase hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Pick Winner
                    </button>
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${filter === 'all' ? 'bg-white text-black' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        All ({entries.length})
                    </button>
                    <button
                        onClick={() => setFilter('verified')}
                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${filter === 'verified' ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        Verified ({verifiedCount})
                    </button>
                    <button
                        onClick={() => setFilter('unverified')}
                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${filter === 'unverified' ? 'bg-yellow-500 text-black' : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }`}
                    >
                        Pending ({entries.length - verifiedCount})
                    </button>
                </div>

                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-white/30 outline-none"
                        />
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="bg-white/10 border border-white/10 px-4 py-2 rounded font-bold text-xs uppercase hover:bg-white/20 transition flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Entries List */}
            {filteredEntries.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    No entries found
                </div>
            ) : (
                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-black/40 text-gray-400 uppercase text-xs">
                            <tr>
                                <th className="p-3 text-left">Name</th>
                                <th className="p-3 text-left">Email</th>
                                <th className="p-3 text-left">Instagram</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-right">Date</th>
                                <th className="p-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredEntries.map(entry => (
                                <tr key={entry.id} className="hover:bg-white/5 transition">
                                    <td className="p-3 font-medium text-white">{entry.name}</td>
                                    <td className="p-3 text-gray-400 text-sm">{entry.email}</td>
                                    <td className="p-3 text-gray-400 text-sm">@{entry.instagramUsername}</td>
                                    <td className="p-3 text-center">
                                        {entry.verified ? (
                                            <span className="inline-flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs font-bold">
                                                <CheckCircle className="w-3 h-3" /> Verified
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-bold">
                                                <XCircle className="w-3 h-3" /> Pending
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right text-gray-500 text-sm">
                                        {new Date(entry.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => setSelectedEntry(entry)}
                                            className="text-blue-400 hover:text-blue-300 transition"
                                            title="View Details"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Entry Detail Modal */}
            {selectedEntry && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEntry(null)}>
                    <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">{selectedEntry.name}</h2>
                                    <p className="text-gray-400">{selectedEntry.email}</p>
                                    <p className="text-gray-500 text-sm">@{selectedEntry.instagramUsername}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => toggleVerified(selectedEntry.id, selectedEntry.verified)}
                                        className={`px-4 py-2 rounded font-bold text-sm uppercase transition ${selectedEntry.verified
                                            ? 'bg-green-500 text-white hover:bg-green-600'
                                            : 'bg-yellow-500 text-black hover:bg-yellow-600'
                                            }`}
                                    >
                                        {selectedEntry.verified ? 'Verified' : 'Mark Verified'}
                                    </button>
                                    <button
                                        onClick={() => deleteEntry(selectedEntry.id)}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded transition"
                                        title="Delete Entry"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Screenshots */}
                            <div className="space-y-4">
                                <h3 className="font-bold uppercase text-gray-300">Screenshots</h3>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <ScreenshotView
                                        title="Follow Screenshot"
                                        url={selectedEntry.screenshotFollowUrl}
                                    />
                                    <ScreenshotView
                                        title="Like Screenshot"
                                        url={selectedEntry.screenshotLikeUrl}
                                    />
                                    <ScreenshotView
                                        title="Story Screenshot"
                                        url={selectedEntry.screenshotStoryUrl}
                                    />
                                </div>
                            </div>

                            {/* Entry Info */}
                            <div className="mt-6 pt-6 border-t border-gray-800">
                                <div className="grid md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">Submitted:</span>
                                        <span className="text-white ml-2">{new Date(selectedEntry.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Status:</span>
                                        <span className="text-white ml-2">{selectedEntry.verified ? 'Verified ✓' : 'Pending Review'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ScreenshotView: React.FC<{ title: string; url: string }> = ({ title, url }) => {
    return (
        <div>
            <div className="text-sm font-medium text-gray-400 mb-2">{title}</div>
            <div className="relative group">
                <img
                    src={url}
                    alt={title}
                    className="w-full h-64 object-cover rounded-lg border border-gray-700"
                />
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-lg"
                >
                    <ExternalLink className="w-8 h-8 text-white" />
                </a>
            </div>
        </div>
    );
};

export default InstagramEntriesTab;
