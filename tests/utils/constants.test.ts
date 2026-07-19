// tests/utils/constants.test.ts
//
// VALIDITY CONTRACT: locks the PRODUCT_IDS constant so no ID string can be
// typosquatted, duplicated, or orphaned (pointing at a product that doesn't
// exist in INITIAL_PRODUCTS). When a product is added to or removed from the
// catalog, this file breaks first and tells the operator exactly which
// PRODUCT_IDS entry needs to be updated.
//
// These tests are DECOUPLED from catalog shape — they check that every
// PRODUCT_IDS value has a real home in INITIAL_PRODUCTS, but they do NOT
// lock the catalog order, featured status, or any other business rule.

import { describe, it, expect } from 'vitest';
import { PRODUCT_IDS } from '../../constants/productIds';
import { INITIAL_PRODUCTS } from '../../constants/products';
import { Product } from '../../types';

// ── Helpers ────────────────────────────────────────────────────────────────

/** All real product IDs from the catalog. */
const realProductIds: string[] = INITIAL_PRODUCTS.map((p: Product) => p.id);

/** All values defined in PRODUCT_IDS. */
const productIdValues: string[] = Object.values(PRODUCT_IDS);

/** All keys defined in PRODUCT_IDS. */
const productIdKeys: string[] = Object.keys(PRODUCT_IDS) as (keyof typeof PRODUCT_IDS)[];

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PRODUCT_IDS', () => {
    describe('no empty or whitespace-only IDs', () => {
        it.each(productIdKeys)('"%s" is a non-empty string', (key: string) => {
            const value: string = PRODUCT_IDS[key as keyof typeof PRODUCT_IDS];
            expect(value).toBeTruthy();
            expect(value.trim().length).toBeGreaterThan(0);
        });
    });

    describe('no duplicate values', () => {
        it('every PRODUCT_IDS value is unique', () => {
            const unique = new Set(productIdValues);
            expect(unique.size).toBe(productIdValues.length);
        });
    });

    describe('every value matches a real product in INITIAL_PRODUCTS', () => {
        it.each(productIdKeys)(
            '"%s" exists in INITIAL_PRODUCTS',
            (key: string) => {
                const value: string = PRODUCT_IDS[key as keyof typeof PRODUCT_IDS];
                expect(realProductIds).toContain(value);
            },
        );
    });

    describe('each matching product has a non-empty name', () => {
        it.each(productIdKeys)(
            'product for "%s" has a non-empty name',
            (key: string) => {
                const value: string = PRODUCT_IDS[key as keyof typeof PRODUCT_IDS];
                const product = INITIAL_PRODUCTS.find((p: Product) => p.id === value);
                expect(product).toBeDefined();
                expect(product!.name.trim().length).toBeGreaterThan(0);
            },
        );
    });
});
