import React, { useState, useEffect } from 'react';
import {
    Megaphone,
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    Zap,
    AlertCircle,
    Info,
    ExternalLink,
    Search,
    ToggleLeft,
    ToggleRight,
    Loader2
} from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useToast } from '../../context/ToastContext';
import { Signal } from '../../context/AppContext';
import { motion } from 'framer-motion';

const SignalManager: React.FC = () => {
    const { addToast } = useToast();
    const [signals, setSignals] = useState<Signal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [editingSignal, setEditingSignal] = useState<Signal | null>(null);
    const [formData, setFormData] = useState<Partial<Signal>>({
        title: '',
        message: '',
        type: 'info',
        is_active: true,
        action_url: '',
        action_label: 'Learn More'
    });

    useEffect(() => {
        fetchSignals();
    }, []);

    const fetchSignals = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('coalition_signals')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSignals(data || []);
        } catch (err: any) {
            addToast(err.message || 'Failed to fetch signals', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingSignal) {
                const { error } = await supabase
                    .from('coalition_signals')
                    .update(formData)
                    .eq('id', editingSignal.id);
                if (error) throw error;
                addToast('Signal updated successfully', 'success');
            } else {
                const { error } = await supabase
                    .from('coalition_signals')
                    .insert([formData]);
                if (error) throw error;
                addToast('Signal created successfully', 'success');
            }
            setShowForm(false);
            setEditingSignal(null);
            setFormData({ title: '', message: '', type: 'info', is_active: true, action_url: '', action_label: 'Learn More' });
            fetchSignals();
        } catch (err: any) {
            addToast(err.message || 'Failed to save signal', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (signal: Signal) => {
        try {
            const { error } = await supabase
                .from('coalition_signals')
                .update({ is_active: !signal.is_active })
                .eq('id', signal.id);
            if (error) throw error;
            setSignals(prev => prev.map(s => s.id === signal.id ? { ...s, is_active: !s.is_active } : s));
            addToast(`Signal ${!signal.is_active ? 'activated' : 'deactivated'}`, 'info');
        } catch (err: any) {
            addToast(err.message || 'Update failed', 'error');
        }
    };

    const deleteSignal = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this signal?')) return;
        try {
            const { error } = await supabase
                .from('coalition_signals')
                .delete()
                .eq('id', id);
            if (error) throw error;
            setSignals(prev => prev.filter(s => s.id !== id));
            addToast('Signal deleted', 'info');
        } catch (err: any) {
            addToast(err.message || 'Delete failed', 'error');
        }
    };

    const filteredSignals = signals.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'alert': return <AlertCircle className="w-4 h-4 text-amber-500" />;
            case 'success': return <Edit2 className="w-4 h-4 text-emerald-500" />;
            case 'process': return <Zap className="w-4 h-4 text-purple-500" />;
            case 'urgent': return <Megaphone className="w-4 h-4 text-red-500" />;
            default: return <Info className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black font-display uppercase tracking-widest text-white flex items-center gap-3">
                        <Megaphone className="w-6 h-6 text-brand-accent" />
                        Signal Broadcast Manager
                    </h2>
                    <p className="text-gray-400 text-xs mt-1 uppercase tracking-wider font-bold">Deploy global alerts and operational updates</p>
                </div>
                <button
                    onClick={() => {
                        setEditingSignal(null);
                        setFormData({ title: '', message: '', type: 'info', is_active: true, action_url: '', action_label: 'Learn More' });
                        setShowForm(true);
                    }}
                    className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-brand-accent transition-all"
                >
                    <Plus className="w-4 h-4" /> New Signal
                </button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Active Signals</p>
                    <p className="text-2xl font-black text-white">{signals.filter(s => s.is_active).length}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Scheduled/Drafts</p>
                    <p className="text-2xl font-black text-white">{signals.filter(s => !s.is_active).length}</p>
                </div>
                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Broadcast Capacity</p>
                    <p className="text-2xl font-black text-emerald-500">UNLIMITED</p>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                    type="text"
                    placeholder="Search broadcasts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white text-sm focus:outline-none focus:border-white/30"
                />
            </div>

            {/* List */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
                    </div>
                ) : filteredSignals.length === 0 ? (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
                        <p className="text-gray-500 uppercase tracking-widest text-xs font-bold">No active signals found</p>
                    </div>
                ) : (
                    filteredSignals.map(signal => (
                        <div
                            key={signal.id}
                            className={`group bg-white/5 border ${signal.is_active ? 'border-brand-accent/30' : 'border-white/10'} rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/30 transition-all`}
                        >
                            <div className="flex items-start gap-4 flex-1">
                                <div className={`p-2 rounded-xl bg-black/40 border border-white/10 mt-1`}>
                                    {getTypeIcon(signal.type)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-white uppercase tracking-tight">{signal.title}</h3>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${signal.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border border-white/10'
                                            }`}>
                                            {signal.is_active ? 'Live' : 'Inactive'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{signal.message}</p>
                                    <div className="flex items-center gap-4 mt-2">
                                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Type: {signal.type}</span>
                                        {signal.action_url && (
                                            <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest flex items-center gap-1">
                                                <ExternalLink className="w-3 h-3" /> Linked
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                                <button
                                    onClick={() => toggleStatus(signal)}
                                    aria-label={signal.is_active ? 'Deactivate signal' : 'Activate signal'}
                                    title={signal.is_active ? 'Deactivate' : 'Activate'}
                                >
                                    {signal.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingSignal(signal);
                                        setFormData(signal);
                                        setShowForm(true);
                                    }}
                                    aria-label="Edit signal"
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => deleteSignal(signal.id)}
                                    aria-label="Delete signal"
                                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal Form */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
                    >
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h3 className="font-display font-black uppercase tracking-widest text-lg">
                                {editingSignal ? 'Edit Signal' : 'Create New Signal'}
                            </h3>
                            <button
                                onClick={() => setShowForm(false)}
                                aria-label="Close modal"
                                className="p-2 hover:bg-white/5 rounded-full"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Title</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-brand-accent/50"
                                        placeholder="System Alert"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Type</label>
                                    <select
                                        aria-label="Signal Type"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                        className="w-full bg-zinc-800 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-brand-accent/50 appearance-none"
                                    >
                                        <option value="info">Information (Blue)</option>
                                        <option value="alert">Warning (Amber)</option>
                                        <option value="success">Success (Emerald)</option>
                                        <option value="process">Setup Process (Purple)</option>
                                        <option value="urgent">Urgent Broadcast (Red)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Message</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={formData.message}
                                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-brand-accent/50 resize-none"
                                    placeholder="Enter the signal content..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Action URL (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData.action_url}
                                        onChange={e => setFormData({ ...formData, action_url: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-brand-accent/50"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Action Label</label>
                                    <input
                                        type="text"
                                        value={formData.action_label}
                                        onChange={e => setFormData({ ...formData, action_label: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-brand-accent/50"
                                        placeholder="Learn More"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-4">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 rounded border-white/10 bg-white/5"
                                />
                                <label htmlFor="is_active" className="text-xs font-bold uppercase tracking-widest text-gray-400">Deploy immediately</label>
                            </div>

                            <div className="flex gap-3 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest py-3 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 bg-white hover:bg-brand-accent text-black font-black uppercase tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingSignal ? 'Update Broadcast' : 'Deploy Signal'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default SignalManager;
