import { Product, CartItem } from '../types';

// Shipping tier configuration
export interface ShippingTier {
    min: number;
    max: number;
    cost: number;
    message: string;
}

export const SHIPPING_TIERS: ShippingTier[] = [
    { min: 0, max: 50, cost: 5.99, message: "Add $X for reduced shipping!" },
    { min: 50, max: 100, cost: 2.99, message: "Add $X for FREE shipping!" },
    { min: 100, max: Infinity, cost: 0, message: "🎉 You've earned FREE shipping!" }
];

// Bundle discount configuration
export interface BundleDiscount {
    itemCount: number;
    discountPercentage: number;
    description: string;
}

export const BUNDLE_DISCOUNTS: BundleDiscount[] = [
    { itemCount: 2, discountPercentage: 5, description: "Save 5% on 2 items" },
    { itemCount: 3, discountPercentage: 10, description: "Save 10% on 3 items" },
    { itemCount: 4, discountPercentage: 15, description: "Save 15% on 4+ items" }
];

/**
 * Calculate shipping cost based on cart total
 */
export const calculateShippingCost = (cartTotal: number): number => {
    const tier = SHIPPING_TIERS.find(t => cartTotal >= t.min && cartTotal < t.max);
    return tier?.cost || 0;
};

/**
 * Get current shipping tier
 */
export const getCurrentShippingTier = (cartTotal: number): ShippingTier => {
    return SHIPPING_TIERS.find(t => cartTotal >= t.min && cartTotal < t.max) || SHIPPING_TIERS[SHIPPING_TIERS.length - 1];
};

/**
 * Get next shipping threshold info
 */
export const getNextShippingThreshold = (cartTotal: number): {
    threshold: number;
    amountNeeded: number;
    currentTier: ShippingTier;
    nextTier: ShippingTier | null;
    progress: number;
} | null => {
    const currentTier = getCurrentShippingTier(cartTotal);
    const currentIndex = SHIPPING_TIERS.indexOf(currentTier);
    const nextTier = currentIndex < SHIPPING_TIERS.length - 1 ? SHIPPING_TIERS[currentIndex + 1] : null;

    if (!nextTier) {
        return null; // Already at max tier
    }

    const threshold = nextTier.min;
    const amountNeeded = Math.max(0, threshold - cartTotal);
    const progress = Math.min(100, (cartTotal / threshold) * 100);

    return {
        threshold,
        amountNeeded,
        currentTier,
        nextTier,
        progress
    };
};

/**
 * Calculate bundle discount based on number of items
 */
export const calculateBundleDiscount = (itemCount: number): BundleDiscount | null => {
    // Find the highest applicable discount
    const applicableDiscounts = BUNDLE_DISCOUNTS.filter(d => itemCount >= d.itemCount);
    if (applicableDiscounts.length === 0) return null;

    return applicableDiscounts.reduce((max, current) =>
        current.discountPercentage > max.discountPercentage ? current : max
    );
};

/**
 * Apply bundle discount to total price
 */
export const applyBundleDiscount = (totalPrice: number, itemCount: number): {
    originalPrice: number;
    discountedPrice: number;
    savings: number;
    discountPercentage: number;
} => {
    const discount = calculateBundleDiscount(itemCount);

    if (!discount) {
        return {
            originalPrice: totalPrice,
            discountedPrice: totalPrice,
            savings: 0,
            discountPercentage: 0
        };
    }

    const discountAmount = totalPrice * (discount.discountPercentage / 100);
    const discountedPrice = totalPrice - discountAmount;

    return {
        originalPrice: totalPrice,
        discountedPrice,
        savings: discountAmount,
        discountPercentage: discount.discountPercentage
    };
};

/**
 * Get upsell product recommendations based on cart contents
 */
export const getUpsellProducts = (
    cartItems: CartItem[],
    allProducts: Product[],
    limit: number = 4
): Product[] => {
    if (cartItems.length === 0) {
        // If cart is empty, show featured or best sellers
        return allProducts
            .filter(p => !p.archived && p.isFeatured)
            .slice(0, limit);
    }

    // Get categories from cart items
    const cartCategories = new Set(cartItems.map(item => item.category));
    const cartProductIds = new Set(cartItems.map(item => item.id));

    // Find products in same categories that aren't in cart
    const recommendations = allProducts.filter(product =>
        !product.archived &&
        !cartProductIds.has(product.id) &&
        cartCategories.has(product.category)
    );

    // If not enough recommendations, add featured products
    if (recommendations.length < limit) {
        const additionalProducts = allProducts.filter(product =>
            !product.archived &&
            !cartProductIds.has(product.id) &&
            !recommendations.includes(product) &&
            product.isFeatured
        );
        recommendations.push(...additionalProducts);
    }

    // Return limited number of recommendations
    return recommendations.slice(0, limit);
};

/**
 * Get products that help reach free shipping threshold
 */
export const getProductsToReachThreshold = (
    cartTotal: number,
    allProducts: Product[],
    cartProductIds: Set<string>,
    limit: number = 3
): Product[] => {
    const thresholdInfo = getNextShippingThreshold(cartTotal);
    if (!thresholdInfo) return [];

    const { amountNeeded } = thresholdInfo;

    // Find products close to the amount needed
    const suitableProducts = allProducts
        .filter(p =>
            !p.archived &&
            !cartProductIds.has(p.id) &&
            p.price <= amountNeeded + 20 && // Within $20 of amount needed
            p.price >= amountNeeded - 10    // Not too cheap
        )
        .sort((a, b) => {
            // Prefer products closer to the exact amount needed
            const diffA = Math.abs(a.price - amountNeeded);
            const diffB = Math.abs(b.price - amountNeeded);
            return diffA - diffB;
        });

    return suitableProducts.slice(0, limit);
};

/**
 * Calculate total savings (bundle discount + free shipping)
 */
export const calculateTotalSavings = (
    cartTotal: number,
    itemCount: number
): {
    bundleSavings: number;
    shippingSavings: number;
    totalSavings: number;
} => {
    const bundleInfo = applyBundleDiscount(cartTotal, itemCount);
    const currentShippingCost = calculateShippingCost(cartTotal);
    const potentialShippingCost = calculateShippingCost(bundleInfo.discountedPrice);
    const shippingSavings = currentShippingCost - potentialShippingCost;

    return {
        bundleSavings: bundleInfo.savings,
        shippingSavings: Math.max(0, shippingSavings),
        totalSavings: bundleInfo.savings + Math.max(0, shippingSavings)
    };
};
