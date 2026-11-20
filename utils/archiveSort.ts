import { Product } from '../types.js';

/**
 * Archive page sort contract.
 *
 * The /archive page (`pages/Archive.tsx`) renders every product where
 * `archived: true`. This function is the single source of truth for the
 * deterministic order those cards appear in. Extracted from the page so it
 * can be unit-tested without React (see `tests/archiveSort.test.ts`).
 *
 * Sort contract:
 * 1. Primary key: `soldAt` (preferred) or `archivedAt` (fallback), using the
 *    first value that actually parses. A malformed `soldAt` must not mask a
 *    valid `archivedAt`; a product with both missing or unparseable falls to
 *    epoch 0 (sorts to the bottom, never throws).
 * 2. Direction: descending (newest sales first).
 * 3. Tie-break: `name.localeCompare(b.name)` (case-insensitive, locale-aware).
 *    This is what makes the 5+ wholesale-bundle wallets (all with the same
 *    `soldAt`) display in a stable order across re-renders regardless of
 *    `INITIAL_PRODUCTS` array order.
 *
 * `archiveNote` is metadata and does NOT participate in the sort.
 *
 * Non-archived products are NOT filtered here - the page does that. This
 * function only sorts the input array; the filter is the caller's job so
 * the same utility can be reused on a pre-filtered list.
 *
 * Returns a NEW array (never mutates the input). Safe to call inside a
 * React useMemo without triggering exhaustive-deps lints.
 */
/** Epoch milliseconds for the first parsable archive date, or 0. */
function archivedTime(product: Product): number {
    for (const raw of [product.soldAt, product.archivedAt]) {
        if (!raw) continue;
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
    return 0;
}

export function sortArchivedProducts(products: Product[]): Product[] {
    return [...products].sort((a, b) => {
        const dateA = archivedTime(a);
        const dateB = archivedTime(b);
        if (dateB !== dateA) return dateB - dateA;
        return a.name.localeCompare(b.name);
    });
}
