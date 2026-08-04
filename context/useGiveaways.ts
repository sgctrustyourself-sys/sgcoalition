// context/useGiveaways.ts
import { useState, useEffect } from 'react';
import { Giveaway, GiveawayEntry, GiveawayStatus, UserProfile } from '../types';
import { supabase } from '../services/supabase';
import { ensureSubscriberGiveawayEntries, pickWeightedGiveawayWinners } from '../utils/giveawayUtils';

export function useGiveaways(isSupabaseConfigured: boolean, user: UserProfile | null) {
    const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
    const fetchGiveaways = async () => {
        try {
            const { data, error } = await supabase.from('giveaways').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (data && data.length > 0) {
                setGiveaways(data.map((row: any) => ({
                    id: row.id, title: row.title, prize: row.prize,
                    description: row.description || '', prizeImage: row.prize_image || '',
                    startDate: row.start_date, endDate: row.end_date,
                    status: row.status as GiveawayStatus,
                    requirements: row.requirements || [],
                    maxEntriesPerUser: row.max_entries_per_user || 1,
                    entries: [] as GiveawayEntry[],
                    createdAt: new Date(row.created_at).getTime(),
                })));
            }
        } catch (err) { console.error('Error fetching giveaways:', err); }
    };
    useEffect(() => { if (giveaways.length > 0) localStorage.setItem('coalition_giveaways_v1', JSON.stringify(giveaways)); }, [giveaways]);
    useEffect(() => { setGiveaways(prev => ensureSubscriberGiveawayEntries(prev, user)); }, [user]);
    useEffect(() => {
        if (!isSupabaseConfigured) return;
        const ch = supabase.channel('coalition-giveaways-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'giveaways' }, () => fetchGiveaways())
            .subscribe();
        return () => { ch.unsubscribe(); };
    }, [isSupabaseConfigured]);
    const addGiveaway = async (g: Giveaway) => setGiveaways(prev => [...prev, g]);
    const updateGiveaway = async (g: Giveaway) => setGiveaways(prev => prev.map(i => i.id === g.id ? g : i));
    const deleteGiveaway = async (id: string) => setGiveaways(prev => prev.filter(g => g.id !== id));
    const addGiveawayEntry = async (e: GiveawayEntry) => setGiveaways(prev => prev.map(g => g.id === e.giveawayId ? { ...g, entries: [...g.entries, e] } : g));
    const pickGiveawayWinner = async (id: string, count: number) => {
        setGiveaways(prev => prev.map(g => {
            if (g.id === id) {
                const winners = pickWeightedGiveawayWinners(g.entries, count);
                return { ...g, winners, status: GiveawayStatus.ENDED };
            }
            return g;
        }));
    };
    return { giveaways, fetchGiveaways, addGiveaway, updateGiveaway, deleteGiveaway, addGiveawayEntry, pickGiveawayWinner };
}
