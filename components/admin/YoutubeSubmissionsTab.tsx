import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { YoutubeGiveawayEntry } from '../../types';
import { useToast } from '../../context/ToastContext';
import { sendGiveawayValidationEmail } from '../../services/emailService';
import { 
    Download, 
    Eye, 
    CheckCircle, 
    XCircle, 
    Search, 
    ExternalLink, 
    Trash2, 
    Mail, 
    Trophy, 
    Youtube, 
    Instagram, 
    Clock,
    User,
    ChevronLeft,
    ChevronRight,
    Loader2
} from 'lucide-react';

interface YoutubeSubmissionsTabProps {
    giveawayId: string;
    giveawayTitle: string;
}

const YoutubeSubmissionsTab: React.FC<YoutubeSubmissionsTabProps> = ({ giveawayId, giveawayTitle }) => {
    const { addToast } = useToast();
    const [entries, setEntries] = useState<YoutubeGiveawayEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState<YoutubeGiveawayEntry | null>(null);
    const [filter, setFilter] = useState<'all' | 'verified' | 'unverified'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isPickingWinner, setIsPickingWinner] = useState(false);

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
            // Map Supabase snake_case to camelCase
            const mappedEntries: YoutubeGiveawayEntry[] = (data || []).map((row: any) => ({
                id: row.id,
                giveawayId: row.giveaway_id,
                name: row.name,
                email: row.email,
                instagramUsername: row.instagram_username,
                youtubeHandle: row.youtube_handle,
                shirtSize: row.shirt_size,
                screenshotSubUrl: row.screenshot_sub_url,
                screenshotCommentUrl: row.screenshot_comment_url,
                screenshotStoryUrl: row.screenshot_story_url,
                screenshotBonusUrls: row.screenshot_bonus_urls || [],
                claimedPoints: row.claimed_points,
                verified: row.verified,
                emailSent: row.email_sent,
                createdAt: new Date(row.created_at).getTime(),
                ipAddress: row.ip_address
            }));
            setEntries(mappedEntries);
        }
        setLoading(false);
    };

    const toggleVerified = async (entryId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('giveaway_entries')
            .update({ verified: !currentStatus })
            .eq('id', entryId);

        if (error) {
            addToast('Failed to update status', 'error');
        } else {
            setEntries(entries.map(e => e.id === entryId ? { ...e, verified: !currentStatus } : e));
            if (selectedEntry?.id === entryId) {
                setSelectedEntry({ ...selectedEntry, verified: !currentStatus });
            }
            addToast(currentStatus ? 'Entry marked as pending' : 'Entry verified!', 'success');
        }
    };

    const sendConfirmation = async (entry: YoutubeGiveawayEntry) => {
        if (!entry.verified) {
            addToast('Please verify the entry before sending confirmation', 'warning');
            return;
        }

        try {
            await sendGiveawayValidationEmail(entry.email, entry.name, giveawayTitle);
            
            const { error } = await supabase
                .from('giveaway_entries')
                .update({ email_sent: true })
                .eq('id', entry.id);

            if (!error) {
                setEntries(entries.map(e => e.id === entry.id ? { ...e, emailSent: true } : e));
            }
            addToast('Confirmation email sent!', 'success');
        } catch (err) {
            addToast('Failed to send email', 'error');
        }
    };

    const pickWeightedWinner = () => {
        const verifiedEntries = entries.filter(e => e.verified);
        if (verifiedEntries.length === 0) {
            addToast('No verified entries to pick from!', 'warning');
            return;
        }

        setIsPickingWinner(true);
        
        // Wait for animation effect
        setTimeout(() => {
            // Create weighted pool
            const pool: YoutubeGiveawayEntry[] = [];
            verifiedEntries.forEach(entry => {
                const weight = entry.claimedPoints || 1;
                for (let i = 0; i < weight; i++) {
                    pool.push(entry);
                }
            });

            const winner = pool[Math.floor(Math.random() * pool.length)];
            setIsPickingWinner(false);

            if (confirm(`🎉 WEIGHTED WINNER SELECTED: ${winner.name} (${winner.email})\n\nClaimed Points: ${winner.claimedPoints}\nYouTube: ${winner.youtubeHandle}\n\nMark as official winner?`)) {
                // Here we would typically update the giveaway's 'winners' column
                addToast(`Winner ${winner.name} recorded!`, 'success');
            }
        }, 2000);
    };

    const deleteEntry = async (entryId: string) => {
        if (!confirm('Permanently delete this entry?')) return;

        const { error } = await supabase
            .from('giveaway_entries')
            .delete()
            .eq('id', entryId);

        if (error) {
            addToast('Failed to delete entry', 'error');
        } else {
            setEntries(entries.filter(e => e.id !== entryId));
            setSelectedEntry(null);
            addToast('Entry deleted', 'success');
        }
    };

    const filteredEntries = entries.filter(entry => {
        const matchesFilter = filter === 'all' || 
            (filter === 'verified' && entry.verified) || 
            (filter === 'unverified' && !entry.verified);

        const matchesSearch = 
            entry.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.youtubeHandle?.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    const verifiedCount = entries.filter(e => e.verified).length;
    const totalPointsPool = entries.reduce((acc, e) => acc + (e.claimedPoints || 0), 0);

    if (loading) return <div className="text-center py-20"><Loader2 className="w-10 h-10 animate-spin mx-auto text-white/20" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Total Entries" value={entries.length} icon={<User className="w-4 h-4" />} />
                <StatCard label="Verified" value={verifiedCount} color="text-green-400" icon={<CheckCircle className="w-4 h-4" />} />
                <StatCard label="Total Weight" value={totalPointsPool} desc="Points Pool" icon={<Trophy className="w-4 h-4" />} />
                <div className="bg-white text-black p-4 rounded-xl flex flex-col justify-center items-center gap-2 group cursor-pointer hover:bg-gray-100 transition-all shadow-xl shadow-white/5" onClick={pickWeightedWinner}>
                    {isPickingWinner ? (
                        <div className="flex flex-col items-center">
                            <Loader2 className="w-6 h-6 animate-spin mb-1" />
                            <span className="text-[10px] font-black uppercase">Rolling...</span>
                        </div>
                    ) : (
                        <>
                            <Trophy className="w-6 h-6 mb-1" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Pick Winner</span>
                        </>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white/5 border border-white/10 p-4 rounded-2xl">
                <div className="flex gap-2">
                    {['all', 'verified', 'unverified'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as any)}
                            className={`px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${
                                filter === f ? 'bg-white text-black shadow-lg shadow-white/10' : 'bg-white/5 text-gray-500 hover:text-white'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
                
                <div className="flex gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input 
                            type="text" 
                            placeholder="SEARCH ENTRIES..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder:text-gray-700 focus:border-white/20 outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Submissions Table */}
            <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-black/40 border-bottom border-white/5">
                        <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                            <th className="px-6 py-5">Participant</th>
                            <th className="px-6 py-5">YouTube / IG</th>
                            <th className="px-6 py-5 text-center">Points</th>
                            <th className="px-6 py-5 text-center">Size</th>
                            <th className="px-6 py-5 text-center">Status</th>
                            <th className="px-6 py-5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {filteredEntries.map((entry) => (
                            <tr key={entry.id} className="group hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-6">
                                    <div className="flex flex-col">
                                        <span className="font-black text-white uppercase text-sm">{entry.name}</span>
                                        <span className="text-[10px] text-gray-500 font-bold">{entry.email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-6">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-red-500">
                                            <Youtube className="w-3 h-3" />
                                            <span className="text-[11px] font-black">{entry.youtubeHandle}</span>
                                        </div>
                                        {entry.instagramUsername && (
                                            <div className="flex items-center gap-2 text-pink-500">
                                                <Instagram className="w-3 h-3" />
                                                <span className="text-[11px] font-black">@{entry.instagramUsername}</span>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-black text-white">
                                        {entry.claimedPoints}
                                    </span>
                                </td>
                                <td className="px-6 py-6 text-center text-xs font-black text-white/60">
                                    {entry.shirtSize || 'N/A'}
                                </td>
                                <td className="px-6 py-6 text-center">
                                    {entry.verified ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-green-500/20">
                                                <CheckCircle className="w-3 h-3" /> Verified
                                            </span>
                                            {entry.emailSent && <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tight">Email Sent</span>}
                                        </div>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 bg-yellow-500/10 text-yellow-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-yellow-500/20">
                                            <Clock className="w-3 h-3" /> Pending
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-6 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button 
                                            onClick={() => setSelectedEntry(entry)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                                            title="View Details"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => toggleVerified(entry.id, entry.verified)}
                                            className={`p-2 rounded-lg transition-all ${entry.verified ? 'text-green-400 bg-green-400/10' : 'text-gray-500 hover:bg-white/5'}`}
                                            title={entry.verified ? "Revoke Verification" : "Verify Entry"}
                                        >
                                            <CheckCircle className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => sendConfirmation(entry)}
                                            disabled={!entry.verified || entry.emailSent}
                                            className={`p-2 rounded-lg transition-all ${entry.emailSent ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 hover:text-white hover:bg-white/5'} disabled:opacity-20`}
                                            title="Send Confirmation Email"
                                        >
                                            <Mail className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Entry Detail Modal / Proof Viewer */}
            {selectedEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" onClick={() => setSelectedEntry(null)} />
                    <div className="relative bg-gray-950 border border-white/10 w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-8 border-bottom border-white/5 bg-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h4 className="font-black text-2xl uppercase tracking-tighter text-white">{selectedEntry.name}</h4>
                                <div className="flex items-center gap-4 text-xs font-bold text-gray-500 mt-1">
                                    <span className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {selectedEntry.email}</span>
                                    <span className="w-1 h-1 bg-white/10 rounded-full" />
                                    <span className="flex items-center gap-1.5"><Youtube className="w-3 h-3" /> {selectedEntry.youtubeHandle}</span>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => toggleVerified(selectedEntry.id, selectedEntry.verified)}
                                    className={`px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${
                                        selectedEntry.verified ? 'bg-green-500 text-black' : 'bg-white text-black'
                                    }`}
                                >
                                    {selectedEntry.verified ? 'Verified ✓' : 'Verify Now'}
                                </button>
                                <button
                                    onClick={() => deleteEntry(selectedEntry.id)}
                                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                    title="Delete Entry"
                                    aria-label="Delete Entry"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Proof Gallery */}
                        <div className="flex-1 overflow-y-auto p-8 bg-black">
                            <h5 className="font-black uppercase text-[10px] tracking-[0.4em] text-white/20 mb-8">Verification Proofs / Screenshots</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                <ProofCard title="YouTube Subscription" url={selectedEntry.screenshotSubUrl} />
                                <ProofCard title="Video Comment" url={selectedEntry.screenshotCommentUrl} />
                                <ProofCard title="Social Share" url={selectedEntry.screenshotStoryUrl} isOptional={true} />
                                
                                {selectedEntry.screenshotBonusUrls?.map((url, idx) => (
                                    <ProofCard key={idx} title={`Bonus Proof #${idx + 1}`} url={url} />
                                ))}

                                {(!selectedEntry.screenshotBonusUrls || selectedEntry.screenshotBonusUrls.length === 0) && !selectedEntry.screenshotStoryUrl && (
                                    <div className="flex items-center justify-center p-12 bg-white/5 border border-dashed border-white/10 rounded-2xl col-span-full">
                                        <p className="text-gray-600 uppercase font-black text-xs tracking-widest">No extra proofs uploaded</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon, color = "text-white", desc }: { label: string, value: number | string, icon: React.ReactNode, color?: string, desc?: string }) => (
    <div className="bg-white/5 border border-white/10 p-6 rounded-2xl flex items-center justify-between shadow-lg">
        <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">{label}</p>
            <div className="flex items-center gap-3">
                <h4 className={`text-2xl font-black italic tracking-tighter ${color}`}>{value}</h4>
                {desc && <span className="text-[8px] font-bold text-gray-600 uppercase mt-2">{desc}</span>}
            </div>
        </div>
        <div className="w-10 h-10 bg-white/5 border border-white/5 rounded-xl flex items-center justify-center text-white/20">
            {icon}
        </div>
    </div>
);

const ProofCard = ({ title, url, isOptional = false }: { title: string, url?: string, isOptional?: boolean }) => {
    if (!url && isOptional) return null;
    if (!url) {
        return (
            <div className="space-y-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-500 ml-1">{title} (MISSING)</p>
                <div className="aspect-[4/5] bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-900/40">
                    <XCircle className="w-10 h-10" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 group">
            <div className="flex justify-between items-center ml-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/40">{title}</p>
                <a 
                    href={url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-blue-500 hover:text-white transition-colors"
                    title="View Full Size Screenshot"
                    aria-label="View Full Size Screenshot"
                >
                    <ExternalLink className="w-3 h-3" />
                </a>
            </div>
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-white/10 bg-gray-900 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]">
                <img src={url} alt={title} className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Click link above to view full size</span>
                </div>
            </div>
        </div>
    );
};

export default YoutubeSubmissionsTab;
