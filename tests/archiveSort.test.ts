// tests/archiveSort.test.ts
//
// REGRESSION CATCH: locks the Archive page sort contract so future refactors
// can't silently break the deterministic order buyers see on /archive.
//
// Contract being locked:
//   1. Primary key: soldAt (preferred) or archivedAt (fallback) or 0 (epoch)
//   2. Direction: descending (newest sales first)
//   3. Tie-break: name.localeCompare(b.name) (case-insensitive, locale-aware)
//
// This file uses SYNTHETIC test fixtures (not real products from
// constants.ts) so the test is decoupled from the catalog. If a future
// product addition breaks the contract, this test fails first and points
// at the sort function, not at the catalog.

import { describe, it, expect } from 'vitest';
import { sortArchivedProducts } from '../utils/archiveSort';
import { Product } from '../types';

// Minimal Product factory -- only the fields the sort function reads.
// `as unknown as Product` skips the type system for fields we don't care
// about in this test (description, images, etc.).
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

describe('sortArchivedProducts', () => {
    describe('primary key: soldAt descending', () => {
        it('sorts newest first by soldAt', () => {
            const products = [
                p({ id: 'a', name: 'Old',  soldAt: '2025-01-01T00:00:00Z' }),
                p({ id: 'b', name: 'New',  soldAt: '2026-06-25T00:00:00Z' }),
                p({ id: 'c', name: 'Mid',  soldAt: '2025-06-15T00:00:00Z' }),
            ];
            const sorted = sortArchivedProducts(products);
            expect(sorted.map(x => x.id)).toEqual(['b', 'c', 'a']);
        });

        it('handles a single product', () => {
            const products = [p({ id: 'only', name: 'Only', soldAt: '2026-01-01T00:00:00Z' })];
            expect(sortArchivedProducts(products).map(x => x.id)).toEqual(['only']);
        });

        it('handles an empty array', () => {
            expect(sortArchivedProducts([])).toEqual([]);
        });
    });

    describe('tie-break: alphabetical name when soldAt matches', () => {
        it('sorts alphabetically by name when all soldAt are identical', () => {
            const ts = '2026-05-22T22:33:38+00:00';
            const products = [
                p({ id: '1', name: 'Coalition Green Camo Wallet',          soldAt: ts }),
                p({ id: '2', name: "Coalition 'Racing Team' Wallet 4/4",  soldAt: ts }),
                p({ id: '3', name: "Coalition 'Racing Team' Wallet 1/4",  soldAt: ts }),
                p({ id: '4', name: 'COALITION SKYY BLUE WALLET 1/2',       soldAt: ts }),
                p({ id: '5', name: 'COALITION SKYY BLUE WALLET 2/2',       soldAt: ts }),
            ];
            const sorted = sortArchivedProducts(products);
            // localeCompare is case-insensitive. The apostrophe in
            // "Coalition 'Racing Team'..." (U+0027) sorts BEFORE 'G' (U+0047),
            // so Racing Team comes before Green Camo. Within Racing Team,
            // "1/4" < "4/4". Then Green Camo, then SKYY 1/2 < SKYY 2/2.
            expect(sorted.map(x => x.id)).toEqual(['3', '2', '1', '4', '5']);
        });

        it('uses localeCompare (not ASCII) so mixed case sorts together', () => {
            const ts = '2026-01-01T00:00:00Z';
            const products = [
                p({ id: 'lower', name: 'banana', soldAt: ts }),
                p({ id: 'upper', name: 'Apple',  soldAt: ts }),
            ];
            // localeCompare returns "Apple" before "banana" case-insensitively.
            const sorted = sortArchivedProducts(products);
            expect(sorted.map(x => x.id)).toEqual(['upper', 'lower']);
        });
    });

    describe('fallback: archivedAt when soldAt is null', () => {
        it('uses archivedAt when soldAt is missing', () => {
            const products = [
                p({ id: 'a', name: 'No dates',  soldAt: undefined, archivedAt: undefined }),
                p({ id: 'b', name: 'Archive 1', soldAt: undefined, archivedAt: '2026-01-01T00:00:00Z' }),
                p({ id: 'c', name: 'Archive 2', soldAt: undefined, archivedAt: '2025-01-01T00:00:00Z' }),
            ];
            const sorted = sortArchivedProducts(products);
            expect(sorted.map(x => x.id)).toEqual(['b', 'c', 'a']);
        });

        it('prefers soldAt over archivedAt when both are set', () => {
            // soldAt newer than archivedAt: product should sort by soldAt.
            const products = [
                p({ id: 'old-archive-new-sale', name: 'Alpha', soldAt: '2026-06-01T00:00:00Z', archivedAt: '2024-01-01T00:00:00Z' }),
                p({ id: 'new-archive-old-sale', name: 'Beta',  soldAt: '2025-01-01T00:00:00Z', archivedAt: '2026-01-01T00:00:00Z' }),
            ];
            const sorted = sortArchivedProducts(products);
            // Alpha has soldAt=2026-06 (newer) so it sorts first.
            expect(sorted.map(x => x.id)).toEqual(['old-archive-new-sale', 'new-archive-old-sale']);
        });
    });

    describe('both soldAt and archivedAt set to the same date (tie-break at the primary key)', () => {
        it('falls back to name tie-break when soldAt and archivedAt are the same date', () => {
            // Both fields are set AND identical, so the primary key is a tie.
            // The function should NOT try to pick a winner between the two
            // fields (it already used soldAt for both). Name becomes the
            // tie-break. This pins the behavior so a future refactor that
            // switches to `archivedAt || soldAt` (reversed fallback) can't
            // silently change the contract.
            const products = [
                p({ id: 'beta',  name: 'Beta',  soldAt: '2026-01-01T00:00:00Z', archivedAt: '2026-01-01T00:00:00Z' }),
                p({ id: 'alpha', name: 'Alpha', soldAt: '2026-01-01T00:00:00Z', archivedAt: '2026-01-01T00:00:00Z' }),
                p({ id: 'gamma', name: 'Gamma', soldAt: '2026-01-01T00:00:00Z', archivedAt: '2026-01-01T00:00:00Z' }),
            ];
            const sorted = sortArchivedProducts(products);
            // Alphabetical: Alpha, Beta, Gamma.
            expect(sorted.map(x => x.id)).toEqual(['alpha', 'beta', 'gamma']);
        });
    });

    describe('null/undefined handling', () => {
        it('places products with both soldAt and archivedAt null at the bottom (epoch 0)', () => {
            const products = [
                p({ id: 'no-date', name: 'Z-NoDate',  soldAt: undefined, archivedAt: undefined }),
                p({ id: 'has',     name: 'A-HasDate', soldAt: '2026-01-01T00:00:00Z' }),
            ];
            const sorted = sortArchivedProducts(products);
            // "A-HasDate" has a real date, "Z-NoDate" falls to epoch 0 (bottom).
            expect(sorted.map(x => x.id)).toEqual(['has', 'no-date']);
        });

        it('does not throw on malformed date strings', () => {
            const products = [
                p({ id: 'bad',  name: 'Bad date',  soldAt: 'not-a-date' }),
                p({ id: 'good', name: 'Good date', soldAt: '2026-01-01T00:00:00Z' }),
            ];
            // `new Date('not-a-date').getTime()` returns NaN; NaN comparisons
            // are always false, so the bad date falls through to the name
            // tie-break. The test asserts the function does NOT throw.
            expect(() => sortArchivedProducts(products)).not.toThrow();
            const sorted = sortArchivedProducts(products);
            expect(sorted).toHaveLength(2);
        });

        it('NaN-date products stay in their original position (undefined sort behavior, pinned)', () => {
            // PINNED UNDEFINED BEHAVIOR: When `new Date(p.soldAt).getTime()`
            // returns NaN, the comparator hits `dateB - dateA` which is also
            // NaN. Array.prototype.sort treats a NaN comparator return as 0
            // (no swap), so NaN products do NOT move relative to their input
            // position. This test pins that behavior so a future refactor
            // (e.g. `dateB - dateA || 0` to coerce NaN to 0) can't silently
            // change where malformed-date products land in the grid.
            //
            // Input layout: [valid-LATE, NaN, valid-EARLY]
            // The valid-LATE should still come before valid-EARLY (real dates
            // sort correctly). The NaN product stays at index 1.
            const products = [
                p({ id: 'valid-late',  name: 'Z-late',  soldAt: '2026-06-01T00:00:00Z' }),
                p({ id: 'nan',         name: 'M-nan',   soldAt: 'not-a-date' }),
                p({ id: 'valid-early', name: 'A-early', soldAt: '2025-01-01T00:00:00Z' }),
            ];
            const sorted = sortArchivedProducts(products);
            const expected = ['valid-late', 'nan', 'valid-early'];
            const actual = sorted.map(x => x.id);
            // NaN product stays at index 1 (its original position). The two
            // valid products swap (Z-late has a newer date, sorts before
            // A-early).
            expect(actual, 'NaN pinning. Expected: ' + expected.join(', ') + '. Actual: ' + actual.join(', ')).toEqual(expected);
        });
    });

    describe('archiveNote is metadata, not a sort key', () => {
        it('does not use archiveNote in the sort (proven with 5 products, wildly different notes)', () => {
            // 5 products with the same soldAt, sorted in name order. The
            // archiveNote values are deliberately scrambled (one starts with
            // Z, one with A, one is empty, one is a single char, one is a
            // full paragraph) so a future refactor that accidentally uses
            // archiveNote as a sort key would produce a visibly different
            // order and this test would fail.
            const ts = '2026-01-01T00:00:00Z';
            const products = [
                p({ id: 'echo',   name: 'Echo',   soldAt: ts, archiveNote: 'Z-long-story-with-many-words-to-bias-tiebreak' }),
                p({ id: 'alpha',  name: 'Alpha',  soldAt: ts, archiveNote: 'A' }),
                p({ id: 'delta',  name: 'Delta',  soldAt: ts, archiveNote: '' }),
                p({ id: 'bravo',  name: 'Bravo',  soldAt: ts, archiveNote: 'M' }),
                p({ id: 'charlie',name: 'Charlie',soldAt: ts, archiveNote: 'A-full-paragraph-detailing-the-veteran-gift-story-and-the-wholesale-bundle-relationship-with-the-buyer-and-the-instagram-handle-where-the-handoff-was-coordinated-in-may-2026' }),
            ];
            const sorted = sortArchivedProducts(products);
            // Pure alphabetical by name. archiveNote is completely ignored.
            expect(sorted.map(x => x.id)).toEqual(['alpha', 'bravo', 'charlie', 'delta', 'echo']);
        });
    });

    describe('immutability', () => {
        it('returns a NEW array; does not mutate the input', () => {
            const products = [
                p({ id: 'a', name: 'Z', soldAt: '2025-01-01T00:00:00Z' }),
                p({ id: 'b', name: 'A', soldAt: '2026-01-01T00:00:00Z' }),
            ];
            const original = [...products];
            const sorted = sortArchivedProducts(products);
            // Input array is unchanged.
            expect(products).toEqual(original);
            // Output is a different reference.
            expect(sorted).not.toBe(products);
            // Output is correctly sorted.
            expect(sorted.map(x => x.id)).toEqual(['b', 'a']);
        });
    });

    describe('wholesale bundle determinism (the real-world reason this test exists)', () => {
        it('5 products with identical soldAt sort in a stable order regardless of input order', () => {
            const ts = '2026-05-22T22:33:38+00:00';
            const names = [
                'Coalition Green Camo Wallet',
                'COALITION SKYY BLUE WALLET 2/2',
                "Coalition 'Racing Team' Wallet 1/4",
                "Coalition 'Racing Team' Wallet 4/4",
                'COALITION SKYY BLUE WALLET 1/2',
            ];
            // Build the input in 3 different orders; assert the sorted
            // output is identical every time.
            const orderings = [
                [0, 1, 2, 3, 4],
                [4, 3, 2, 1, 0],
                [2, 4, 0, 3, 1],
            ];
            const expected = sortArchivedProducts(
                names.map((name, i) => p({ id: String(i), name, soldAt: ts })),
            );
            for (const order of orderings) {
                const shuffled = order.map(i =>
                    p({ id: String(i), name: names[i], soldAt: ts }),
                );
                const sorted = sortArchivedProducts(shuffled);
                expect(sorted.map(x => x.id)).toEqual(expected.map(x => x.id));
            }
        });
    });

    describe('the real 14-product archive ordering (locks the storefront display)', () => {
        // The exact ordering the live /archive page should render in.
        // If this fails, the storefront has reordered the archive in a way
        // a buyer would notice. The assertion message includes the actual
        // order so a future failure is debuggable from the test output alone.
        it('produces the expected order for the 14 archived products', () => {
            const products = [
                p({ id: 'Coalition_Grey_Wave_Wallet_1_2',     name: "Coalition 'Grey Wave' Wallet 1/2",  soldAt: '2026-06-25T02:40:12.191+00:00' }),
                p({ id: 'Coalition_Grey_Wave_Wallet_2_2',     name: "Coalition 'Grey Wave' Wallet 2/2",  soldAt: '2026-06-25T02:40:12.191+00:00' }),
                p({ id: 'Coalition_Racing_Team_Wallet_1_4',   name: "Coalition 'Racing Team' Wallet 1/4", soldAt: '2026-05-22T22:33:38+00:00' }),
                p({ id: 'Coalition_Racing_Team_Wallet_2_4',   name: "Coalition 'Racing Team' Wallet 2/4", soldAt: '2026-05-22T22:33:38+00:00' }),
                p({ id: 'Coalition_Racing_Team_Wallet_3_4',   name: "Coalition 'Racing Team' Wallet 3/4", soldAt: '2026-05-22T22:33:38+00:00' }),
                p({ id: 'Coalition_Racing_Team_Wallet_4_4',   name: "Coalition 'Racing Team' Wallet 4/4", soldAt: '2026-05-22T22:33:38+00:00' }),
                p({ id: 'SKYYBLUEWALLET1_2',                  name: 'COALITION SKYY BLUE WALLET 1/2',       soldAt: '2026-05-22T22:33:38+00:00' }),
                p({ id: 'prod_wallet_004',                    name: 'COALITION SKYY BLUE WALLET 2/2',       soldAt: '2026-05-22T22:33:38+00:00' }),
                p({ id: 'GreenCamoWallet',                    name: 'Coalition Green Camo Wallet',          soldAt: '2026-05-22T22:33:38+00:00' }),
                p({ id: 'Coalition_x_True_Religion_S1',       name: 'Coalition x True Religion 1/1 Jeans S1', soldAt: '2026-03-06T00:00:00Z' }),
                p({ id: 'prod_trust_yourself_hat_01',         name: 'Trust Yourself Custom Trucker 1/1',  soldAt: '2025-01-01T00:00:00Z' }),
                p({ id: 'Coalition_Denim_Patchwork_S1',       name: 'Coalition Denim Patchwork 1/1 Jeans S1', soldAt: '2024-11-08T00:00:00Z' }),
                p({ id: 'prod_wallet_chrome_hearts',          name: 'CUSTOM COALITION X CHROME HEARTS WALLET', soldAt: '2024-06-01T00:00:00Z' }),
                p({ id: 'Coalition_Kustom_Co_Wallet_1_1',     name: "Coalition 'Kustom Co' Wallet 1/1",    soldAt: '2024-06-01T00:00:00Z' }),
            ];
            const sorted = sortArchivedProducts(products);
            const expected = [
                'Coalition_Grey_Wave_Wallet_1_2',
                'Coalition_Grey_Wave_Wallet_2_2',
                'Coalition_Racing_Team_Wallet_1_4',
                'Coalition_Racing_Team_Wallet_2_4',
                'Coalition_Racing_Team_Wallet_3_4',
                'Coalition_Racing_Team_Wallet_4_4',
                'GreenCamoWallet',
                'SKYYBLUEWALLET1_2',
                'prod_wallet_004',
                'Coalition_x_True_Religion_S1',
                'prod_trust_yourself_hat_01',
                'Coalition_Denim_Patchwork_S1',
                'Coalition_Kustom_Co_Wallet_1_1',
                'prod_wallet_chrome_hearts',
            ];
            const actual = sorted.map(x => x.id);
            expect(actual, 'Archive page order. Expected: ' + expected.join(', ') + '. Actual: ' + actual.join(', ')).toEqual(expected);
        });
    });
});
