// tests/catalogVisibilityRefresh.test.tsx
//
// Pin for the catalog's visibility-change refresh (context/useCatalog.ts).
// The defect: the products fetch ran once at mount and never again, so a
// shopper with the shop already open never saw a listing that existed only
// in the database until something forced a reload — from their side, "until
// the next deploy". The fix re-fetches when the tab becomes visible again,
// which is exactly when the shopper comes back to look.
//
// Covers:
//   - a visibility return re-fetches and a DB-only listing (one with no seed
//     twin) appears without any reload
//   - a hidden tab does not fetch
//   - the refresh is not one-shot: two returns fetch twice
//
// The supabase boundary is mocked at the module edge (same idiom as
// tests/buildCustomerProfile.test.ts); rows swap between fetches so the
// assertion is about refreshed STATE, not just a called fetch.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const state = vi.hoisted(() => ({
    fetchCalls: 0,
    rows: [] as any[],
}));

vi.mock('../services/supabase', () => ({
    supabase: {
        from: () => {
            state.fetchCalls += 1;
            return {
                select: () => ({
                    order: () => Promise.resolve({ data: state.rows, error: null }),
                }),
            };
        },
        channel: () => {
            const ch: any = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} };
            return ch;
        },
    },
}));

// Numbered-piece enrichment is a separate RPC surface; not under test here.
vi.mock('../services/numberedPieces', () => ({
    fetchPaidCountsByProduct: async () => ({}),
}));

const { useCatalog } = await import('../context/useCatalog.js');

function Probe() {
    const { products } = useCatalog(true, () => null, () => {}, () => {});
    return createElement(
        'div',
        { id: 'probe' },
        products.map((p) => createElement('span', { key: p.id }, p.name)),
    );
}

function setVisibility(value: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { value, configurable: true });
}

let container: HTMLDivElement;
let root: Root;
let mounted = true;

async function mount() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    mounted = true;
    await act(async () => {
        root.render(createElement(Probe));
    });
}

async function unmount() {
    if (!mounted) return;
    mounted = false;
    await act(async () => {
        root.unmount();
    });
    container.remove();
}

async function dispatchVisibility() {
    await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'));
    });
}

function shown(): string {
    return container.textContent || '';
}

const DB_ONLY_NAME = 'DB Only Listing';

beforeEach(async () => {
    state.fetchCalls = 0;
    state.rows = [];
    setVisibility('visible');
    await mount();
    // Seed the pre-change catalog: one row, no DB-only listing yet.
    state.rows = [{ id: 'row-1', name: 'Row One', price: 10, images: [], description: '', sizes: [], size_inventory: {} }];
    await dispatchVisibility();
    // Shopper's tab is open on the catalog WITHOUT the new listing.
    expect(shown()).not.toContain(DB_ONLY_NAME);
});

// Unmount every root so a test's visibility listener cannot leak into the
// next test's dispatches (each live root would fire its own fetch).
afterEach(async () => {
    await unmount();
});

describe('catalog refresh on visibility change', () => {
    it('a visibility return re-fetches so a DB-only listing appears without a reload', async () => {
        state.rows = [
            { id: 'row-1', name: 'Row One', price: 10, images: [], description: '', sizes: [], size_inventory: {} },
            // Added to the DB while the tab was open; no seed twin exists.
            { id: 'db-only-1', name: DB_ONLY_NAME, price: 45, images: [], description: '', sizes: [], size_inventory: {} },
        ];
        await dispatchVisibility();
        expect(shown()).toContain(DB_ONLY_NAME);
    });

    it('a hidden tab does not fetch', async () => {
        const before = state.fetchCalls;
        setVisibility('hidden');
        await dispatchVisibility();
        expect(state.fetchCalls).toBe(before);
    });

    it('the refresh is not one-shot: two visibility returns fetch twice', async () => {
        const before = state.fetchCalls;
        await dispatchVisibility();
        await dispatchVisibility();
        expect(state.fetchCalls).toBe(before + 2);
    });

    it('unmount removes the listener (no fetch after teardown)', async () => {
        await unmount();
        const before = state.fetchCalls;
        await dispatchVisibility();
        expect(state.fetchCalls).toBe(before);
    });
});
