import { Product, Order } from '../types';

/**
 * Calculate urgency level based on stock
 */
export const getStockUrgency = (product: Product): 'critical' | 'low' | 'normal' => {
    const totalStock = product.sizeInventory
        ? Object.values(product.sizeInventory).reduce((sum, count) => sum + count, 0)
        : 100; // Default if no inventory tracking

    if (totalStock <= 3) return 'critical';
    if (totalStock <= 10) return 'low';
    return 'normal';
};

/**
 * Get stock count for display
 */
export const getStockCount = (product: Product): number => {
    if (!product.sizeInventory) return 100;
    return Object.values(product.sizeInventory).reduce((sum, count) => sum + count, 0);
};

/**
 * Generate realistic view count (simulated social proof)
 */
export const generateViewCount = (product: Product): number => {
    const baseViews = Math.floor(Math.random() * 10) + 5; // 5-15
    let bonus = 0;

    // Featured products get more views
    if (product.isFeatured) {
        bonus += Math.floor(Math.random() * 10) + 5; // +5-15
    }

    // Low stock creates urgency, more views
    const urgency = getStockUrgency(product);
    if (urgency === 'critical') {
        bonus += Math.floor(Math.random() * 8) + 3; // +3-11
    } else if (urgency === 'low') {
        bonus += Math.floor(Math.random() * 5) + 2; // +2-7
    }

    // Higher priced items tend to have fewer but more serious viewers
    if (product.price > 100) {
        return Math.max(3, Math.floor((baseViews + bonus) * 0.6));
    }

    return baseViews + bonus;
};

/**
 * Calculate how many units sold in last 24 hours
 */
export const getRecentSales = (productId: string, orders: Order[]): number => {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

    return orders
        .filter(order => new Date(order.createdAt).getTime() > twentyFourHoursAgo)
        .reduce((total, order) => {
            const productItems = order.items.filter(item => item.productId === productId);
            return total + productItems.reduce((sum, item) => sum + item.quantity, 0);
        }, 0);
};

/**
 * Check if product has active flash sale
 */
export const hasActiveFlashSale = (product: Product): boolean => {
    if (!product.saleEndDate) return false;
    return new Date(product.saleEndDate).getTime() > Date.now();
};

/**
 * Get time remaining for flash sale
 */
export const getTimeRemaining = (endDate: string): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    total: number;
} => {
    const total = new Date(endDate).getTime() - Date.now();

    if (total <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
    }

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { days, hours, minutes, seconds, total };
};

/**
 * Format time remaining as string
 */
export const formatTimeRemaining = (endDate: string): string => {
    const { days, hours, minutes, seconds } = getTimeRemaining(endDate);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
};
