import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INITIAL_PRODUCTS, PRODUCT_LOCAL_OVERRIDES } from '../constants';

const readme = fs.readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf-8');

describe('README product catalog baseline', () => {
    it('lists every local fallback product ID', () => {
        const failures = [];
        for (const product of INITIAL_PRODUCTS) {
            const needle = '`' + product.id + '`';
            if (!readme.includes(needle)) {
                failures.push({ id: product.id, needle, inRaw: readme.includes(product.id) });
            }
        }
        // Debug helper: prints cwd + readme prologue + per-id failure detail so an
        // operator can tell cwd-mismatch from real catalog drift. Gated behind an
        // env flag so a normal CI run stays silent.
        if (failures.length > 0 && process.env.DEBUG_CATALOG_TEST) {
            console.error('[catalog-baseline] cwd:', process.cwd());
            console.error('[catalog-baseline] readme.byteLength:', readme.length);
            console.error('[catalog-baseline] readme[0..200]:', readme.slice(0, 200));
            console.error('[catalog-baseline] missing ids:', failures.length);
            for (const f of failures) {
                console.error('  - id=' + f.id + ' inRaw=' + f.inRaw + ' needle=' + JSON.stringify(f.needle));
            }
        }
        expect(failures).toEqual([]);
    });

    it('keeps the Halo Mini Dress as a standard $50 catalog product', () => {
        const haloFallback = INITIAL_PRODUCTS.find(product => product.id === 'prod_halo_mini_dress');
        const halo = {
            ...haloFallback,
            ...PRODUCT_LOCAL_OVERRIDES.prod_halo_mini_dress,
        };

        expect(halo.price).toBe(50);
        expect(halo.isLimitedEdition).toBe(false);
        expect(halo.editionSize).toBeUndefined();
        expect(halo.pricingTiers).toBeUndefined();
        expect(readme).toContain('| `prod_halo_mini_dress` | COALITION HALO MINI DRESS | $50 | dress | Live, standard release |');
    });

    // Drift guard for the @friiqy denim-patchwork offline sale. The matching
    // order row id `public-md-denim-patchwork-2024_11_08` lives in
    // INITIAL_ORDERS and is mirrored to Supabase by
    // scripts/upsertFriiqyDenimPatchwork.ts. Pinned here so the catalog
    // baseline test catches any future drift in either the price field
    // or the README catalog row's exact metadata (mirrors the Halo Mini
    // Dress test above).
    it('keeps the Coalition Denim Patchwork S1 at $140 archived/sold', () => {
        const patchFallback = INITIAL_PRODUCTS.find(product => product.id === 'Coalition_Denim_Patchwork_S1');
        expect(patchFallback).toBeDefined();
        expect(patchFallback.price).toBe(140);
        expect(patchFallback.category).toBe('jeans');
        expect(readme).toContain('| `Coalition_Denim_Patchwork_S1` | Coalition Denim Patchwork 1/1 Jeans S1 | $140 | jeans | Archived/sold |');
    });
});
