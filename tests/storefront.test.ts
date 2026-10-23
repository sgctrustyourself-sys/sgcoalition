// tests/storefront.test.ts
//
// REGRESSION CATCH: locks the /shop "newest" sort and the / "featured"
// selector so future refactors can't silently change what buyers see first.
//
// Contracts being locked:
//
//   sortByNewest(products):
//     1. Primary key: createdAt (preferred) > releasedAt > archivedAt > soldAt > 0
//     2. Direction: descending (newest first)
//     3. Tie-break: input array order (stable)
//     4. Product with createdAt=2026-07-12 sorts before all products without createdAt
//
//   selectFeaturedProduct(products):
//     1. Returns the first product with isFeatured: true
//     2. Falls back to products[0] when no isFeatured
//     3. Returns null for empty/undefined input
//
// This file uses SYNTHETIC test fixtures (not real products from
// constants.ts) so the tests are decoupled from the catalog. If a future
// product addition breaks either contract, these tests fail first and point
// at the utility function, not at the catalog.

import { describe, it, expect } from 'vitest';
import { sortByNewest, selectFeaturedProduct } from '../utils/storefront';
import { Product } from '../types';

function p(overrides: Partial<Product> & { id: string; name: string }): Product {
    return {
        id: overrides.id,
        name: overrides.name,
        price: 0,
        images: [],
        description: '',
        category: 'wallet',
        ...overrides,
    } as unknown as Product;
}

describe('sortByNewest', () => {
    describe('primary contract: createdAt sorts before missing dates', () => {
        it('product with createdAt=2026-07-12 sorts before all products without createdAt', () => {
            const products = [
                p({ id: 'legacy-1', name: 'Legacy 1', soldAt: '2026-05-22T22:33:38+00:00' }),
                p({ id: 'legacy-2', name: 'Legacy 2', soldAt: '2026-03-06T00:00:00Z' }),
                p({ id: 'unity-polo', name: 'Coalition Unity No. 4 Polo', createdAt: '2026-07-12T00:00:00Z' }),
                p({ id: 'no-dates', name: 'No dates' }),
                p({ id: 'legacy-3', name: 'Legacy 3', releasedAt: '2026-06-01T00:00:00Z' }),
            ];
            const sorted = sortByNewest(products);
            expect(sorted.map(x => x.id)).toEqual([
                'unity-polo',
                'legacy-3',
                'legacy-1',
                'legacy-2',
                'no-dates',
            ]);
        });
    });

    describe('date fallback chain', () => {
        it('uses createdAt when set, ignoring later dates', () => {
            const products = [
                p({ id: 'a', name: 'A', createdAt: '2025-01-01T00:00:00Z', soldAt: '2026-06-01T00:00:00Z' }),
                p({ id: 'b', name: 'B', soldAt: '2026-06-01T00:00:00Z' }),
            ];
            const sorted = sortByNewest(products);
            expect(sorted.map(x => x.id)).toEqual(['b', 'a']);
        });

        it('falls back to releasedAt when createdAt is missing', () => {
            const products = [
                p({ id: 'no-released', name: 'No releasedAt', createdAt: '2025-01-01T00:00:00Z' }),
                p({ id: 'with-released', name: 'With releasedAt', releasedAt: '2026-01-01T00:00:00Z' }),
            ];
            const sorted = sortByNewest(products);
            expect(sorted.map(x => x.id)).toEqual(['with-released', 'no-released']);
        });

        it('falls back to archivedAt when createdAt and releasedAt are missing', () => {
            const products = [
                p({ id: 'a', name: 'A', archivedAt: '2026-01-01T00:00:00Z' }),
                p({ id: 'b', name: 'B', soldAt: '2026-06-01T00:00:00Z' }),
            ];
            const sorted = sortByNewest(products);
            expect(sorted.map(x => x.id)).toEqual(['b', 'a']);
        });

        it('falls back to soldAt when createdAt, releasedAt, and archivedAt are all missing', () => {
            const products = [
                p({ id: 'a', name: 'A', soldAt: '2026-01-01T00:00:00Z' }),
                p({ id: 'b', name: 'B', soldAt: '2026-06-01T00:00:00Z' }),
            ];
            const sorted = sortByNewest(products);
            expect(sorted.map(x => x.id)).toEqual(['b', 'a']);
        });
    });

    describe('null/undefined handling', () => {
        it('places products with all dates null at the bottom (epoch 0)', () => {
            const products = [
                p({ id: 'no-date-1', name: 'Z-NoDate1' }),
                p({ id: 'no-date-2', name: 'A-NoDate2' }),
                p({ id: 'has-date', name: 'M-HasDate', createdAt: '2026-01-01T00:00:00Z' }),
            ];
            const sorted = sortByNewest(products);
            expect(sorted.map(x => x.id)).toEqual(['has-date', 'no-date-1', 'no-date-2']);
        });

        it('does not throw on malformed date strings', () => {
            const products = [
                p({ id: 'bad',  name: 'Bad date',  createdAt: 'not-a-date' }),
                p({ id: 'good', name: 'Good date', createdAt: '2026-01-01T00:00:00Z' }),
            ];
            expect(() => sortByNewest(products)).not.toThrow();
            const sorted = sortByNewest(products);
            expect(sorted.map(x => x.id)).toEqual(['good', 'bad']);
        });

        it('handles an empty array', () => {
            expect(sortByNewest([])).toEqual([]);
        });
    });

    describe('tie-break: input array order', () => {
        it('preserves input order when timestamps are identical', () => {
            const ts = '2026-07-12T00:00:00Z';
            const products = [
                p({ id: 'first',  name: 'Z-LastByName',  createdAt: ts }),
                p({ id: 'second', name: 'A-FirstByName', createdAt: ts }),
                p({ id: 'third',  name: 'M-MidByName',   createdAt: ts }),
            ];
            const sorted = sortByNewest(products);
            expect(sorted.map(x => x.id)).toEqual(['first', 'second', 'third']);
        });
    });

    describe('immutability', () => {
        it('returns a NEW array; does not mutate the input', () => {
            const products = [
                p({ id: 'a', name: 'Z', createdAt: '2025-01-01T00:00:00Z' }),
                p({ id: 'b', name: 'A', createdAt: '2026-01-01T00:00:00Z' }),
            ];
            const original = [...products];
            const sorted = sortByNewest(products);
            expect(products).toEqual(original);
            expect(sorted).not.toBe(products);
            expect(sorted.map(x => x.id)).toEqual(['b', 'a']);
        });
    });
});

describe('selectFeaturedProduct', () => {
    describe('primary contract: returns the first isFeatured: true', () => {
        it('returns the first product with isFeatured: true', () => {
            const products = [
                p({ id: 'not-featured', name: 'Not featured', isFeatured: false }),
                p({ id: 'featured-1',   name: 'Featured 1',   isFeatured: true }),
                p({ id: 'featured-2',   name: 'Featured 2',   isFeatured: true }),
            ];
            const featured = selectFeaturedProduct(products);
            expect(featured?.id).toBe('featured-1');
        });

        it('returns the featured product regardless of position in the array', () => {
            const products = [
                p({ id: 'not-featured-1', name: 'Not featured 1', isFeatured: false }),
                p({ id: 'featured',        name: 'Unity Polo',     isFeatured: true }),
                p({ id: 'not-featured-2', name: 'Not featured 2', isFeatured: false }),
            ];
            const featured = selectFeaturedProduct(products);
            expect(featured?.id).toBe('featured');
            expect(featured?.name).toBe('Unity Polo');
        });
    });

    describe('fallback: products[0] when no isFeatured', () => {
        it('returns the first product when no isFeatured is set', () => {
            const products = [
                p({ id: 'first',  name: 'First',  isFeatured: false }),
                p({ id: 'second', name: 'Second', isFeatured: false }),
            ];
            const featured = selectFeaturedProduct(products);
            expect(featured?.id).toBe('first');
        });

        it('returns the first product when isFeatured is undefined on all products', () => {
            const products = [
                p({ id: 'a', name: 'A' }),
                p({ id: 'b', name: 'B' }),
            ];
            const featured = selectFeaturedProduct(products);
            expect(featured?.id).toBe('a');
        });
    });

    describe('empty/undefined input', () => {
        it('returns null for an empty array', () => {
            expect(selectFeaturedProduct([])).toBeNull();
        });

        it('returns null for undefined input', () => {
            expect(selectFeaturedProduct(undefined)).toBeNull();
        });

        it('returns null for null input', () => {
            expect(selectFeaturedProduct(null)).toBeNull();
        });
    });
});
