// tests/utils/walletAddOns.test.ts
//
// REGRESSION CATCH: locks wallet add-on pricing logic — keychain clip-on
// calculations for cart items and order items — so future refactors can't
// silently change what buyers pay at checkout.
//
// Contracts being locked:
//
//   isWalletProduct(product):
//     1. Returns true when product.category === 'wallet'
//     2. Returns false for any other category
//     3. Returns false for null/undefined/empty input
//
//   getCartItemAddOnPrice(item):
//     1. Returns WALLET_KEYCHAIN_CLIP_PRICE (10) when keychainClipOn is true
//     2. Returns 0 when keychainClipOn is false/undefined/missing
//
//   getCartItemUnitPrice(item):
//     1. Returns item.price + add-on price when keychainClipOn is true
//     2. Returns item.price when keychainClipOn is false/undefined
//
//   getCartItemLineTotal(item):
//     1. Returns getCartItemUnitPrice(item) * item.quantity
//     2. Works correctly with and without keychain clip-on
//     3. Handles zero quantity and fractional quantities
//
//   getOrderItemAddOnPrice(item):
//     1. Returns addOnPrice when explicitly set (>0)
//     2. Falls back to WALLET_KEYCHAIN_CLIP_PRICE when keychainClipOn is true
//     3. Returns 0 when neither is set
//
//   getOrderItemAddOnLabel(item):
//     1. Returns addOnLabel when present
//     2. Falls back to WALLET_KEYCHAIN_CLIP_LABEL when keychainClipOn is true
//     3. Returns empty string when neither is set
//
//   WALLET_KEYCHAIN_CLIP_PRICE:
//     Must be exactly 10

import { describe, it, expect } from 'vitest';
import {
    isWalletProduct,
    getCartItemAddOnPrice,
    getCartItemUnitPrice,
    getCartItemLineTotal,
    getOrderItemAddOnPrice,
    getOrderItemAddOnLabel,
    WALLET_KEYCHAIN_CLIP_PRICE,
    WALLET_KEYCHAIN_CLIP_LABEL,
} from '../../utils/walletAddOns';

describe('walletAddOns constants', () => {
    it('WALLET_KEYCHAIN_CLIP_PRICE is exactly 10', () => {
        expect(WALLET_KEYCHAIN_CLIP_PRICE).toBe(10);
    });

    it('WALLET_KEYCHAIN_CLIP_LABEL is a non-empty string', () => {
        expect(typeof WALLET_KEYCHAIN_CLIP_LABEL).toBe('string');
        expect(WALLET_KEYCHAIN_CLIP_LABEL.length).toBeGreaterThan(0);
    });
});

describe('isWalletProduct', () => {
    describe('detects wallet products correctly', () => {
        it('returns true for a wallet category', () => {
            expect(isWalletProduct({ category: 'wallet' })).toBe(true);
        });

        it('returns false for shirt category', () => {
            expect(isWalletProduct({ category: 'shirt' })).toBe(false);
        });

        it('returns false for apparel category', () => {
            expect(isWalletProduct({ category: 'apparel' })).toBe(false);
        });

        it('returns false for accessory category', () => {
            expect(isWalletProduct({ category: 'accessory' })).toBe(false);
        });

        it('returns false for jeans category', () => {
            expect(isWalletProduct({ category: 'jeans' })).toBe(false);
        });

        it('returns false for dress category', () => {
            expect(isWalletProduct({ category: 'dress' })).toBe(false);
        });

        it('returns false for headwear category', () => {
            expect(isWalletProduct({ category: 'headwear' })).toBe(false);
        });

        it('returns false for shorts category', () => {
            expect(isWalletProduct({ category: 'shorts' })).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('returns false for null', () => {
            expect(isWalletProduct(null)).toBe(false);
        });

        it('returns false for undefined', () => {
            expect(isWalletProduct(undefined)).toBe(false);
        });

        it('returns false for an object without a category', () => {
            expect(isWalletProduct({} as any)).toBe(false);
        });

        it('returns false for empty string category', () => {
            expect(isWalletProduct({ category: '' as any })).toBe(false);
        });
    });
});

describe('getCartItemAddOnPrice', () => {
    describe('with keychain clip-on', () => {
        it('returns the clip-on price when keychainClipOn is true', () => {
            expect(getCartItemAddOnPrice({ keychainClipOn: true })).toBe(WALLET_KEYCHAIN_CLIP_PRICE);
        });
    });

    describe('without keychain clip-on', () => {
        it('returns 0 when keychainClipOn is false', () => {
            expect(getCartItemAddOnPrice({ keychainClipOn: false })).toBe(0);
        });

        it('returns 0 when keychainClipOn is undefined', () => {
            expect(getCartItemAddOnPrice({ keychainClipOn: undefined })).toBe(0);
        });

        it('returns 0 when keychainClipOn is missing from the object', () => {
            expect(getCartItemAddOnPrice({} as any)).toBe(0);
        });
    });
});

describe('getCartItemUnitPrice', () => {
    describe('without keychain clip-on', () => {
        it('returns the base price unchanged', () => {
            expect(getCartItemUnitPrice({ price: 75, keychainClipOn: false })).toBe(75);
        });

        it('handles zero price', () => {
            expect(getCartItemUnitPrice({ price: 0, keychainClipOn: false })).toBe(0);
        });
    });

    describe('with keychain clip-on', () => {
        it('adds the clip-on price to the base price', () => {
            expect(getCartItemUnitPrice({ price: 75, keychainClipOn: true })).toBe(85);
        });

        it('works with any price value', () => {
            expect(getCartItemUnitPrice({ price: 100, keychainClipOn: true })).toBe(110);
            expect(getCartItemUnitPrice({ price: 450, keychainClipOn: true })).toBe(460);
        });
    });

    describe('edge cases', () => {
        it('handles zero price with clip-on', () => {
            expect(getCartItemUnitPrice({ price: 0, keychainClipOn: true })).toBe(10);
        });
    });
});

describe('getCartItemLineTotal', () => {
    describe('without keychain clip-on', () => {
        it('computes price * quantity', () => {
            expect(getCartItemLineTotal({ price: 75, quantity: 2, keychainClipOn: false })).toBe(150);
        });

        it('handles single quantity', () => {
            expect(getCartItemLineTotal({ price: 75, quantity: 1, keychainClipOn: false })).toBe(75);
        });
    });

    describe('with keychain clip-on', () => {
        it('computes (price + clip-on) * quantity', () => {
            expect(getCartItemLineTotal({ price: 75, quantity: 2, keychainClipOn: true })).toBe(170);
        });

        it('works with single quantity', () => {
            expect(getCartItemLineTotal({ price: 75, quantity: 1, keychainClipOn: true })).toBe(85);
        });
    });

    describe('edge cases', () => {
        it('returns 0 for zero quantity', () => {
            expect(getCartItemLineTotal({ price: 75, quantity: 0, keychainClipOn: false })).toBe(0);
        });

        it('handles quantity of 3 with clip-on', () => {
            expect(getCartItemLineTotal({ price: 40, quantity: 3, keychainClipOn: true })).toBe(150);
        });

        it('handles fractional quantities (should not happen but be safe)', () => {
            expect(getCartItemLineTotal({ price: 10, quantity: 2.5, keychainClipOn: false })).toBe(25);
        });
    });
});

describe('getOrderItemAddOnPrice', () => {
    describe('with explicit addOnPrice', () => {
        it('returns the explicit addOnPrice when > 0', () => {
            expect(getOrderItemAddOnPrice({ addOnPrice: 15, keychainClipOn: false })).toBe(15);
        });

        it('uses addOnPrice even when keychainClipOn is also true', () => {
            expect(getOrderItemAddOnPrice({ addOnPrice: 15, keychainClipOn: true })).toBe(15);
        });

        it('handles fractional addOnPrice', () => {
            expect(getOrderItemAddOnPrice({ addOnPrice: 12.5, keychainClipOn: false })).toBe(12.5);
        });
    });

    describe('without explicit addOnPrice (fallback to keychainClipOn)', () => {
        it('returns clip-on price when keychainClipOn is true', () => {
            expect(getOrderItemAddOnPrice({ addOnPrice: 0, keychainClipOn: true })).toBe(WALLET_KEYCHAIN_CLIP_PRICE);
        });

        it('returns 0 when addOnPrice is undefined and keychainClipOn is false', () => {
            expect(getOrderItemAddOnPrice({ addOnPrice: undefined, keychainClipOn: false })).toBe(0);
        });

        it('returns 0 when addOnPrice is undefined and keychainClipOn is undefined', () => {
            expect(getOrderItemAddOnPrice({} as any)).toBe(0);
        });

        it('returns clip-on price when addOnPrice is undefined but keychainClipOn is true', () => {
            expect(getOrderItemAddOnPrice({ keychainClipOn: true } as any)).toBe(WALLET_KEYCHAIN_CLIP_PRICE);
        });

        it('treats null addOnPrice the same as 0', () => {
            expect(getOrderItemAddOnPrice({ addOnPrice: null, keychainClipOn: false } as any)).toBe(0);
        });

        it('treats NaN addOnPrice as 0', () => {
            expect(getOrderItemAddOnPrice({ addOnPrice: NaN, keychainClipOn: true } as any)).toBe(WALLET_KEYCHAIN_CLIP_PRICE);
        });
    });
});

describe('getOrderItemAddOnLabel', () => {
    describe('with explicit addOnLabel', () => {
        it('returns the explicit label when present', () => {
            expect(getOrderItemAddOnLabel({ addOnLabel: 'Custom chain', keychainClipOn: false })).toBe('Custom chain');
        });

        it('uses addOnLabel even when keychainClipOn is also true', () => {
            expect(getOrderItemAddOnLabel({ addOnLabel: 'Custom chain', keychainClipOn: true })).toBe('Custom chain');
        });
    });

    describe('without explicit addOnLabel (fallback to keychainClipOn)', () => {
        it('returns the standard clip-on label when keychainClipOn is true', () => {
            expect(getOrderItemAddOnLabel({ addOnLabel: undefined, keychainClipOn: true })).toBe(WALLET_KEYCHAIN_CLIP_LABEL);
        });

        it('returns empty string when neither is set', () => {
            expect(getOrderItemAddOnLabel({ addOnLabel: undefined, keychainClipOn: false })).toBe('');
        });

        it('returns empty string when addOnLabel is empty string', () => {
            expect(getOrderItemAddOnLabel({ addOnLabel: '', keychainClipOn: false })).toBe('');
        });

        it('returns empty string for undefined input', () => {
            expect(getOrderItemAddOnLabel({} as any)).toBe('');
        });
    });
});
