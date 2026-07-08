// utils/productDiscount.ts
// ----------------------------------------------------------------------------
// Pure helpers for the per-product discountPercent auto-discount introduced
// in supabase/migrations/20260704_add_discount_percent_to_products.sql. The
// store never coupons-and-discount stack: at checkout we honor the larger of
// (cart sum of product discounts) vs (cart-wide coupon discount), and the
// smaller is dropped. SGCoin payment-method savings apply AFTER this
// resolution on the remaining payable base, mirroring the existing
// crypto-pays-saves layering documented in utils/pricing.ts.
//
// All units are dollars (matching AppContext/cartTotal which already converts
// cents -> dollars at the boundary). No network calls; safe in tests.
// ----------------------------------------------------------------------------

import { Product } from '../types';

/**
 * Returns the discount percentage applied to a single product line, clamped
 * to the [0, 100] range. Defensive against bad operator input (negative
 * percent, percent > 100) so the cart math never goes negative.
 */
export function getEffectiveDiscountPercent(product: Pick<Product, 'discountPercent'> | Product): number {
    const raw = Number(product?.discountPercent);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(raw, 100);
}

/**
 * Per-line discount in dollars. Returns 0 for non-discounted products.
 * Multiplies by quantity so quantity-2 Shark Tee at \$40 at 50% = \$40 off.
 */
export function getLineItemDiscount(
    product: Pick<Product, 'price' | 'discountPercent'> | Product,
    quantity: number = 1,
): number {
    const pct = getEffectiveDiscountPercent(product);
    if (pct === 0) return 0;
    const unit = Math.max(0, Number(product?.price) || 0);
    return unit * (pct / 100) * Math.max(1, quantity);
}

/**
 * Sum of all product discounts across the cart, in dollars. Returns 0 when
 * no item carries discountPercent. Walks every cart item so quantity > 1
 * multiplies through.
 */
export function getCartProductDiscountTotal(cart: ReadonlyArray<Product & { quantity: number }>): number {
    let sum = 0;
    for (const item of cart) {
        sum += getLineItemDiscount(item, item.quantity);
    }
    return Math.round(sum * 100) / 100;
}

/**
 * No-stack resolver. Returns the discount that actually applies to the
 * subtotal: the larger of the cart product discount sum and the cart-wide
 * coupon discount. The smaller is silently dropped - per user spec
 * ("Replace them (no stack)"): they never compound.
 *
 * Inputs are dollars. Returns a dollars value in [0, larger input].
 */
export function resolveEffectiveDiscount(
    productDiscountSum: number,
    couponDiscount: number,
): number {
    const products = Math.max(0, productDiscountSum || 0);
    const coupon = Math.max(0, couponDiscount || 0);
    return Math.max(products, coupon);
}

/**
 * Returns the discounted unit price for a single product. Convenience
 * helper for the PDP / ProductCard render: \$40 at 50% -> \$20.
 */
export function getDiscountedUnitPrice(product: Pick<Product, 'price' | 'discountPercent'> | Product): number {
    const pct = getEffectiveDiscountPercent(product);
    const unit = Math.max(0, Number(product?.price) || 0);
    return Math.round(unit * (1 - pct / 100) * 100) / 100;
}
