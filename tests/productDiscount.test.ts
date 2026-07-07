import { describe, expect, it } from 'vitest';
import {
    getCartProductDiscountTotal,
    getDiscountedUnitPrice,
    getEffectiveDiscountPercent,
    getLineItemDiscount,
    resolveEffectiveDiscount,
} from '../utils/productDiscount';

describe('productDiscount helpers', () => {
    describe('getEffectiveDiscountPercent', () => {
        it('returns 0 when product carries no discountPercent', () => {
            expect(getEffectiveDiscountPercent({ price: 40 })).toBe(0);
        });

        it('reads the Shark Tee storefront value (50) verbatim', () => {
            expect(getEffectiveDiscountPercent({ price: 40, discountPercent: 50 })).toBe(50);
        });

        it('clamps > 100 values to 100', () => {
            expect(getEffectiveDiscountPercent({ price: 40, discountPercent: 999 })).toBe(100);
        });

        it('treats negative percent as 0', () => {
            expect(getEffectiveDiscountPercent({ price: 40, discountPercent: -10 })).toBe(0);
        });

        it('treats NaN as 0', () => {
            expect(getEffectiveDiscountPercent({ price: 40, discountPercent: Number.NaN })).toBe(0);
        });
    });

    describe('getLineItemDiscount', () => {
        it('returns 0 when no discount set', () => {
            expect(getLineItemDiscount({ price: 40 })).toBe(0);
        });

        it('computes Shark Tee: $40 at 50% = $20 off', () => {
            expect(getLineItemDiscount({ price: 40, discountPercent: 50 })).toBe(20);
        });

        it('multiplies through quantity (2x Shark Tee = $40 off)', () => {
            expect(getLineItemDiscount({ price: 40, discountPercent: 50 }, 2)).toBe(40);
        });

        it('returns 0 for negative price', () => {
            expect(getLineItemDiscount({ price: -40, discountPercent: 50 })).toBe(0);
        });
    });

    describe('getCartProductDiscountTotal', () => {
        it('returns 0 on an empty cart', () => {
            expect(getCartProductDiscountTotal([])).toBe(0);
        });

        it('sums a single Shark Tee line at quantity 1', () => {
            expect(getCartProductDiscountTotal([
                { id: 'prod_1773860269374', price: 40, discountPercent: 50, quantity: 1, name: '', images: [], description: '', category: 'shirt' },
            ])).toBe(20);
        });

        it('sums mixed discounted + non-discounted items', () => {
            expect(getCartProductDiscountTotal([
                { id: 'shark', price: 40, discountPercent: 50, quantity: 1, name: '', images: [], description: '', category: 'shirt' },
                { id: 'plain', price: 60, quantity: 1, name: '', images: [], description: '', category: 'shirt' },
            ])).toBe(20);
        });

        it('zero-quantity defended as 1 by helper', () => {
            expect(getCartProductDiscountTotal([
                { id: 'shark', price: 40, discountPercent: 50, quantity: 0, name: '', images: [], description: '', category: 'shirt' },
            ])).toBe(20);
        });
    });

    describe('resolveEffectiveDiscount (no-stack rule)', () => {
        it('productDiscount wins when larger', () => {
            expect(resolveEffectiveDiscount(20, 4)).toBe(20);
        });

        it('coupon wins when larger', () => {
            expect(resolveEffectiveDiscount(5, 15)).toBe(15);
        });

        it('ties resolve to either value (max)', () => {
            expect(resolveEffectiveDiscount(12, 12)).toBe(12);
        });

        it('zero + zero resolves to 0', () => {
            expect(resolveEffectiveDiscount(0, 0)).toBe(0);
        });

        it('treats negative input as 0', () => {
            expect(resolveEffectiveDiscount(-5, 10)).toBe(10);
        });
    });

    describe('getDiscountedUnitPrice', () => {
        it('Shark Tee: $40 at 50% -> $20', () => {
            expect(getDiscountedUnitPrice({ price: 40, discountPercent: 50 })).toBe(20);
        });

        it('No discount: returns rounded base price', () => {
            expect(getDiscountedUnitPrice({ price: 60 })).toBe(60);
        });

        it('rounds cents to 2dp', () => {
        expect(getDiscountedUnitPrice({ price: 33, discountPercent: 33 })).toBe(22.11);
    });

    // No-stack invariant locked at the Shark Tee level (the auto-discount SKU).
    // The Shark Tee carries products.discount_percent = 50 -> $20 off.
    // If a cart-wide coupon of $5 is also applied, the smaller layer must be
    // silently dropped by resolveEffectiveDiscount (Math.max wins, no compound).
    // This locks axis #3 of the Batch C code-reviewer's Stripe -- a $25 answer
    // would mean the no-stack rule regressed; a $20 answer means Shark Tee
    // auto-discount survives intact alongside a smaller coupon.
    describe('Shark Tee no-stack with coupon (Batch C hardening)', () => {
        const SHARK = { id: 'prod_1773860269374', price: 40, discountPercent: 50 } as any;
        const NF = { id: 'Coalition_NF_Tee', price: 40, discountPercent: 0 } as any;

        it('Shark Tee alone: cart discount sum is exactly $20', () => {
            expect(getCartProductDiscountTotal([{ ...SHARK, quantity: 1 }])).toBe(20);
        });

        it('Shark Tee + NF Tee: only Shark Tee discount applies, not doubled', () => {
            // NF Tee has no discount -> contributes $0. Shark Tee contributes $20.
            // The math must NOT add up to $40 (would imply stacking).
            expect(
                getCartProductDiscountTotal([
                    { ...SHARK, quantity: 1 },
                    { ...NF, quantity: 1 },
                ])
            ).toBe(20);
        });

        it('resolveEffectiveDiscount: a $5 coupon does NOT stack on top of the Shark Tee $20', () => {
            // couponDiscount = 5 (smaller), productDiscountSum = 20 (larger).
            // Math.max returns 20 -- the coupon is silently dropped, no $25 total.
            expect(resolveEffectiveDiscount(20, 5)).toBe(20);
        });

        it('resolveEffectiveDiscount: the LARGER layer wins regardless of source (no-stack invariant)', () => {
            // The no-stack rule is layer-source-agnostic: whichever layer is larger
            // wins, the smaller is silently dropped. So a $30 coupon over a $20 product
            // discount resolves to $30 -- NEVER $50 (which would imply stacking). A
            // $20/30 answer means the invariant regressed to algebraic sum; a $30
            // answer (the actual expected) means Math.max keeps the dominant layer.
            // Source direction does NOT matter: product-dominant over coupon wins same
            // as coupon-dominant over product.
            expect(resolveEffectiveDiscount(20, 30)).toBe(30);
        });
    });
});
});
