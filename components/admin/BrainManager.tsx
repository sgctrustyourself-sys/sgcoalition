import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { BrainEntry, BrainEntryInput, BrainCategory, BrainSource, BRAIN_CATEGORIES, createBrainEntry, updateBrainEntry, deleteBrainEntry } from '../../services/brainService';
import { Plus, Edit2, Trash2, Save, X, Brain, Search, Filter, Star, Loader, Tag } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const SOURCE_LABELS: Record<BrainSource, string> = {
    ai_chat: 'AI Chat', manual: 'Manual Entry', product: 'Product Design', design_session: 'Design Session',
};

const CATEGORY_COLORS: Record<BrainCategory, string> = {
    product_design: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    brand_guidelines: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
    chat_insight: 'bg-green-500/10 border-green-500/30 text-green-400',
    creative_direction: 'bg-pink-500/10 border-pink-500/30 text-pink-400',
    general: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
};

const ImportanceStars: React.FC<{ importance: number; onChange?: (v: number) => void }> = ({ importance, onChange }) => (
    <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
            <button key={i} type="button" disabled={!onChange} onClick={() => onChange?.(i)} className={onChange ? 'cursor-pointer hover:scale-110 transition-colors' : 'cursor-default'}>
                {i <= importance ? (
                    <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ) : (
                    <Star className="w-4 h-4 text-gray-600" />
                )}
            </button>
        ))}
    </div>
);

const BrainManager: React.FC = () => {
    const { addToast } = useToast();
    const [entries, setEntries] = useState<BrainEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<BrainCategory | 'all'>('all');
    const [currentEntry, setCurrentEntry] = useState<BrainEntryInput & { id?: string }>({
        category: 'general', title: '', content: '', tags: [], source: 'manual', importance: 3,
    });
    const [tagInput, setTagInput] = useState('');

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

    const handleSave = async () => {
        if (!currentEntry.title || !currentEntry.content) { addToast('Title and content are required.', 'error'); return; }
        setIsSaving(true);
        try {
            if (currentEntry.id) { await updateBrainEntry(currentEntry.id, currentEntry); addToast('Brain entry updated!', 'success'); }
            else { await createBrainEntry(currentEntry); addToast('Brain entry created!', 'success'); }
            setIsEditing(false); fetchEntries();
        } catch (err: any) { addToast('Save failed: ' + err.message, 'error'); }
        finally { setIsSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this brain entry?')) return;
        try { await deleteBrainEntry(id); addToast('Entry deleted.', 'success'); fetchEntries(); }
        catch (err: any) { addToast('Delete failed: ' + err.message, 'error'); }
    };

    const addTag = () => {
        const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (tag && !currentEntry.tags?.includes(tag)) setCurrentEntry(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }));
        setTagInput('');
    };

    const removeTag = (tag: string) => setCurrentEntry(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
    const handleTagKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } };

    const filteredEntries = entries.filter(entry => {
        const matchesCategory = filterCategory === 'all' || entry.category === filterCategory;
        const matchesSearch = !searchQuery || entry.title.toLowerCase().includes(searchQuery.toLowerCase()) || entry.content.toLowerCase().includes(searchQuery.toLowerCase()) || (entry.tags || []).some(t => t.includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    if (isLoading && !isEditing) {
        return (
            <div className="flex flex-col items-center justify-center p-20">
                <Brain className="w-8 h-8 text-purple-500 animate-pulse mb-4" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Loading Coalition Brain...</span>
            </div>
        );
    }

    return (
        <div className="bg-black/40 border border-white/5 rounded-3xl p-8 backdrop-blur-xl">
            <div className="flex justify-between items-center mb-10">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center">
                            <Brain className="w-5 h-5 text-purple-400" />
                        </div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter">Coalition Brain</h2>
                    </div>
                    <p className="text-gray-500 text-xs uppercase tracking-widest mt-1">Persistent knowledge base — product designs, brand guidelines, chat insights</p>
                </div>
                {!isEditing && (
                    <button onClick={() => { setCurrentEntry({ category: 'general', title: '', content: '', tags: [], source: 'manual', importance: 3 }); setIsEditing(true); }}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all">
                        <Plus className="w-4 h-4" /> New Entry
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="space-y-8">
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="md:col-span-2 space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Entry Title</label>
                                <input type="text" value={currentEntry.title} onChange={(e) => setCurrentEntry({ ...currentEntry, title: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all" placeholder="e.g., NF-Tee Design Philosophy" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Content (Markdown supported)</label>
                                <textarea value={currentEntry.content} onChange={(e) => setCurrentEntry({ ...currentEntry, content: e.target.value })}
                                    className="w-full h-64 bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all font-mono" placeholder="Write the knowledge entry content..." />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Tags</label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {(currentEntry.tags || []).map(tag => (
                                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-[10px] font-bold text-purple-400 uppercase">
                                            {tag} <button onClick={() => removeTag(tag)} className="hover:text-white transition-colors"><X className="w-3 h-3" /></button>
                                        </span>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown}
                                        placeholder="Add tag and press Enter..." className="flex-1 bg-white/5 border border-white/10 rounded-sm px-4 py-2 text-xs focus:border-purple-500 outline-none" />
                                    <button onClick={addTag} className="px-4 py-2 bg-white/5 border border-white/10 rounded-sm text-xs font-bold uppercase hover:bg-white/10 transition-all"><Tag className="w-3 h-3" /></button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Category</label>
                                <select value={currentEntry.category} onChange={(e) => setCurrentEntry({ ...currentEntry, category: e.target.value as BrainCategory })}
                                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all appearance-none" title="Select Category">
                                    {BRAIN_CATEGORIES.map(cat => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
                                </select>
                                <p className="text-[9px] text-gray-600 mt-2 leading-relaxed">{BRAIN_CATEGORIES.find(c => c.value === currentEntry.category)?.description}</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Source</label>
                                <select value={currentEntry.source} onChange={(e) => setCurrentEntry({ ...currentEntry, source: e.target.value as BrainSource })}
                                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all appearance-none" title="Select Source">
                                    {Object.entries(SOURCE_LABELS).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Importance</label>
                                <ImportanceStars importance={currentEntry.importance || 3} onChange={(v) => setCurrentEntry({ ...currentEntry, importance: v })} />
                                <p className="text-[9px] text-gray-600 mt-1">Higher importance entries appear first</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Image URL (optional)</label>
                                <input type="text" value={currentEntry.image_url || ''} onChange={(e) => setCurrentEntry({ ...currentEntry, image_url: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all" placeholder="https://..." />
                                {currentEntry.image_url && <img src={currentEntry.image_url} alt="Preview" className="mt-3 w-full h-32 object-cover rounded-sm border border-white/10" />}
                            </div>
                            <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                                <button onClick={handleSave} disabled={isSaving}
                                    className="w-full bg-white text-black font-black uppercase py-4 text-[11px] tracking-[0.2em] hover:bg-gray-200 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                    {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {currentEntry.id ? 'Update Entry' : 'Save Entry'}
                                </button>
                                <button onClick={() => setIsEditing(false)}
                                    className="w-full border border-white/10 text-gray-400 font-bold uppercase py-4 text-[11px] tracking-[0.2em] hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                                    <X className="w-4 h-4" /> Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex flex-col md:flex-row gap-4 mb-8">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search brain..."
                                className="w-full bg-white/5 border border-white/10 rounded-sm pl-10 pr-4 py-3 text-sm focus:border-purple-500 outline-none transition-all" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-500" />
                            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as BrainCategory | 'all')}
                                className="bg-white/5 border border-white/10 rounded-sm px-4 py-3 text-sm focus:border-purple-500 outline-none transition-all appearance-none" title="Filter by Category">
                                <option value="all">All Categories</option>
                                {BRAIN_CATEGORIES.map(cat => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-center">
                            <div className="text-2xl font-black">{entries.length}</div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mt-1">Total</div>
                        </div>
                        {BRAIN_CATEGORIES.map(cat => {
                            const count = entries.filter(e => e.category === cat.value).length;
                            return (
                                <div key={cat.value} className={CATEGORY_COLORS[cat.value] + ' bg-opacity-10 border rounded-xl p-4 text-center'}>
                                    <div className="text-2xl font-black">{count}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-widest mt-1 opacity-80">{cat.label}</div>
                                </div>
                            );
                        })}
                    </div>

                    {filteredEntries.length > 0 ? (
                        <div className="grid md:grid-cols-2 gap-4">
                            {filteredEntries.map((entry) => (
                                <div key={entry.id} className="group bg-white/[0.02] border border-white/5 rounded-xl p-6 hover:border-purple-500/20 transition-all relative">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className={'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ' + CATEGORY_COLORS[entry.category]}>
                                                {BRAIN_CATEGORIES.find(c => c.value === entry.category)?.label}
                                            </span>
                                            <span className="text-[9px] text-gray-600 font-mono">{SOURCE_LABELS[entry.source]}</span>
                                        </div>
                                        <ImportanceStars importance={entry.importance} />
                                    </div>
                                    <h3 className="font-bold text-sm uppercase tracking-tight mb-2 text-white">{entry.title}</h3>
                                    <p className="text-xs text-gray-400 line-clamp-3 mb-4 leading-relaxed">{entry.content.substring(0, 200)}</p>
                                    {(entry.tags || []).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            {entry.tags.map(tag => (<span key={tag} className="px-2 py-0.5 bg-white/5 rounded-full text-[9px] text-gray-500 font-mono">#{tag}</span>))}
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-[9px] text-gray-600 font-mono">
                                        <span>{new Date(entry.updated_at).toLocaleDateString()}</span>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setCurrentEntry({ id: entry.id, category: entry.category, title: entry.title, content: entry.content, tags: entry.tags, source: entry.source, importance: entry.importance, image_url: entry.image_url, metadata: entry.metadata }); setIsEditing(true); }}
                                                className="p-1.5 border border-white/10 rounded-sm hover:bg-white hover:text-black transition-all" title="Edit"><Edit2 className="w-3 h-3" /></button>
                                            <button onClick={() => handleDelete(entry.id)}
                                                className="p-1.5 border border-white/10 rounded-sm hover:bg-red-500 hover:text-white transition-all" title="Delete"><Trash2 className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <Brain className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                            <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">{searchQuery ? 'No entries match your search.' : 'The brain is empty. Start building knowledge!'}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default BrainManager;
