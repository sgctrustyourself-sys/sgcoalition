import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useToast } from '../../context/ToastContext';
import {
    Download, Eye, CheckCircle, XCircle, Search,
    ExternalLink, Trash2, Trophy, Youtube, Instagram,
    Shirt, Star, Mail, RefreshCw
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

interface GiveawayEntryRow {
    id: string;
    giveaway_id: string;
    name: string;
    email: string;
    instagram_username: string | null;
    youtube_handle: string | null;
    shirt_size: string | null;
    screenshot_sub_url: string | null;
    screenshot_comment_url: string | null;
    screenshot_story_url: string | null;
    screenshot_follow_url: string | null;
    screenshot_like_url: string | null;
    screenshot_bonus_urls: string[] | null;
    claimed_points: number;
    verified: boolean;
    email_sent: boolean;
    ip_address: string | null;
    created_at: string;
}

// ─── Screenshot Viewer ───────────────────────────────────────────

const ScreenshotView: React.FC<{ title: string; url: string | null }> = ({ title, url }) => {
    if (!url) return (
        <div>
            <div className="text-xs font-bold text-gray-500 uppercase mb-2">{title}</div>
            <div className="w-full h-48 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-center text-gray-700 text-xs">
                Not submitted
            </div>
        </div>
    );

    return (
        <div>
            <div className="text-xs font-bold text-gray-400 uppercase mb-2">{title}</div>
            <div className="relative group rounded-xl overflow-hidden border border-white/10">
                <img src={url} alt={title} className="w-full h-48 object-cover" />
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${title} in new tab`}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                >
                    <ExternalLink className="w-6 h-6 text-white" />
                </a>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────

interface GiveawayEntriesTabProps {
    giveawayId: string;
}

const GiveawayEntriesTab: React.FC<GiveawayEntriesTabProps> = ({ giveawayId }) => {
    const { addToast } = useToast();
    const [entries, setEntries] = useState<GiveawayEntryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState<GiveawayEntryRow | null>(null);
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
            addToast('Failed to load entries', 'error');
        } else {
            setEntries(data || []);
        }
        setLoading(false);
    };

    const toggleVerified = async (entryId: string, current: boolean) => {
        const { error } = await supabase
            .from('giveaway_entries')
            .update({ verified: !current })
            .eq('id', entryId);

        if (error) {
            addToast('Failed to update verification', 'error');
        } else {
            addToast(!current ? '✅ Entry verified' : 'Entry unverified', 'success');
            fetchEntries();
            if (selectedEntry?.id === entryId) {
                setSelectedEntry({ ...selectedEntry, verified: !current });
            }
        }
    };

    const markEmailSent = async (entryId: string) => {
        const { error } = await supabase
            .from('giveaway_entries')
            .update({ email_sent: true })
            .eq('id', entryId);

        if (error) {
            addToast('Failed to mark email sent', 'error');
        } else {
            addToast('📧 Marked as email sent', 'success');
            fetchEntries();
        }
    };

    const deleteEntry = async (entryId: string) => {
        if (!confirm('Delete this entry? This cannot be undone.')) return;
        const { error } = await supabase
            .from('giveaway_entries')
            .delete()
            .eq('id', entryId);

        if (error) {
            addToast('Failed to delete entry', 'error');
        } else {
            addToast('Entry deleted', 'success');
            fetchEntries();
            setSelectedEntry(null);
        }
    };

    const pickWinner = () => {
        const verified = entries.filter(e => e.verified);
        if (verified.length === 0) {
            addToast('No verified entries to pick from!', 'warning');
            return;
        }
        const winner = verified[Math.floor(Math.random() * verified.length)];
        if (confirm(`Select "${winner.name}" (${winner.email}) as winner?`)) {
            addToast(`🏆 Winner: ${winner.name} | ${winner.email}`, 'success');
        }
    };

    const exportCSV = () => {
        const rows = [
            ['Name', 'Email', 'YouTube', 'Instagram', 'Shirt Size', 'Points', 'Verified', 'Email Sent', 'Date'],
            ...filteredEntries.map(e => [
                e.name,
                e.email,
                e.youtube_handle ? `@${e.youtube_handle}` : '',
                e.instagram_username ? `@${e.instagram_username}` : '',
                e.shirt_size || '',
                e.claimed_points,
                e.verified ? 'Yes' : 'No',
                e.email_sent ? 'Yes' : 'No',
                new Date(e.created_at).toLocaleDateString(),
            ].join(','))
        ].join('\n');

        const blob = new Blob([rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `giveaway-entries-${giveawayId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filteredEntries = entries.filter(e => {
        const matchFilter =
            filter === 'all' ||
            (filter === 'verified' && e.verified) ||
            (filter === 'unverified' && !e.verified);

        const term = searchTerm.toLowerCase();
        const matchSearch =
            e.name.toLowerCase().includes(term) ||
            e.email.toLowerCase().includes(term) ||
            (e.youtube_handle || '').toLowerCase().includes(term) ||
            (e.instagram_username || '').toLowerCase().includes(term);

        return matchFilter && matchSearch;
    });

    const verifiedCount = entries.filter(e => e.verified).length;
    const totalPoints = entries.reduce((s, e) => s + (e.claimed_points || 0), 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" />
                Loading entries...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard label="Total Entries" value={entries.length} color="white" />
                <StatCard label="Verified" value={verifiedCount} color="green" />
                <StatCard label="Pending" value={entries.length - verifiedCount} color="yellow" />
                <StatCard label="Total Points" value={totalPoints} color="amber" />
                <div className="bg-white/5 border border-white/10 rounded-xl flex items-center justify-center p-3">
                    <button
                        onClick={pickWinner}
                        disabled={verifiedCount === 0}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg font-black text-xs uppercase hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Trophy className="w-4 h-4" />
                        Pick Winner
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="flex gap-2">
                    {(['all', 'verified', 'unverified'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg font-bold text-xs uppercase transition ${
                                filter === f
                                    ? f === 'verified' ? 'bg-green-500 text-white'
                                    : f === 'unverified' ? 'bg-yellow-500 text-black'
                                    : 'bg-white text-black'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                        >
                            {f === 'all' ? `All (${entries.length})`
                            : f === 'verified' ? `Verified (${verifiedCount})`
                            : `Pending (${entries.length - verifiedCount})`}
                        </button>
                    ))}
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search name, email, handle..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-600 focus:border-white/30 outline-none w-64"
                        />
                    </div>
                    <button
                        onClick={fetchEntries}
                        className="bg-white/5 border border-white/10 p-2 rounded-lg hover:bg-white/10 transition"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                        onClick={exportCSV}
                        className="bg-white/5 border border-white/10 px-3 py-2 rounded-lg font-bold text-xs uppercase hover:bg-white/10 transition flex items-center gap-2 text-gray-400"
                    >
                        <Download className="w-4 h-4" />
                        CSV
                    </button>
                </div>
            </div>

            {/* Table */}
            {filteredEntries.length === 0 ? (
                <div className="text-center py-16 text-gray-600 text-sm">No entries found.</div>
            ) : (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-black/40 text-gray-500 uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="p-3 text-left">Name</th>
                                <th className="p-3 text-left">Email</th>
                                <th className="p-3 text-left">YouTube / IG</th>
                                <th className="p-3 text-center">Size</th>
                                <th className="p-3 text-center">Pts</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Email</th>
                                <th className="p-3 text-right">Date</th>
                                <th className="p-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredEntries.map(entry => (
                                <tr key={entry.id} className="hover:bg-white/[0.02] transition">
                                    <td className="p-3 font-bold text-white">{entry.name}</td>
                                    <td className="p-3 text-gray-400 text-xs">{entry.email}</td>
                                    <td className="p-3">
                                        <div className="space-y-0.5">
                                            {entry.youtube_handle && (
                                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                                    <Youtube className="w-3 h-3 text-red-400" />
                                                    @{entry.youtube_handle}
                                                </div>
                                            )}
                                            {entry.instagram_username && (
                                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                                    <Instagram className="w-3 h-3 text-pink-400" />
                                                    @{entry.instagram_username}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center">
                                        {entry.shirt_size ? (
                                            <span className="bg-white/10 text-white text-xs font-bold px-2 py-0.5 rounded">
                                                {entry.shirt_size}
                                            </span>
                                        ) : <span className="text-gray-700">—</span>}
                                    </td>
                                    <td className="p-3 text-center">
                                        <span className="text-amber-400 font-black text-sm">{entry.claimed_points}</span>
                                    </td>
                                    <td className="p-3 text-center">
                                        {entry.verified ? (
                                            <span className="inline-flex items-center gap-1 bg-green-500/15 text-green-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                                <CheckCircle className="w-3 h-3" /> Verified
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 bg-yellow-500/15 text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full">
                                                <XCircle className="w-3 h-3" /> Pending
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {entry.email_sent ? (
                                            <span className="text-blue-400 text-xs font-bold">Sent</span>
                                        ) : (
                                            <span className="text-gray-700 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-right text-gray-600 text-xs">
                                        {new Date(entry.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="p-3 text-center">
                                        <button
                                            onClick={() => setSelectedEntry(entry)}
                                            className="text-blue-400 hover:text-blue-300 transition p-1"
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

            {/* Detail Modal */}
            {selectedEntry && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedEntry(null)}
                >
                    <div
                        className="bg-[#0A0A0A] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 space-y-6">
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-black text-white">{selectedEntry.name}</h2>
                                    <p className="text-gray-400 text-sm">{selectedEntry.email}</p>
                                    <div className="flex items-center gap-4 mt-2">
                                        {selectedEntry.youtube_handle && (
                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                <Youtube className="w-3.5 h-3.5 text-red-400" />
                                                @{selectedEntry.youtube_handle}
                                            </span>
                                        )}
                                        {selectedEntry.instagram_username && (
                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                <Instagram className="w-3.5 h-3.5 text-pink-400" />
                                                @{selectedEntry.instagram_username}
                                            </span>
                                        )}
                                        {selectedEntry.shirt_size && (
                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                <Shirt className="w-3.5 h-3.5" />
                                                {selectedEntry.shirt_size}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1 text-xs text-amber-400 font-black">
                                            <Star className="w-3.5 h-3.5 fill-current" />
                                            {selectedEntry.claimed_points} pts
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-wrap justify-end">
                                    <button
                                        onClick={() => toggleVerified(selectedEntry.id, selectedEntry.verified)}
                                        className={`px-4 py-2 rounded-xl font-bold text-xs uppercase transition ${
                                            selectedEntry.verified
                                                ? 'bg-green-500 text-white hover:bg-green-600'
                                                : 'bg-yellow-500 text-black hover:bg-yellow-600'
                                        }`}
                                    >
                                        {selectedEntry.verified ? '✅ Verified' : 'Mark Verified'}
                                    </button>
                                    {!selectedEntry.email_sent && (
                                        <button
                                            onClick={() => markEmailSent(selectedEntry.id)}
                                            className="px-4 py-2 rounded-xl font-bold text-xs uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition flex items-center gap-1"
                                        >
                                            <Mail className="w-3.5 h-3.5" />
                                            Mark Email Sent
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteEntry(selectedEntry.id)}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Screenshots */}
                            <div>
                                <h3 className="font-black uppercase text-sm tracking-wider text-gray-400 mb-4">Screenshots</h3>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <ScreenshotView title="YouTube Subscribe" url={selectedEntry.screenshot_sub_url} />
                                    <ScreenshotView title="YouTube Comment" url={selectedEntry.screenshot_comment_url} />
                                    <ScreenshotView title="Instagram Story (Bonus)" url={selectedEntry.screenshot_story_url} />
                                </div>
                                {/* Legacy Instagram fields (for older entries) */}
                                {(selectedEntry.screenshot_follow_url || selectedEntry.screenshot_like_url) && (
                                    <div className="grid md:grid-cols-3 gap-4 mt-4">
                                        <ScreenshotView title="IG Follow" url={selectedEntry.screenshot_follow_url} />
                                        <ScreenshotView title="IG Like" url={selectedEntry.screenshot_like_url} />
                                    </div>
                                )}
                                {/* Bonus uploads */}
                                {selectedEntry.screenshot_bonus_urls && selectedEntry.screenshot_bonus_urls.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="text-xs font-bold uppercase text-gray-500 mb-2">Bonus Uploads</h4>
                                        <div className="grid md:grid-cols-3 gap-4">
                                            {selectedEntry.screenshot_bonus_urls.map((url, i) => (
                                                <ScreenshotView key={i} title={`Bonus ${i + 1}`} url={url} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Meta */}
                            <div className="pt-4 border-t border-white/5 grid md:grid-cols-3 gap-4 text-xs">
                                <div>
                                    <span className="text-gray-600 font-bold uppercase tracking-wider">Submitted</span>
                                    <p className="text-white mt-0.5">{new Date(selectedEntry.created_at).toLocaleString()}</p>
                                </div>
                                <div>
                                    <span className="text-gray-600 font-bold uppercase tracking-wider">IP Address</span>
                                    <p className="text-white mt-0.5">{selectedEntry.ip_address || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-gray-600 font-bold uppercase tracking-wider">Email Status</span>
                                    <p className={`mt-0.5 font-bold ${selectedEntry.email_sent ? 'text-blue-400' : 'text-gray-600'}`}>
                                        {selectedEntry.email_sent ? 'Winner email sent' : 'Not sent'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Stat Card ────────────────────────────────────────────────────

const StatCard = ({ label, value, color }: { label: string; value: number; color: string }) => {
    const colors: Record<string, string> = {
        white: 'bg-white/5 border-white/10 text-white',
        green: 'bg-green-500/10 border-green-500/20 text-green-400',
        yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    };
    return (
        <div className={`border rounded-xl p-4 ${colors[color]}`}>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</div>
            <div className="text-2xl font-black">{value.toLocaleString()}</div>
        </div>
    );
};

export default GiveawayEntriesTab;
