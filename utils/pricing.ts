import { SGCOIN_DISCOUNT_ENABLED, SGCOIN_DISCOUNT_PERCENTAGE } from '../constants';

/**
 * Calculate the SGCoin discounted price
 */
export function calculateSGCoinPrice(basePrice: number): number {
    if (!SGCOIN_DISCOUNT_ENABLED) {
        return basePrice;
    }

    const discountMultiplier = 1 - (SGCOIN_DISCOUNT_PERCENTAGE / 100);
    return basePrice * discountMultiplier;
}

/**
 * Calculate the discount amount
 */
export function calculateDiscount(basePrice: number): number {
    return basePrice - calculateSGCoinPrice(basePrice);
}

/**
 * Calculate discount for cart total
 */
export function calculateCartDiscount(cartTotal: number): number {
    return calculateDiscount(cartTotal);
}

/**
 * Get discount percentage as string
 */
export function getDiscountPercentageText(): string {
    return `${SGCOIN_DISCOUNT_PERCENTAGE}%`;
}

/**
 * Check if SGCoin discount is enabled
 */
export function isSGCoinDiscountEnabled(): boolean {
    return SGCOIN_DISCOUNT_ENABLED;
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
    return `$${price.toFixed(2)}`;
}

/**
 * Calculate order totals with optional SGCoin discount
 */
export function calculateOrderTotals(
    subtotal: number,
    shippingCost: number,
    useSGCoinDiscount: boolean = false
) {
    const discount = useSGCoinDiscount ? calculateDiscount(subtotal) : 0;
    const discountedSubtotal = subtotal - discount;
    const total = discountedSubtotal + shippingCost;

    return {
        subtotal,
        discount,
        discountedSubtotal,
        shippingCost,
        total,
        savings: discount
    };
}
