import { supabase } from './supabase';

export type BrainCategory = 'product_design' | 'brand_guidelines' | 'chat_insight' | 'creative_direction' | 'general';
export type BrainSource = 'ai_chat' | 'manual' | 'product' | 'design_session';

export interface BrainEntry {
    id: string;
    category: BrainCategory;
    title: string;
    content: string;
    tags: string[];
    source: BrainSource;
    importance: number;
    image_url?: string;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
    user_id?: string;
}

export interface BrainEntryInput {
    category: BrainCategory;
    title: string;
    content: string;
    tags?: string[];
    source?: BrainSource;
    importance?: number;
    image_url?: string;
    metadata?: Record<string, any>;
}

export const BRAIN_CATEGORIES: { value: BrainCategory; label: string; description: string }[] = [
    { value: 'product_design', label: 'Product Design', description: 'Design decisions, specs, materials, and creative direction for products' },
    { value: 'brand_guidelines', label: 'Brand Guidelines', description: 'Brand voice, visual identity, color palettes, typography, and tone' },
    { value: 'chat_insight', label: 'Chat Insight', description: 'Important context extracted from AI chat conversations and customer interactions' },
    { value: 'creative_direction', label: 'Creative Direction', description: 'Moodboards, inspiration, creative strategy, and artistic vision' },
    { value: 'general', label: 'General Knowledge', description: 'Miscellaneous knowledge, decisions, and context about the brand' },
];

export async function getBrainEntries(category?: BrainCategory): Promise<BrainEntry[]> {
    let query = supabase.from('brain_entries').select('*').order('importance', { ascending: false }).order('updated_at', { ascending: false });
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) { console.error('Error fetching brain entries:', error); throw new Error('Failed to fetch brain entries'); }
    return data || [];
}

export async function getBrainEntry(id: string): Promise<BrainEntry | null> {
    const { data, error } = await supabase.from('brain_entries').select('*').eq('id', id).single();
    if (error) { console.error('Error fetching brain entry:', error); return null; }
    return data;
}

export async function createBrainEntry(input: BrainEntryInput): Promise<string> {
    const insertData: Record<string, any> = {
        category: input.category, title: input.title, content: input.content,
        tags: input.tags || [], source: input.source || 'manual',
        importance: input.importance || 3, image_url: input.image_url || null,
        metadata: input.metadata || {},
    };
    const { data: { user } } = await supabase.auth.getUser();
    if (user) (insertData as any).user_id = user.id;
    const { data, error } = await supabase.from('brain_entries').insert([insertData]).select().single();
    if (error) { console.error('Error creating brain entry:', error); throw new Error('Failed to create brain entry'); }
    return data.id;
}

export async function updateBrainEntry(id: string, updates: Partial<BrainEntryInput>): Promise<void> {
    const updateData: Record<string, any> = {};
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.source !== undefined) updateData.source = updates.source;
    if (updates.importance !== undefined) updateData.importance = updates.importance;
    if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
    updateData.updated_at = new Date().toISOString();
    const { error } = await supabase.from('brain_entries').update(updateData).eq('id', id);
    if (error) { console.error('Error updating brain entry:', error); throw new Error('Failed to update brain entry'); }
}

export async function deleteBrainEntry(id: string): Promise<void> {
    const { error } = await supabase.from('brain_entries').delete().eq('id', id);
    if (error) { console.error('Error deleting brain entry:', error); throw new Error('Failed to delete brain entry'); }
}

export async function searchBrainEntries(query: string): Promise<BrainEntry[]> {
    const { data, error } = await supabase.from('brain_entries').select('*')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order('importance', { ascending: false }).limit(20);
    if (error) { console.error('Error searching brain entries:', error); return []; }
    return data || [];
}

export async function saveChatInsight(title: string, content: string, tags: string[] = [], importance: number = 3): Promise<string | null> {
    try { return await createBrainEntry({ category: 'chat_insight', title, content, tags: tags || [], source: 'ai_chat', importance: importance || 3 }); }
    catch (err) { console.error('Error saving chat insight:', err); return null; }
}

export async function getRelevantBrainEntries(topic: string, limit: number = 5): Promise<BrainEntry[]> {
    const searchTerms = topic.split(' ').filter(t => t.length > 2).slice(0, 3);
    if (searchTerms.length === 0) return [];
    const conditions = searchTerms.map(term => `title.ilike.%${term}%,content.ilike.%${term}%`).join(',');
    const { data, error } = await supabase.from('brain_entries').select('*').or(conditions).order('importance', { ascending: false }).limit(limit);
    if (error) { console.error('Error getting relevant brain entries:', error); return []; }
    return data || [];
}
