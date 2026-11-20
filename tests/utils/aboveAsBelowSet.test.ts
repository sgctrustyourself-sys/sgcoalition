// tests/utils/aboveAsBelowSet.test.ts
//
// REGRESSION CATCH: locks the Above-as-Below tee + shorts set bonus logic
// so future refactors can't silently change the $30 auto-discount.
//
// Contracts being locked:
//
//   calculateAboveAsBelowSetBonusCents(items):
//     1. Returns ABOVE_AS_BELOW_SET_BONUS_CENTS (3000 = $30) when the cart
//        contains at least one tee AND one shorts product.
//     2. Returns 0 when the cart lacks either the tee or the shorts.
//     3. One-shot $30 cap: extra quantities of either piece do NOT stack
//        additional bonuses (2 tees + 2 shorts = still $30, not $60).
//     4. Accepts either `{productId, quantity}[]` objects or a flat
//        `string[]` of IDs (back-compat).
//     5. Tolerates missing/undefined/null items.
//     6. Returns 0 for empty input.

import { describe, it, expect } from 'vitest';
import { PRODUCT_IDS } from '../../constants/productIds';
import {
    calculateAboveAsBelowSetBonusCents,
    ABOVE_AS_BELOW_SET_BONUS_CENTS,
} from '../../utils/aboveAsBelowSet';

describe('aboveAsBelowSet constants', () => {
    it('tee ID matches PRODUCT_IDS.ABOVE_AS_BELOW_TEE', () => {
        expect(PRODUCT_IDS.ABOVE_AS_BELOW_TEE).toBe('prod_tee_above_as_below');
    });

    it('shorts ID matches PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS', () => {
        expect(PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS).toBe('prod_shorts_above_as_below');
    });

    it('set bonus is exactly 3000 cents ($30)', () => {
        expect(ABOVE_AS_BELOW_SET_BONUS_CENTS).toBe(3000);
    });
});

describe('calculateAboveAsBelowSetBonusCents', () => {
    describe('full set in cart (tee + shorts)', () => {
        it('returns 3000 when both tee and shorts are present', () => {
            const items = [
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_TEE, quantity: 1 },
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS, quantity: 1 },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(3000);
        });

        it('uses the `id` field when `productId` is missing', () => {
            const items = [
                { id: PRODUCT_IDS.ABOVE_AS_BELOW_TEE },
                { id: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items as any)).toBe(3000);
        });

        it('accepts a flat string[] of IDs', () => {
            const items = [PRODUCT_IDS.ABOVE_AS_BELOW_TEE, PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(3000);
        });

        it('works when items arrive in any order (shorts first)', () => {
            const items = [
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS, quantity: 1 },
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_TEE, quantity: 1 },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(3000);
        });

        it('works when there are many unrelated items plus the set', () => {
            const items = [
                { productId: 'unrelated-wallet', quantity: 1 },
                { productId: 'unrelated-hat', quantity: 2 },
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_TEE, quantity: 1 },
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS, quantity: 1 },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(3000);
        });
    });

    describe('one-shot $30 cap (no stacking)', () => {
        it('multiple tees + single shorts still only saves $30', () => {
            const items = [
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_TEE, quantity: 3 },
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS, quantity: 1 },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(3000);
        });

        it('single tee + multiple shorts still only saves $30', () => {
            const items = [
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_TEE, quantity: 1 },
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS, quantity: 5 },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(3000);
        });

        it('multiple tees + multiple shorts still only saves $30', () => {
            const items = [
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_TEE, quantity: 2 },
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS, quantity: 2 },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(3000);
        });
    });

    describe('incomplete set (no bonus)', () => {
        it('returns 0 when only the tee is present', () => {
            const items = [
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_TEE, quantity: 1 },
                { productId: 'unrelated-item', quantity: 1 },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(0);
        });

        it('returns 0 when only the shorts are present', () => {
            const items = [
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS, quantity: 1 },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(0);
        });

        it('returns 0 when both pieces are absent', () => {
            const items = [
                { productId: 'other-product-1', quantity: 1 },
                { productId: 'other-product-2', quantity: 2 },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(0);
        });

        it('returns 0 with only unrelated items', () => {
            const items = [
                { productId: 'prod_halo_mini_dress', quantity: 1 },
                { productId: 'Coalition_Grey_Wave_Wallet_2_2', quantity: 1 },
            ];
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(0);
        });
    });

    describe('edge cases', () => {
        it('returns 0 for an empty array', () => {
            expect(calculateAboveAsBelowSetBonusCents([])).toBe(0);
        });

        it('returns 0 when items is undefined', () => {
            expect(calculateAboveAsBelowSetBonusCents(undefined)).toBe(0);
        });

        it('tolerates items with missing fields gracefully', () => {
            const items = [
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_TEE },
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS },
            ];
            // Both have no `quantity` — still works because the function
            // only matches on productId, not quantity.
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(3000);
        });

        it('trims whitespace from product IDs', () => {
            const items = [
                `  ${PRODUCT_IDS.ABOVE_AS_BELOW_TEE}  `,
                `  ${PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS}  `,
            ];
            // Flat string[] — each string is used as-is, no trimming happens
            // in the main function (only object paths use .trim()).
            // These padded IDs won't match because the function doesn't
            // trim string[] inputs — only object inputs via extractProductId.
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(0);
        });

        it('handles null items in the array', () => {
            const items = [
                null,
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_TEE, quantity: 1 },
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS, quantity: 1 },
            ];
            // The null item causes extractProductId to return 'null'
            // (String(null) = 'null'), which doesn't match tee or shorts,
            // so the set bonus should still apply.
            expect(calculateAboveAsBelowSetBonusCents(items as any)).toBe(3000);
        });
    });

    describe('input format compatibility', () => {
        it('handles mixed object and string inputs (via type union)', () => {
            // In practice the function signature accepts `SetBonusItemInput[] | string[]`
            // but mixing both in one array is not supported — each element
            // is handled uniformly: strings stay strings, objects get their
            // id extracted. This test documents the actual behavior.
            const items: any[] = [
                PRODUCT_IDS.ABOVE_AS_BELOW_TEE,
                { productId: PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS, quantity: 1 },
            ];
            // The first (string) matches, the second (object) matches via productId
            expect(calculateAboveAsBelowSetBonusCents(items)).toBe(3000);
        });

        it('processes items with non-object truthy values', () => {
            expect(calculateAboveAsBelowSetBonusCents([true as any, PRODUCT_IDS.ABOVE_AS_BELOW_TEE, PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS])).toBe(3000);
            expect(calculateAboveAsBelowSetBonusCents([false as any, PRODUCT_IDS.ABOVE_AS_BELOW_TEE, PRODUCT_IDS.ABOVE_AS_BELOW_SHORTS])).toBe(3000);
        });
    });
});
