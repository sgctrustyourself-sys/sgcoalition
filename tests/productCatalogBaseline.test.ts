import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INITIAL_PRODUCTS, PRODUCT_LOCAL_OVERRIDES } from '../constants';

const readme = fs.readFileSync(path.resolve(process.cwd(), 'README.md'), 'utf-8');

describe('README product catalog baseline', () => {
    it('lists every local fallback product ID', () => {
        for (const product of INITIAL_PRODUCTS) {
            expect(readme).toContain(`\`${product.id}\``);
        }
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
});
