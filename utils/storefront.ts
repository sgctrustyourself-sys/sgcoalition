// utils/storefront.ts
//
// Storefront display rules for the live shop + home page.
// Extracted from `pages/Shop.tsx` and `pages/Home.tsx` so the logic can be
// unit-tested without React (see `tests/storefront.test.ts`).
//
// The /shop "newest" sort and the / "featured" selector are the two
// deterministic contracts that determine what a buyer sees first. They're
// the load-bearing pieces of the storefront display; if either silently
// changes, the entire catalog order shifts.

import { Product } from '../types';

/**
 * Returns a NEW array sorted newest-first by the product's "added"
 * timestamp.
 *
 * Timestamp fallback chain (in order):
 *   1. `createdAt`  — when the product was added to the catalog
 *   2. `releasedAt` — release date override (used for scheduled drops)
 *   3. `archivedAt` — archive date (legacy products without createdAt)
 *   4. `soldAt`     — sold date (last-resort fallback)
 *   5. epoch 0      — products with no dates at all sort to the bottom
 *
 * A product with `createdAt: "2026-07-12T00:00:00Z"` ALWAYS sorts before a
 * product with no `createdAt`, regardless of the other products' order
 * in the input. This is the load-bearing contract the Unity No. 4 Polo
 * promotion depends on (it has createdAt=2026-07-12 and must be #1).
 *
 * Tie-break: preserves the input array's relative order (stable sort).
 * Two products with the same timestamp stay in their original input order.
 *
 * Returns a NEW array (never mutates the input). Safe to call inside a
 * React useMemo without triggering exhaustive-deps lints.
 */
export function sortByNewest(products: Product[]): Product[] {
    // Capture input order for tie-breaking. JavaScript's Array#sort is
    // stable, but we want to be EXPLICIT about tie-break order so a
    // future refactor that switches to an unstable sort (or adds a name
    // tie-break) can't silently reorder ties.
    //
    // NOTE: tie-break is INPUT ORDER, not name.localeCompare like
    // archiveSort uses. This preserves Supabase's created_at DESC order
    // from AppContext, which is the storefront display order. If a future
    // contributor "harmonizes" these two sort utilities to use the same
    // tie-break, the live shop order would silently change.
    const originalOrder = new Map(products.map((p, index) => [p.id, index]));

    const getNewestTimestamp = (product: Product): number => {
        const candidateDates = [
            product.createdAt,
            product.releasedAt,
            product.archivedAt,
            product.soldAt,
        ];
        for (const value of candidateDates) {
            const timestamp = Date.parse(value || '');
            if (Number.isFinite(timestamp)) return timestamp;
        }
        return 0;
    };

    return [...products].sort((a, b) => {
        const diff = getNewestTimestamp(b) - getNewestTimestamp(a);
        if (diff !== 0) return diff;
        return (originalOrder.get(a.id) ?? 0) - (originalOrder.get(b.id) ?? 0);
    });
}

/**
 * Returns the product to display in the home page "featured" / "Spotlight"
 * section.
 *
 * Selection rule:
 *   1. First product with `isFeatured: true` (in the input array's order)
 *   2. Fallback: `products[0]` if no product is featured
 *   3. Null if the input is empty
 *
 * Callers should pass products in their canonical order (e.g., Supabase's
 * `created_at DESC` order from AppContext). The selector picks the first
 * match, so input order matters when multiple products are featured.
 *
 * Mirrors the inline expression in `pages/Home.tsx`:
 *   `products.find(p => p.isFeatured) || products[0]`
 */
export function selectFeaturedProduct(products: Product[] | undefined | null): Product | null {
    if (!products || products.length === 0) return null;
    return products.find(p => p.isFeatured) || products[0];
}
