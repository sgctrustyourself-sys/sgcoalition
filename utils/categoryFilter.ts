// utils/categoryFilter.ts
//
// Pure-data product/route filter helper extracted from pages/Shop.tsx so
// tests and any other consumer can import the same logic instead of
// mirroring it (mirrored copies silently drift when Shop.tsx filter logic
// changes).
//
// The Shop page maps a parent + sub-category bucket structure into a
// single `category` URL/search filter (`apparel` is the parent for the
// children `shirts | jeans | shorts | sweatshirt | dresses`). This helper
// resolves any filter against a product's `product.category`:
//   - 'all' and falsy filters return true (no filtering).
//   - Named plural buckets (`wallets`, `shirts`, `dresses`, `hats`) accept
//     the singular category plus common aliases.
//   - 'apparel' accepts any sub-category under the apparel umbrella.
//   - Anything else (e.g. 'sweatshirt') does a case-insensitive equality.
//
// Pure-data: no React hooks, no state. Mirrors the same pattern as
// utils/productMerge.ts so test consumers and Shop.tsx call sites read
// from one source of truth.

import { Product } from '../types';

/**
 * Returns true if the product would be visible under the given `filter`.
 * `filter` is the URL/search `category` parameter as entered by the user
 * (case-insensitive). `product.category` is the canonical
 * Product['category'] after AppContext.fetchProducts merges the
 * INITIAL_PRODUCTS + Supabase + PRODUCT_LOCAL_OVERRIDES result.
 */
export const matchesCategoryFilter = (product: Product, filter: string): boolean => {
    if (!filter || filter === 'all') return true;
    const cat = product.category?.toLowerCase();
    if (filter === 'wallets') {
        return cat === 'wallet' || cat === 'accessory' || cat === 'accessories';
    }
    if (filter === 'shirts') return cat === 'shirt';
    if (filter === 'dresses') return cat === 'dress';
    if (filter === 'hats') return cat === 'hat' || cat === 'headwear';
    if (filter === 'apparel') {
        return cat === 'shirt' || cat === 'jeans' || cat === 'shorts'
            || cat === 'sweatshirt' || cat === 'dress' || cat === 'apparel';
    }
    return cat === filter.toLowerCase();
};
