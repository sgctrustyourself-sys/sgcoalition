// tests/utils/pricing.test.ts
//
// REGRESSION CATCH: locks pricing utility behaviour — SGCoin discount,
// cart discount calculation, order totals, and price formatting —
// so future refactors can't silently change what buyers see at checkout.
//
// Contracts being locked:
//
//   formatPrice(price):
//     1. Returns "$X.XX" format
//     2. Handles whole numbers, decimals, and zero
//
//   calculateOrderTotals(subtotal, shippingCost, useSGCoinDiscount):
//     1. Returns correct structure with subtotal, discount, shippingCost, total, savings
//     2. Applies SGCoin discount only when useSGCoinDiscount is true AND
//        the SGCoin discount is enabled via constants
//
//   isSGCoinDiscountEnabled():
//     1. Returns the value of SGCOIN_DISCOUNT_ENABLED from constants
//
//   getDiscountPercentageText():
//     1. Returns the configured percentage as a string
//
//   calculateSGCoinPrice(basePrice):
//     1. Returns basePrice when SGCoin discount is disabled
//     2. Returns basePrice * (1 - percentage/100) when enabled
//
//   calculateDiscount(basePrice) / calculateCartDiscount(cartTotal):
//     Same delegation as calculateSGCoinPrice
//
// MOCK STRATEGY: Each describe block that needs a different discount state
// uses vi.doMock (NON-hoisted) inside its beforeAll, so the mock applies
// only to that describe block's module import. afterAll calls
// vi.unmock('../../constants') so subsequent blocks start clean.

import { describe, it, expect, vi, beforeAll } from 'vitest';

// vi.unmock is hoisted — place it at module top level so vitest doesn't warn.
vi.unmock('../../constants');

// ─────────────────────────────────────────────────────────────────────────────
// Default state — SGCoin discount disabled (explicitly mocked)
// ─────────────────────────────────────────────────────────────────────────────
describe('pricing — default state (discount disabled)', () => {
    let pricing: typeof import('../../utils/pricing');

    beforeAll(async () => {
        vi.doMock('../../constants', async (importOriginal) => {
            const actual = await importOriginal<typeof import('../../constants')>();
            return {
                ...actual!,
                SGCOIN_DISCOUNT_ENABLED: false,
                SGCOIN_DISCOUNT_PERCENTAGE: 10,
            };
        });
        vi.resetModules();
        pricing = await import('../../utils/pricing');
    });

    describe('formatPrice', () => {
        it('returns $0.00 for zero', () => {
            expect(pricing.formatPrice(0)).toBe('$0.00');
        });

        it('formats whole dollars correctly', () => {
            expect(pricing.formatPrice(75)).toBe('$75.00');
            expect(pricing.formatPrice(100)).toBe('$100.00');
            expect(pricing.formatPrice(450)).toBe('$450.00');
        });

        it('formats cents correctly', () => {
            expect(pricing.formatPrice(75.5)).toBe('$75.50');
            expect(pricing.formatPrice(99.99)).toBe('$99.99');
        });

        it('rounds fractional values with toFixed behaviour', () => {
            // JavaScript's toFixed(2) uses IEEE 754 — 0.045 is stored
            // slightly less than 0.045 in binary, so toFixed(2) gives "0.04".
            expect(pricing.formatPrice(0.045)).toBe('$0.04');
            expect(pricing.formatPrice(0.044)).toBe('$0.04');
        });

        it('handles negative prices (should not happen but be safe)', () => {
            expect(pricing.formatPrice(-10)).toBe('$-10.00');
        });

        it('handles large numbers', () => {
            expect(pricing.formatPrice(1000000)).toBe('$1000000.00');
        });
    });

    describe('isSGCoinDiscountEnabled', () => {
        it('returns false (explicitly mocked to disabled)', () => {
            expect(pricing.isSGCoinDiscountEnabled()).toBe(false);
        });
    });

    describe('getDiscountPercentageText', () => {
        it('returns "10%" (the fallback default from constants)', () => {
            expect(pricing.getDiscountPercentageText()).toBe('10%');
        });
    });

    describe('calculateSGCoinPrice', () => {
        it('returns the base price unchanged when discount is disabled', () => {
            expect(pricing.calculateSGCoinPrice(100)).toBe(100);
        });

        it('returns 0 for base price of 0', () => {
            expect(pricing.calculateSGCoinPrice(0)).toBe(0);
        });

        it('returns negative prices unchanged', () => {
            expect(pricing.calculateSGCoinPrice(-50)).toBe(-50);
        });
    });

    describe('calculateDiscount / calculateCartDiscount', () => {
        it('returns 0 for any base price when discount is disabled', () => {
            expect(pricing.calculateDiscount(100)).toBe(0);
            expect(pricing.calculateDiscount(0)).toBe(0);
            expect(pricing.calculateDiscount(-50)).toBe(0);
            expect(pricing.calculateCartDiscount(100)).toBe(0);
        });
    });

    describe('calculateOrderTotals', () => {
        it('returns totals with zero discount when useSGCoinDiscount=false', () => {
            const result = pricing.calculateOrderTotals(100, 10, false);
            expect(result).toEqual({
                subtotal: 100,
                discount: 0,
                discountedSubtotal: 100,
                shippingCost: 10,
                total: 110,
                savings: 0,
            });
        });

        it('useSGCoinDiscount=true still gives 0 discount when SGCOIN_DISCOUNT_ENABLED is false', () => {
            const result = pricing.calculateOrderTotals(100, 10, true);
            expect(result.discount).toBe(0);
            expect(result.discountedSubtotal).toBe(100);
            expect(result.total).toBe(110);
        });

        it('handles free shipping', () => {
            const result = pricing.calculateOrderTotals(75, 0, false);
            expect(result.total).toBe(75);
            expect(result.shippingCost).toBe(0);
        });

        it('handles zero subtotal with shipping', () => {
            const result = pricing.calculateOrderTotals(0, 5, false);
            expect(result.total).toBe(5);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Discount enabled at 10% — vi.doMock in beforeAll so only this block
// sees the mocked constants.
// ─────────────────────────────────────────────────────────────────────────────
describe('pricing — 10% discount enabled', () => {
    let pricing: typeof import('../../utils/pricing');

    beforeAll(async () => {
        vi.doMock('../../constants', async (importOriginal) => {
            const actual = await importOriginal<typeof import('../../constants')>();
            return {
                ...actual!,
                SGCOIN_DISCOUNT_ENABLED: true,
                SGCOIN_DISCOUNT_PERCENTAGE: 10,
            };
        });
        vi.resetModules();
        pricing = await import('../../utils/pricing');
    });

    describe('isSGCoinDiscountEnabled', () => {
        it('returns true', () => {
            expect(pricing.isSGCoinDiscountEnabled()).toBe(true);
        });
    });

    describe('getDiscountPercentageText', () => {
        it('returns "10%"', () => {
            expect(pricing.getDiscountPercentageText()).toBe('10%');
        });
    });

    describe('calculateSGCoinPrice', () => {
        it('applies a 10% discount', () => {
            expect(pricing.calculateSGCoinPrice(100)).toBe(90);
        });

        it('returns 0 for base price of 0', () => {
            expect(pricing.calculateSGCoinPrice(0)).toBe(0);
        });

        it('handles fractional prices correctly', () => {
            expect(pricing.calculateSGCoinPrice(75.5)).toBeCloseTo(67.95);
        });
    });

    describe('calculateDiscount / calculateCartDiscount', () => {
        it('returns 10 for a base price of 100', () => {
            expect(pricing.calculateDiscount(100)).toBe(10);
            expect(pricing.calculateCartDiscount(100)).toBe(10);
        });

        it('returns 0 for 0 base price', () => {
            expect(pricing.calculateDiscount(0)).toBe(0);
        });

        it('computes discount for fractional prices', () => {
            expect(pricing.calculateDiscount(75.5)).toBeCloseTo(7.55);
        });

        it('calculateCartDiscount delegates to calculateDiscount', () => {
            expect(pricing.calculateCartDiscount(200)).toBe(pricing.calculateDiscount(200));
        });
    });

    describe('calculateOrderTotals', () => {
        it('applies discount to subtotal when useSGCoinDiscount=true', () => {
            const result = pricing.calculateOrderTotals(100, 10, true);
            expect(result.discount).toBe(10);
            expect(result.discountedSubtotal).toBe(90);
            expect(result.total).toBe(100);
            expect(result.savings).toBe(10);
        });

        it('useSGCoinDiscount=false skips the discount', () => {
            const result = pricing.calculateOrderTotals(100, 0, false);
            expect(result.discount).toBe(0);
            expect(result.total).toBe(100);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Custom discount percentage at 25%
// ─────────────────────────────────────────────────────────────────────────────
describe('pricing — 25% discount enabled', () => {
    let pricing: typeof import('../../utils/pricing');

    beforeAll(async () => {
        vi.doMock('../../constants', async (importOriginal) => {
            const actual = await importOriginal<typeof import('../../constants')>();
            return {
                ...actual!,
                SGCOIN_DISCOUNT_ENABLED: true,
                SGCOIN_DISCOUNT_PERCENTAGE: 25,
            };
        });
        vi.resetModules();
        pricing = await import('../../utils/pricing');
    });

    it('getDiscountPercentageText returns "25%"', () => {
        expect(pricing.getDiscountPercentageText()).toBe('25%');
    });

    it('calculateSGCoinPrice applies a 25% discount', () => {
        expect(pricing.calculateSGCoinPrice(100)).toBe(75);
    });

    it('calculateDiscount returns 25 for a base price of 100', () => {
        expect(pricing.calculateDiscount(100)).toBe(25);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 0% discount — verify no price change
// ─────────────────────────────────────────────────────────────────────────────
describe('pricing — 0% discount enabled', () => {
    let pricing: typeof import('../../utils/pricing');

    beforeAll(async () => {
        vi.doMock('../../constants', async (importOriginal) => {
            const actual = await importOriginal<typeof import('../../constants')>();
            return {
                ...actual!,
                SGCOIN_DISCOUNT_ENABLED: true,
                SGCOIN_DISCOUNT_PERCENTAGE: 0,
            };
        });
        vi.resetModules();
        pricing = await import('../../utils/pricing');
    });

    it('calculateSGCoinPrice returns full price with 0% discount', () => {
        expect(pricing.calculateSGCoinPrice(100)).toBe(100);
    });

    it('calculateDiscount returns 0 with 0% discount', () => {
        expect(pricing.calculateDiscount(100)).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 100% discount — verify full discount
// ─────────────────────────────────────────────────────────────────────────────
describe('pricing — 100% discount enabled', () => {
    let pricing: typeof import('../../utils/pricing');

    beforeAll(async () => {
        vi.doMock('../../constants', async (importOriginal) => {
            const actual = await importOriginal<typeof import('../../constants')>();
            return {
                ...actual!,
                SGCOIN_DISCOUNT_ENABLED: true,
                SGCOIN_DISCOUNT_PERCENTAGE: 100,
            };
        });
        vi.resetModules();
        pricing = await import('../../utils/pricing');
    });

    it('calculateSGCoinPrice returns 0 with 100% discount', () => {
        expect(pricing.calculateSGCoinPrice(100)).toBe(0);
    });

    it('calculateDiscount returns 100 for a base price of 100', () => {
        expect(pricing.calculateDiscount(100)).toBe(100);
    });
});
