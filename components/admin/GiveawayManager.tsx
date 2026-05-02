import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Giveaway, GiveawayStatus } from '../../types';
import { Plus, Gift, Calendar, Users, Trophy, Trash2, Copy, AlertCircle, CheckCircle, Instagram, Youtube } from 'lucide-react';
import GiveawayEntriesTab from './GiveawayEntriesTab';
import YoutubeSubmissionsTab from './YoutubeSubmissionsTab';
import { getGiveawayTicketCount } from '../../utils/giveawayUtils';

const GiveawayManager: React.FC = () => {
    const { giveaways, addGiveaway, deleteGiveaway, pickGiveawayWinner, products } = useApp();
    const [activeTab, setActiveTab] = useState<'active' | 'past' | 'create'>('active');
    const [selectedGiveaway, setSelectedGiveaway] = useState<Giveaway | null>(null);
    const [detailTab, setDetailTab] = useState<'overview' | 'entries' | 'youtube-submissions'>('overview');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<Giveaway>>({
        title: '',
        prize: '',
        description: '',
        maxEntriesPerUser: 1,
        requirements: ['Join Discord', 'Follow on Twitter'],
        prizeImage: ''
    });

    const handleProductSelect = (productId: string) => {
        if (!productId) {
            // Clear form if no product selected
            setFormData({
                title: '',
                prize: '',
                description: '',
                maxEntriesPerUser: 1,
                requirements: ['Join Discord', 'Follow on Twitter'],
                prizeImage: ''
            });
            return;
        }

        const product = products.find(p => p.id === productId);
        if (product) {
            setFormData({
                ...formData,
                title: `${product.name} Giveaway`,
                prize: product.name,
                description: `Win a ${product.name}! ${product.description}`,
                prizeImage: product.images[0]
            });
        }
    };

    const handleCreate = async () => {
        if (!formData.title || !formData.prize || !formData.startDate || !formData.endDate) {
            setError('Please fill in all required fields');
            return;
        }

        const newGiveaway: Giveaway = {
            id: `ga_${Date.now()}`,
            title: formData.title,
            prize: formData.prize,
            description: formData.description || '',
            prizeImage: formData.prizeImage || '',
            startDate: formData.startDate,
            endDate: formData.endDate,
            status: GiveawayStatus.UPCOMING,
            requirements: formData.requirements || [],
            maxEntriesPerUser: formData.maxEntriesPerUser || 1,
            entries: [],
            createdAt: Date.now()
        };

        await addGiveaway(newGiveaway);
        setSuccess('Giveaway created successfully');
        setActiveTab('active');
        setFormData({
            title: '',
            prize: '',
            description: '',
            maxEntriesPerUser: 1,
            requirements: ['Join Discord', 'Follow on Twitter'],
            prizeImage: ''
        });
        setTimeout(() => setSuccess(null), 3000);
    };

    const handlePickWinner = async (id: string) => {
        if (window.confirm('Pick a random winner? This cannot be undone.')) {
            await pickGiveawayWinner(id, 1);
            setSuccess('Winner selected!');
            setTimeout(() => setSuccess(null), 3000);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete this giveaway?')) {
            await deleteGiveaway(id);
            if (selectedGiveaway?.id === id) setSelectedGiveaway(null);
            setSuccess('Giveaway deleted');
            setTimeout(() => setSuccess(null), 3000);
        }
    };

    const copyLink = (id: string) => {
        const link = `${window.location.origin}/ecosystem?giveaway=${id}`;
        navigator.clipboard.writeText(link);
        setSuccess('Link copied to clipboard');
        setTimeout(() => setSuccess(null), 3000);
    };

    const filteredGiveaways = giveaways.filter(g => {
        if (activeTab === 'active') return g.status !== GiveawayStatus.ENDED;
        if (activeTab === 'past') return g.status === GiveawayStatus.ENDED;
        return false;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="font-display text-2xl font-bold uppercase text-white">Giveaways</h2>
                    <p className="text-gray-400 text-sm">Create and manage community rewards</p>
                </div>
                <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
                    <button
                        onClick={() => { setActiveTab('active'); setSelectedGiveaway(null); }}
                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${activeTab === 'active' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => { setActiveTab('past'); setSelectedGiveaway(null); }}
                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${activeTab === 'past' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        Past
                    </button>
                    <button
                        onClick={() => { setActiveTab('create'); setSelectedGiveaway(null); }}
                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${activeTab === 'create' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                    >
                        + Create
                    </button>
                </div>
            </div>

            {/* Feedback */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg flex items-center gap-3">
                    <CheckCircle className="w-5 h-5" />
                    {success}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* List */}
                {activeTab !== 'create' && (
                    <div className="lg:col-span-1 space-y-4">
                        {filteredGiveaways.length === 0 ? (
                            <div className="bg-white/5 border border-white/10 p-8 rounded-xl text-center">
                                <Gift className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                                <p className="text-gray-500 font-medium">No giveaways found</p>
                            </div>
                        ) : (
                            filteredGiveaways.map(g => (
                                <div
                                    key={g.id}
                                    onClick={() => setSelectedGiveaway(g)}
                                    className={`bg-white/5 border p-4 rounded-xl cursor-pointer transition hover:bg-white/10 ${selectedGiveaway?.id === g.id ? 'border-white/30 ring-1 ring-white/20' : 'border-white/10'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-white">{g.title}</h3>
                                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${g.status === 'active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                                            g.status === 'upcoming' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                            }`}>
                                            {g.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400 mb-3">{g.prize}</p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {getGiveawayTicketCount(g.entries)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(g.endDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Detail/Create */}
                <div className={activeTab === 'create' ? 'lg:col-span-3' : 'lg:col-span-2'}>
                    {/* CREATE FORM */}
                    {activeTab === 'create' && (
                        <div className="bg-white/5 border border-white/10 p-6 rounded-xl max-w-2xl mx-auto backdrop-blur-sm">
                            <h3 className="font-bold text-xl uppercase mb-6 flex items-center gap-2 text-white">
                                <Plus className="w-5 h-5" /> Create New Giveaway
                            </h3>

                            <div className="space-y-4">
                                {/* Product Selector */}
                                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg">
                                    <label className="block text-xs font-bold uppercase mb-2 text-blue-400">Quick Select from Products</label>
                                    <select
                                        className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-white/30 outline-none"
                                        onChange={e => handleProductSelect(e.target.value)}
                                        defaultValue=""
                                        aria-label="Select product to auto-fill"
                                    >
                                        <option value="">-- Select a product to auto-fill --</option>
                                        {products.filter(p => !p.archived).map(product => (
                                            <option key={product.id} value={product.id}>
                                                {product.name} - ${product.price.toFixed(2)}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-2">Selecting a product will automatically fill in the title, prize, and description below.</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Title</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-white/30 outline-none"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="Weekly Merch Drop"
                                        aria-label="Giveaway Title"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase mb-2 text-gray-400">Prize</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-white/30 outline-none"
                                        value={formData.prize}
                                        onChange={e => setFormData({ ...formData, prize: e.target.value })}
                                        placeholder="Limited Edition Hoodie"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="giveaway-start" className="block text-xs font-bold uppercase mb-2 text-gray-400">Start Date & Time</label>
                                        <input
                                            id="giveaway-start"
                                            type="datetime-local"
                                            title="Giveaway Start Date"
                                            aria-label="Giveaway Start Date"
                                            className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-white/30 outline-none"
                                            value={formData.startDate}
                                            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="giveaway-end" className="block text-xs font-bold uppercase mb-2 text-gray-400">End Date & Time</label>
                                        <input
                                            id="giveaway-end"
                                            type="datetime-local"
                                            title="Giveaway End Date"
                                            aria-label="Giveaway End Date"
                                            className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-white/30 outline-none"
                                            value={formData.endDate}
                                            onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="giveaway-desc" className="block text-xs font-bold uppercase mb-2 text-gray-400">Description</label>
                                    <textarea
                                        id="giveaway-desc"
                                        title="Giveaway Description"
                                        aria-label="Giveaway Description"
                                        className="w-full bg-black/30 border border-white/10 p-3 rounded-lg text-white focus:border-white/30 outline-none"
                                        rows={3}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Enter giveaway details..."
                                    />
                                </div>

                                <button
                                    onClick={handleCreate}
                                    className="w-full bg-white text-black font-bold uppercase py-3 rounded-lg hover:bg-gray-200 transition mt-4"
                                >
                                    Launch Giveaway
                                </button>
                            </div>
                        </div>
                    )}

                    {/* DETAIL VIEW */}
                    {activeTab !== 'create' && selectedGiveaway && (
                        <div className="bg-white/5 border border-white/10 p-6 rounded-xl backdrop-blur-sm">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1 text-white">{selectedGiveaway.title}</h2>
                                    <p className="text-gray-400 text-lg">{selectedGiveaway.prize}</p>
                                </div>
                                <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
                                    <button
                                        onClick={() => setDetailTab('overview')}
                                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${detailTab === 'overview' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Overview
                                    </button>
                                    <button
                                        onClick={() => setDetailTab('entries')}
                                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${detailTab === 'entries' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Entries
                                    </button>
                                    <button
                                        onClick={() => setDetailTab('youtube-submissions')}
                                        className={`px-4 py-2 rounded font-bold text-xs uppercase transition ${detailTab === 'youtube-submissions' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Youtube Details
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => copyLink(selectedGiveaway.id)}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition"
                                        title="Copy Link"
                                    >
                                        <Copy className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(selectedGiveaway.id)}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded transition"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                <div className="bg-black/30 border border-white/10 p-4 rounded-lg">
                                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Total Tickets</div>
                                    <div className="text-2xl font-bold text-white">{getGiveawayTicketCount(selectedGiveaway.entries)}</div>
                                </div>
                                <div className="bg-black/30 border border-white/10 p-4 rounded-lg">
                                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Status</div>
                                    <div className="text-2xl font-bold capitalize text-white">{selectedGiveaway.status}</div>
                                </div>
                                <div className="bg-black/30 border border-white/10 p-4 rounded-lg">
                                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Days Left</div>
                                    <div className="text-2xl font-bold text-white">
                                        {Math.max(0, Math.ceil((new Date(selectedGiveaway.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                                    </div>
                                </div>
                            </div>

                            {/* Youtube/Access Portal Submissions Section */}
                            {detailTab === 'youtube-submissions' && (
                                <div className="mt-8 pt-8 border-t border-white/10">
                                    <h3 className="font-bold uppercase text-lg mb-4 text-white flex items-center gap-2 font-display italic">
                                        <Youtube className="w-5 h-5 text-red-500" />
                                        Access Portal Submissions
                                    </h3>
                                    <YoutubeSubmissionsTab 
                                        giveawayId={selectedGiveaway.id} 
                                        giveawayTitle={selectedGiveaway.title}
                                    />
                                </div>
                            )}

                            {/* Giveaway Entries Section */}
                            {detailTab === 'entries' && (
                                <div className="mt-8 pt-8 border-t border-white/10">
                                    <GiveawayEntriesTab giveawayId={selectedGiveaway.id} />
                                </div>
                            )}

                            {/* Overview Section */}
                            {detailTab === 'overview' && (
                                <>
                                    {/* Winners */}
                                    <div className="mb-8">
                                        <h3 className="font-bold uppercase text-lg mb-4 flex items-center gap-2 text-white font-display italic text-glow">
                                            <Trophy className="w-5 h-5 text-yellow-400" /> Winners Circle
                                        </h3>

                                        {selectedGiveaway.winners && selectedGiveaway.winners.length > 0 ? (
                                            <div className="space-y-4">
                                                {selectedGiveaway.winners.map((winner, idx) => (
                                                    <div key={idx} className="flex items-center justify-between bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl shadow-lg shadow-yellow-500/5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center font-black text-yellow-400 border border-yellow-500/20">
                                                                {winner.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <div className="font-black text-white uppercase tracking-tight">{winner.name}</div>
                                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{winner.email}</div>
                                                            </div>
                                                        </div>
                                                        <div className="bg-yellow-500 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                            Prize Claimed
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10 group hover:border-white/20 transition-all">
                                                <Trophy className="w-12 h-12 mx-auto text-gray-700 mb-4 group-hover:scale-110 transition-transform" />
                                                <p className="text-gray-500 font-black uppercase text-xs tracking-widest mb-6">No winners drawn yet.</p>
                                                <button
                                                    onClick={() => handlePickWinner(selectedGiveaway.id)}
                                                    className="bg-white text-black px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all shadow-xl shadow-white/5"
                                                >
                                                    Draw Winner
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Recent Activity/Entries */}
                                    <div>
                                        <h3 className="font-bold uppercase text-lg mb-4 text-white font-display italic">Recent Entries</h3>
                                        <div className="overflow-x-auto rounded-xl border border-white/10">
                                            <table className="w-full text-sm">
                                                <thead className="bg-white/5 text-gray-500 uppercase text-[10px] font-black tracking-widest">
                                                    <tr>
                                                        <th className="px-6 py-4 text-left">Name</th>
                                                        <th className="px-6 py-4 text-left">Email</th>
                                                        <th className="px-6 py-4 text-center">Weight</th>
                                                        <th className="px-6 py-4 text-right">Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {selectedGiveaway.entries.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-600 uppercase font-black text-[10px] tracking-widest">No public entries detected.</td>
                                                        </tr>
                                                    ) : (
                                                        selectedGiveaway.entries.slice(0, 10).map(entry => (
                                                            <tr key={entry.id} className="hover:bg-white/[0.02]">
                                                                <td className="px-6 py-4 font-black text-white uppercase">{entry.name}</td>
                                                                <td className="px-6 py-4 text-gray-500">{entry.email}</td>
                                                                <td className="px-6 py-4 text-center">
                                                                    <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-black text-white/50">
                                                                        {entry.entryCount}x
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-right text-gray-500 font-bold text-[10px]">
                                                                    {new Date(entry.timestamp).toLocaleDateString()}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Empty State */}
                    {activeTab !== 'create' && !selectedGiveaway && (
                        <div className="h-full flex items-center justify-center bg-white/5 rounded-xl border border-dashed border-white/10 p-12 text-center">
                            <div>
                                <Gift className="w-16 h-16 mx-auto text-gray-600 mb-4" />
                                <h3 className="font-bold text-xl text-gray-400 uppercase">Select a Giveaway</h3>
                                <p className="text-gray-500">Click on a giveaway to view details</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GiveawayManager;
