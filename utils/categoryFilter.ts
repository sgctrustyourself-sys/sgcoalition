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
//   - 'women' is a CROSS-CUT filter that matches by ID prefix
//     (`prod_womens_*`) rather than by `category`. We use a prefix check
//     instead of extending `Product.category` so:
//       * No Supabase schema migration needed (the existing
//         `products.category` column stays single-string).
//       * Each women's product keeps its existing apparel-type category
//         (e.g. `prod_womens_above_as_below_crop_tank` is still `shirt`
//         so `/shop?category=shirts` keeps surfacing it).
//       * Adding a new women's product is "use the prefix" instead of
//         "also remember to flip the category string".
//     Scope is STRICTLY the `prod_womens_*` namespace today. To include
//     additional women's pieces that predate the prefix convention (e.g.
//     `prod_halo_mini_dress`, predating the womens_* naming), append an
//     explicit allowlist check below — do NOT broaden the prefix.
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
    // Normalize the filter once. The filter comes from URL search params
    // (`?category=...`) which are conventionally lowercase, but the
    // docstring above promises case-insensitive equality. Lowercasing
    // here makes every branch — not just the fall-through — compare in
    // a canonical form, so `?category=Women` resolves identically to
    // `?category=women`.
    const normalizedFilter = filter?.toLowerCase?.() ?? '';
    if (!normalizedFilter || normalizedFilter === 'all') return true;
    const cat = product.category?.toLowerCase();
    if (normalizedFilter === 'wallets') {
        return cat === 'wallet' || cat === 'accessory' || cat === 'accessories';
    }
    if (normalizedFilter === 'shirts') return cat === 'shirt';
    if (normalizedFilter === 'dresses') return cat === 'dress';
    if (normalizedFilter === 'hats') return cat === 'hat' || cat === 'headwear';
    if (normalizedFilter === 'apparel') {
        return cat === 'shirt' || cat === 'jeans' || cat === 'shorts'
            || cat === 'sweatshirt' || cat === 'dress' || cat === 'apparel';
    }
    if (normalizedFilter === 'women' || normalizedFilter === 'womens') {
        // Cross-cut filter matched by ID namespace so we don't have to
        // mutate the existing `category` strings on the womens_* products
        // (which would collapse `/shop?category=shirts` etc.). Two-way
        // support for `women` / `womens` keeps the URL readable either
        // way without breaking links shared externally.
        return product.id.startsWith('prod_womens_');
    }
    if (normalizedFilter === 'men' || normalizedFilter === 'mens') {
        // Symmetric inverse of 'women' (which lives one branch above this
        // one). No `prod_mens_*` ID convention exists in the catalog today,
        // so we mirror the women's match by computing the complement:
        //
        //   1. Drop every product in the womens_* namespace — those belong
        //      to the women's section regardless of apparel-type category.
        //   2. ALSO drop `prod_halo_mini_dress`. It predates the
        //      `prod_womens_*` naming convention but is a women's piece,
        //      so leaving it in the inverse would surface it under
        //      /shop?category=men (a UX regression).
        //
        // Both checks live inline instead of being parameterized through a
        // shared const so the comment that explains the carve-out always
        // travels with the carve-out itself. The trade-off is the same one
        // the women's branch makes: if a maintainer renames
        // `prod_halo_mini_dress` -> `prod_womens_halo_mini_dress` (or
        // otherwise brings it under the `prod_womens_*` umbrella), this
        // explicit denylist becomes a no-op and can be deleted in one
        // commit. The pair of carve-outs (women's strict prefix + men's
        // halo-dress exclusion) is intentional symmetry, NOT drift.
        if (product.id.startsWith('prod_womens_')) return false;
        if (product.id === 'prod_halo_mini_dress') return false;
        return true;
    }
    return cat === normalizedFilter;
};
