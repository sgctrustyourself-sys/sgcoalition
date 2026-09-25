import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export interface Signal {
    id: string; title: string; message: string;
    type: 'info' | 'alert' | 'success' | 'process' | 'urgent';
    is_active: boolean; action_url?: string; action_label?: string;
    created_at: string; metadata?: any;
}

export function useSignals(isSupabaseConfigured: boolean) {
    const [signals, setSignals] = useState<Signal[]>([]);

    const fetchSignals = async () => {
        if (!isSupabaseConfigured) return [];
        try {
            const { data, error } = await supabase
                .from('coalition_signals').select('*')
                .eq('is_active', true).order('created_at', { ascending: false });
            if (error) throw error;
            if (data) { setSignals(data); return data; }
            return [];
        } catch (err) { console.error('Error fetching signals:', err); return []; }
    };

    useEffect(() => {
        if (!isSupabaseConfigured) return;
        const ch = supabase.channel('coalition-signals-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'coalition_signals' }, () => fetchSignals())
            .subscribe();
        return () => { ch.unsubscribe(); };
    }, [isSupabaseConfigured]);

    return { signals, fetchSignals };
}
