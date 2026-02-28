import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Giveaway, GiveawayStatus, GiveawayEntry } from '../types';
import { Plus, Gift, Calendar, Users, Trophy, Trash2, ExternalLink, Copy, Check } from 'lucide-react';

const Giveaways: React.FC = () => {
    const { giveaways, addGiveaway, deleteGiveaway, pickGiveawayWinner } = useApp();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'active' | 'past' | 'create'>('active');
    const [selectedGiveaway, setSelectedGiveaway] = useState<Giveaway | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Giveaway>>({
        title: '',
        prize: '',
        description: '',
        maxEntriesPerUser: 1,
        requirements: ['Join Discord', 'Follow on Twitter'],
        prizeImage: ''
    });

    const handleCreate = async () => {
        if (!formData.title || !formData.prize || !formData.startDate || !formData.endDate) {
            addToast('Please fill in all required fields', 'warning');
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
        setActiveTab('active');
        setFormData({
            title: '',
            prize: '',
            description: '',
            maxEntriesPerUser: 1,
            requirements: ['Join Discord', 'Follow on Twitter'],
            prizeImage: ''
        });
    };

    const handlePickWinner = async (id: string) => {
        if (window.confirm('Are you sure you want to pick a winner? This cannot be undone.')) {
            await pickGiveawayWinner(id, 1);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete this giveaway?')) {
            await deleteGiveaway(id);
            if (selectedGiveaway?.id === id) setSelectedGiveaway(null);
        }
    };

    const copyLink = (id: string) => {
        const link = `${window.location.origin}/#/ecosystem?giveaway=${id}`;
        navigator.clipboard.writeText(link);
        addToast('Giveaway link copied to clipboard!', 'success');
    };

    const filteredGiveaways = giveaways.filter(g => {
        if (activeTab === 'active') return g.status !== GiveawayStatus.ENDED;
        if (activeTab === 'past') return g.status === GiveawayStatus.ENDED;
        return false;
    });

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold uppercase font-display">Giveaway Management</h2>
                    <p className="text-gray-600">Create and manage community rewards</p>
                </div>
                <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
                    <button
                        onClick={() => { setActiveTab('active'); setSelectedGiveaway(null); }}
                        className={`px-4 py-2 rounded font-bold text-sm uppercase transition ${activeTab === 'active' ? 'bg-black text-white' : 'text-gray-500 hover:text-black'}`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => { setActiveTab('past'); setSelectedGiveaway(null); }}
                        className={`px-4 py-2 rounded font-bold text-sm uppercase transition ${activeTab === 'past' ? 'bg-black text-white' : 'text-gray-500 hover:text-black'}`}
                    >
                        Past
                    </button>
                    <button
                        onClick={() => { setActiveTab('create'); setSelectedGiveaway(null); }}
                        className={`px-4 py-2 rounded font-bold text-sm uppercase transition ${activeTab === 'create' ? 'bg-black text-white' : 'text-gray-500 hover:text-black'}`}
                    >
                        + Create New
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: List */}
                {activeTab !== 'create' && (
                    <div className="lg:col-span-1 space-y-4">
                        {filteredGiveaways.length === 0 ? (
                            <div className="bg-white p-8 rounded-lg shadow-sm text-center border border-gray-200">
                                <Gift className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                <p className="text-gray-500 font-medium">No giveaways found</p>
                            </div>
                        ) : (
                            filteredGiveaways.map(g => (
                                <div
                                    key={g.id}
                                    onClick={() => setSelectedGiveaway(g)}
                                    className={`bg-white p-4 rounded-lg shadow-sm border cursor-pointer transition hover:shadow-md ${selectedGiveaway?.id === g.id ? 'border-black ring-1 ring-black' : 'border-gray-200'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg">{g.title}</h3>
                                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${g.status === 'active' ? 'bg-green-100 text-green-800' :
                                            g.status === 'upcoming' ? 'bg-blue-100 text-blue-800' :
                                                'bg-gray-100 text-gray-800'
                                            }`}>
                                            {g.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-3">{g.prize}</p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {g.entries.length} Entries
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            Ends {new Date(g.endDate).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Right Column: Detail or Create Form */}
                <div className={activeTab === 'create' ? 'lg:col-span-3' : 'lg:col-span-2'}>

                    {/* CREATE FORM */}
                    {activeTab === 'create' && (
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 max-w-2xl mx-auto">
                            <h3 className="font-bold text-xl uppercase mb-6 flex items-center gap-2">
                                <Plus className="w-5 h-5" /> Create New Giveaway
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold uppercase mb-1">Title</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="e.g. Weekly Merch Drop"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold uppercase mb-1">Prize</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        value={formData.prize}
                                        onChange={e => setFormData({ ...formData, prize: e.target.value })}
                                        placeholder="e.g. Limited Edition Hoodie"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold uppercase mb-1">Start Date</label>
                                        <input
                                            type="date"
                                            className="w-full border p-2 rounded"
                                            value={formData.startDate}
                                            onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold uppercase mb-1">End Date</label>
                                        <input
                                            type="date"
                                            className="w-full border p-2 rounded"
                                            value={formData.endDate}
                                            onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold uppercase mb-1">Description</label>
                                    <textarea
                                        className="w-full border p-2 rounded"
                                        rows={3}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold uppercase mb-1">Prize Image URL</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        value={formData.prizeImage}
                                        onChange={e => setFormData({ ...formData, prizeImage: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>

                                <button
                                    onClick={handleCreate}
                                    className="w-full bg-black text-white font-bold uppercase py-3 rounded hover:bg-gray-800 transition mt-4"
                                >
                                    Launch Giveaway
                                </button>
                            </div>
                        </div>
                    )}

                    {/* DETAIL VIEW */}
                    {activeTab !== 'create' && selectedGiveaway && (
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">{selectedGiveaway.title}</h2>
                                    <p className="text-gray-600 text-lg">{selectedGiveaway.prize}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => copyLink(selectedGiveaway.id)}
                                        className="p-2 text-gray-500 hover:text-black border rounded hover:bg-gray-50"
                                        title="Copy Link"
                                    >
                                        <Copy className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(selectedGiveaway.id)}
                                        className="p-2 text-red-500 hover:text-red-700 border rounded hover:bg-red-50"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                <div className="bg-gray-50 p-4 rounded border">
                                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Total Entries</div>
                                    <div className="text-2xl font-bold">{selectedGiveaway.entries.length}</div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded border">
                                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Status</div>
                                    <div className="text-2xl font-bold capitalize">{selectedGiveaway.status}</div>
                                </div>
                                <div className="bg-gray-50 p-4 rounded border">
                                    <div className="text-gray-500 text-xs font-bold uppercase mb-1">Days Left</div>
                                    <div className="text-2xl font-bold">
                                        {Math.max(0, Math.ceil((new Date(selectedGiveaway.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}
                                    </div>
                                </div>
                            </div>

                            {/* Winners Section */}
                            <div className="mb-8">
                                <h3 className="font-bold uppercase text-lg mb-4 flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-yellow-500" /> Winners
                                </h3>

                                {selectedGiveaway.winners && selectedGiveaway.winners.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedGiveaway.winners.map((winner, idx) => (
                                            <div key={idx} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 p-3 rounded">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-yellow-200 rounded-full flex items-center justify-center font-bold text-yellow-800">
                                                        {winner.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold">{winner.name}</div>
                                                        <div className="text-xs text-gray-600">{winner.email}</div>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-yellow-800 font-mono">
                                                    {new Date().toLocaleDateString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 bg-gray-50 rounded border border-dashed border-gray-300">
                                        <p className="text-gray-500 mb-4">No winners selected yet.</p>
                                        <button
                                            onClick={() => handlePickWinner(selectedGiveaway.id)}
                                            className="bg-black text-white px-6 py-2 rounded font-bold uppercase hover:bg-gray-800 transition"
                                        >
                                            Pick Random Winner
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Entries List */}
                            <div>
                                <h3 className="font-bold uppercase text-lg mb-4">Recent Entries</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-3 text-left">Name</th>
                                                <th className="p-3 text-left">Email</th>
                                                <th className="p-3 text-left">Source</th>
                                                <th className="p-3 text-right">Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedGiveaway.entries.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="p-4 text-center text-gray-500">No entries yet.</td>
                                                </tr>
                                            ) : (
                                                selectedGiveaway.entries.slice(0, 10).map(entry => (
                                                    <tr key={entry.id} className="border-b">
                                                        <td className="p-3 font-medium">{entry.name}</td>
                                                        <td className="p-3 text-gray-600">{entry.email}</td>
                                                        <td className="p-3 capitalize">
                                                            <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                                                                {entry.source}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right text-gray-500">
                                                            {new Date(entry.timestamp).toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty State for Detail View */}
                    {activeTab !== 'create' && !selectedGiveaway && (
                        <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
                            <div>
                                <Gift className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                                <h3 className="font-bold text-xl text-gray-400 uppercase">Select a Giveaway</h3>
                                <p className="text-gray-400">Click on a giveaway from the list to view details</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Giveaways;
