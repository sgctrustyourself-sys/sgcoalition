import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { BrainEntry, BrainCategory, BRAIN_CATEGORIES } from '../services/brainService';
import { Brain, Search, Star, Sparkles, ArrowRight } from 'lucide-react';

const CATEGORY_COLORS: Record<BrainCategory, string> = {
    product_design: 'from-blue-600 to-cyan-500',
    brand_guidelines: 'from-purple-600 to-pink-500',
    chat_insight: 'from-green-600 to-emerald-500',
    creative_direction: 'from-pink-600 to-rose-500',
    general: 'from-gray-600 to-gray-400',
};

const CATEGORY_BG: Record<BrainCategory, string> = {
    product_design: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    brand_guidelines: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    chat_insight: 'bg-green-500/10 border-green-500/30 text-green-400',
    creative_direction: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
    general: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
};

const BrainPage: React.FC = () => {
    const [entries, setEntries] = useState<BrainEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<BrainCategory | 'all'>('all');
    const [selectedEntry, setSelectedEntry] = useState<BrainEntry | null>(null);

    useEffect(() => { fetchEntries(); }, []);

    const fetchEntries = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.from('brain_entries').select('*').order('importance', { ascending: false }).order('updated_at', { ascending: false });
            if (error) throw error;
            setEntries(data || []);
        } catch (err) { console.error('Error fetching brain entries:', err); }
        finally { setIsLoading(false); }
    };

    const filteredEntries = entries.filter(entry => {
        const matchesCategory = filterCategory === 'all' || entry.category === filterCategory;
        const matchesSearch = !searchQuery || entry.title.toLowerCase().includes(searchQuery.toLowerCase()) || entry.content.toLowerCase().includes(searchQuery.toLowerCase()) || (entry.tags || []).some(t => t.includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <Brain className="w-16 h-16 text-purple-500 animate-pulse mx-auto mb-6" />
                    <h1 className="text-2xl font-black uppercase tracking-tighter text-white">Loading Coalition Brain...</h1>
                </div>
            </div>
        );
    }

    if (selectedEntry) {
        return (
            <div className="min-h-screen bg-black text-white">
                <div className="max-w-4xl mx-auto px-4 py-16">
                    <button onClick={() => setSelectedEntry(null)} className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 transition text-xs font-bold uppercase tracking-widest">
                        &larr; Back to Brain
                    </button>
                    <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-8 md:p-12">
                        <div className="flex items-center gap-3 mb-6">
                            <span className={'px-3 py-1 rounded-full text-[10px] font-bold uppercase border ' + CATEGORY_BG[selectedEntry.category]}>
                                {BRAIN_CATEGORIES.find(c => c.value === selectedEntry.category)?.label}
                            </span>
                            <span className="text-xs text-gray-600 font-mono">{new Date(selectedEntry.created_at).toLocaleDateString()}</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-6">{selectedEntry.title}</h1>
                        {(selectedEntry.tags || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-8">
                                {selectedEntry.tags.map(tag => (<span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-gray-400">#{tag}</span>))}
                            </div>
                        )}
                        {selectedEntry.image_url && (<img src={selectedEntry.image_url} alt={selectedEntry.title} className="w-full max-h-96 object-cover rounded-2xl mb-8 border border-white/10" />)}
                        <div className="prose prose-invert max-w-none">
                            <div className="text-gray-300 leading-relaxed text-lg whitespace-pre-wrap">{selectedEntry.content}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white selection:bg-purple-500/30">
            <section className="relative py-24 md:py-32 px-4 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-black to-black pointer-events-none"></div>
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl"></div>
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-3 mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-900/20 rotate-3">
                            <Brain className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h1 className="font-display text-5xl md:text-7xl font-black uppercase mb-6 tracking-tighter">
                        Coalition <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Brain</span>
                    </h1>
                    <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        The persistent knowledge base of SG Coalition. Product designs, brand guidelines, creative direction, and insights preserved and searchable.
                    </p>
                </div>
            </section>

            <section className="max-w-6xl mx-auto px-4 pb-8">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search the Coalition Brain..."
                            className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-12 pr-4 py-4 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setFilterCategory('all')}
                            className={'px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ' + (filterCategory === 'all' ? 'bg-white text-black' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600')}>All</button>
                        {BRAIN_CATEGORIES.map(cat => (
                            <button key={cat.value} onClick={() => setFilterCategory(cat.value)}
                                className={'px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ' + (filterCategory === cat.value ? 'bg-white text-black shadow-lg' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600')}>{cat.label}</button>
                        ))}
                    </div>
                </div>
            </section>

            <section className="max-w-6xl mx-auto px-4 pb-24">
                {filteredEntries.length > 0 ? (
                    <>
                        <div className="flex items-center justify-between mb-8">
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{filteredEntries.length} knowledge {filteredEntries.length === 1 ? 'entry' : 'entries'}</p>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredEntries.map((entry) => (
                                <button key={entry.id} onClick={() => setSelectedEntry(entry)}
                                    className="group bg-gray-900/50 border border-gray-800 rounded-2xl p-6 text-left hover:border-purple-500/30 transition-all hover:bg-gray-900/80 relative overflow-hidden">
                                    <div className={'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ' + CATEGORY_COLORS[entry.category]}></div>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ' + CATEGORY_BG[entry.category]}>
                                            {BRAIN_CATEGORIES.find(c => c.value === entry.category)?.label}
                                        </span>
                                        <div className="flex items-center gap-0.5 ml-auto">
                                            {Array.from({ length: entry.importance }).map((_, i) => (<Star key={i} className="w-3 h-3 text-yellow-400 fill-current" />))}
                                        </div>
                                    </div>
                                    <h3 className="font-bold text-lg uppercase tracking-tight mb-2 text-white group-hover:text-purple-300 transition-colors">{entry.title}</h3>
                                    <p className="text-sm text-gray-400 line-clamp-2 mb-4 leading-relaxed">{entry.content.substring(0, 150)}</p>
                                    {(entry.tags || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {entry.tags.slice(0, 3).map(tag => (<span key={tag} className="px-2 py-0.5 bg-white/5 rounded-full text-[9px] text-gray-500 font-mono">#{tag}</span>))}
                                            {entry.tags.length > 3 && <span className="text-[9px] text-gray-600">+{entry.tags.length - 3}</span>}
                                        </div>
                                    )}
                                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ArrowRight className="w-5 h-5 text-purple-400" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="text-center py-24">
                        <Brain className="w-16 h-16 text-gray-800 mx-auto mb-6" />
                        <h2 className="text-xl font-black uppercase tracking-tighter text-gray-600 mb-2">Empty Mind</h2>
                        <p className="text-gray-700 text-sm">{searchQuery ? 'No entries match your search.' : 'The brain awaits knowledge. Entries will appear here as they are added.'}</p>
                    </div>
                )}
            </section>

            <section className="py-16 px-4 border-t border-white/5">
                <div className="max-w-2xl mx-auto text-center">
                    <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-4" />
                    <p className="text-gray-500 text-sm leading-relaxed">The Coalition Brain grows with every design session, brand decision, and customer insight.</p>
                </div>
            </section>
        </div>
    );
};

export default BrainPage;
