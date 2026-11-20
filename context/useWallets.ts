// context/useWallets.ts
// Domain hook for Web3/Blockchain state — wallet mint tracker,
// production-floor status, and their Supabase realtime channels.
// Pure reducers are exported for unit-test SLA contracts.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

// Shape of the singleton production_state row (or null while loading).
export interface ProductionState {
    currently_being_built_label: string;
    last_drop_at:                string;   // ISO 8601 UTC timestamp
    last_drop_sku_label:         string;
    on_deck_label:               string;
    on_deck_cylinder_current:    number;
    on_deck_cylinder_total:      number;
}

/**
 * Pure reducer for wallet_mints_7d realtime payloads. Returns the next
 * count or `prev` if the payload is malformed. Exported so the SLA contract
 * can be unit-tested without spinning up React lifecycle / Supabase mocks.
 *
 *   null / undefined / empty raw => keep prev
 *   non-finite Number() (NaN, ±Infinity) => keep prev
 *   finite Number() => use it
 *
 * Supabase delivers PostgREST `bigint` columns as string OR number — both
 * accepted here so we don't surprise callers on either side of the wire.
 */
export function applyWalletMintsUpdate(
    prev: number | null,
    payload: { new?: { mint_count?: unknown } } | null | undefined
): number | null {
    const raw = payload?.new?.mint_count;
    if (raw == null || raw === '') return prev;
    const num = Number(raw);
    if (!Number.isFinite(num)) return prev;
    return num;
}

/**
 * Pure reducer for production_state realtime payloads. Maps the Supabase
 * UPDATE payload to a normalised ProductionState, or returns prev on any
 * missing/invalid field. Same SLA-correctness shape as applyWalletMintsUpdate.
 */
export function applyProductionStateUpdate(
    prev: ProductionState | null,
    payload: Record<string, unknown> | null | undefined
): ProductionState | null {
    if (!payload || typeof payload !== 'object') return prev;
    const next = payload as Partial<ProductionState> & { last_drop_at?: unknown };
    const readStr = (x: unknown): string => (typeof x === 'string' ? x : '');
    const readNum = (x: unknown): number | null => {
        if (typeof x === 'number' && Number.isFinite(x)) return x;
        if (typeof x === 'string' && x !== '') { const n = Number(x); if (Number.isFinite(n)) return n; }
        return null;
    };
    const labelOk  = readStr(next.currently_being_built_label) || (prev?.currently_being_built_label ?? '');
    const lastAtRaw = readStr(next.last_drop_at);
    const lastAt   = lastAtRaw || (prev?.last_drop_at ?? '');
    const lastSku  = readStr(next.last_drop_sku_label)  || (prev?.last_drop_sku_label ?? '');
    const onDeck   = readStr(next.on_deck_label)        || (prev?.on_deck_label ?? '');
    const curRaw   = readNum(next.on_deck_cylinder_current);
    const totRaw   = readNum(next.on_deck_cylinder_total);
    const cur      = curRaw ?? prev?.on_deck_cylinder_current ?? 0;
    const tot      = totRaw ?? prev?.on_deck_cylinder_total   ?? 1;
    if (!labelOk || !lastAt || !lastSku || !onDeck || tot <= 0) return prev;
    return { currently_being_built_label: labelOk, last_drop_at: lastAt, last_drop_sku_label: lastSku, on_deck_label: onDeck, on_deck_cylinder_current: cur, on_deck_cylinder_total: tot };
}

export function useWallets(isSupabaseConfigured: boolean) {
    const [walletMints7d, setWalletMints7d] = useState<number | null>(null);
    const [productionState, setProductionState] = useState<ProductionState | null>(null);

    const fetchWalletMints7d = useCallback(async () => {
        if (!isSupabaseConfigured) return 0;
        try {
            const { data, error } = await supabase.from('wallet_mints_7d').select('mint_count').maybeSingle();
            if (error) { console.warn('[wallet_mints_7d] fetch error:', error.message); return null; }
            const count = data?.mint_count != null ? Number(data.mint_count) : 0;
            setWalletMints7d(count);
            return count;
        } catch (e) { console.warn('[wallet_mints_7d] fetch threw:', e); return null; }
    }, [isSupabaseConfigured]);

    const fetchProductionState = useCallback(async () => {
        if (!isSupabaseConfigured) return null;
        try {
            const { data, error } = await supabase.from('production_state')
                .select('currently_being_built_label, last_drop_at, last_drop_sku_label, on_deck_label, on_deck_cylinder_current, on_deck_cylinder_total')
                .maybeSingle();
            if (error) { console.warn('[production_state] fetch error:', error.message); return null; }
            if (!data) return null;
            const lastDropAt = data.last_drop_at instanceof Date ? (data.last_drop_at as Date).toISOString() : String(data.last_drop_at ?? '');
            setProductionState({
                currently_being_built_label: String(data.currently_being_built_label ?? ''),
                last_drop_at: lastDropAt,
                last_drop_sku_label: String(data.last_drop_sku_label ?? ''),
                on_deck_label: String(data.on_deck_label ?? ''),
                on_deck_cylinder_current: Number(data.on_deck_cylinder_current ?? 0),
                on_deck_cylinder_total: Number(data.on_deck_cylinder_total ?? 0),
            });
            return data;
        } catch (e) { console.warn('[production_state] fetch threw:', e); return null; }
    }, [isSupabaseConfigured]);

    // Realtime wallet_mints_7d channel
    useEffect(() => {
        if (!isSupabaseConfigured) return;
        const channel = supabase.channel('wallet_mints_7d_sync')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallet_mints_7d' }, (payload) => {
                setWalletMints7d(prev => applyWalletMintsUpdate(prev, payload));
            }).subscribe();
        return () => { channel.unsubscribe(); };
    }, [isSupabaseConfigured]);

    // Realtime production_state channel
    useEffect(() => {
        if (!isSupabaseConfigured) return;
        const channel = supabase.channel('production_state_sync')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'production_state' }, (payload) => {
                const next = (payload?.new ?? {}) as Record<string, unknown>;
                setProductionState(prev => applyProductionStateUpdate(prev, next));
            }).subscribe();
        return () => { channel.unsubscribe(); };
    }, [isSupabaseConfigured]);

    return { walletMints7d, productionState, fetchWalletMints7d, fetchProductionState };
}
