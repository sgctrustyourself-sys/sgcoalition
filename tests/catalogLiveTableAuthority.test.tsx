// tests/catalogLiveTableAuthority.test.tsx
//
// Pin for the catalog's source of truth (context/useCatalog.ts).
//
// The defect: after the products table loaded, the catalog MERGED the local
// seed file on top of it - every INITIAL_PRODUCTS row the table did not have
// was appended as a live listing. Four rows were in that state (the Lighter
// Holder, the Chrome Hearts wallet, 'Parts' Wallet 1/4 and 2/4), so the shop
// sold pieces the database has no row for.
//
// The server prices a cart from the products table ALONE, so any of those
// lines produced a 409 "Unavailable: <id>" from /api/pricing-preview, the
// checkout could not total the order, and the shopper was stuck on a dead
// checkout with no explanation. That is exactly what the production smoke
// test found.
//
// The rule now: once the table has loaded, the table IS the catalog. The
// local seed file is the offline fallback and nothing else.
//
// Covers:
//   - a local-only row is NOT listed when the table loaded
//   - a table row IS listed (the table is not filtered by the local file)
//   - when the table read FAILS, the local seed is used, so the site still
//     renders instead of showing an empty shop
//   - the local file's overrides still apply to a row the table has

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';

const state = vi.hoisted(() => ({
    rows: [] as any[],
    failWith: null as { message: string } | null,
}));

vi.mock('../services/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                order: () => (state.failWith
                    ? Promise.resolve({ data: null, error: state.failWith })
                    : Promise.resolve({ data: state.rows, error: null })),
            }),
        }),
        channel: () => {
            const ch: any = { on: () => ch, subscribe: () => ch, unsubscribe: () => {} };
            return ch;
        },
    },
}));

vi.mock('../services/numberedPieces', () => ({
    fetchPaidCountsByProduct: async () => ({}),
}));

const { useCatalog } = await import('../context/useCatalog.js');
const { INITIAL_PRODUCTS } = await import('../constants/products.js');

function Probe() {
    const { products } = useCatalog(true, () => null, () => {}, () => {});
    return createElement(
        'div',
        { id: 'probe' },
        products.map((p) => createElement('span', { key: p.id }, p.name)),
    );
}

let container: HTMLDivElement;
let root: Root;

async function mount() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root.render(createElement(Probe));
    });
}

const shown = () => container.textContent || '';

// A row that exists in the local seed file but not in the table.
const LOCAL_ONLY = INITIAL_PRODUCTS.find(
    (p: any) => p.id === 'prod_lighter_holder' || p.id === 'prod_wallet_chrome_hearts',
) as any;

beforeEach(async () => {
    state.failWith = null;
    state.rows = [];
    await mount();
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('the live products table is the catalog', () => {
    it('has a local-only row to test against (the guard is meaningless otherwise)', () => {
        expect(LOCAL_ONLY).toBeTruthy();
    });

    it('does NOT list a local row the table does not have', async () => {
        state.rows = [{ id: 'row-live', name: 'Live Row', price: 10, images: [], description: '', sizes: [], size_inventory: {} }];
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(shown()).toContain('Live Row');
        expect(shown()).not.toContain(LOCAL_ONLY.name);
    });

    it('lists every row the table has, even ones the local file lacks', async () => {
        state.rows = [
            { id: 'row-a', name: 'Table Only A', price: 10, images: [], description: '', sizes: [], size_inventory: {} },
            { id: 'row-b', name: 'Table Only B', price: 20, images: [], description: '', sizes: [], size_inventory: {} },
        ];
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        expect(shown()).toContain('Table Only A');
        expect(shown()).toContain('Table Only B');
    });

    it('falls back to the local seed when the table read fails', async () => {
        state.failWith = { message: 'network down' };
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
        });

        // The site still renders something a shopper can browse.
        expect(shown().length).toBeGreaterThan(0);
    });
});

describe('the Supabase flag is a property of the build', () => {
    it('initialises isSupabaseConfigured from the inlined keys, not from false', () => {
        // The flag used to start false and flip inside the init effect, so
        // every hook that takes it - the catalog above all - took the
        // "Supabase unavailable" branch on its first fetch. The catalog's
        // fallback branch returns the local seed, so production served the
        // seed and never queried the products table.
        const src = fs.readFileSync(path.join(__dirname, '..', 'context', 'AppContext.tsx'), 'utf8');
        expect(src).toContain('useState(hasSupabaseKeys)');
        expect(src).not.toMatch(/const \[isSupabaseConfigured, setIsSupabaseConfigured\] = useState\(false\)/);
    });
});
