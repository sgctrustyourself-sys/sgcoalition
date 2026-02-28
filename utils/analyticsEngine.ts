import { Order, Product } from '../types';

export interface SalesMetrics {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    conversionRate: number;
}

export interface RevenueDataPoint {
    date: string;
    revenue: number;
}

export interface PopularProduct {
    productId: string;
    productName: string;
    unitsSold: number;
    revenue: number;
}

export interface CustomerStats {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    repeatPurchaseRate: number;
}

/**
 * Calculate overall sales metrics
 */
export const calculateSalesMetrics = (orders: Order[]): SalesMetrics => {
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const conversionRate = 0.35; // Mock: 35% conversion rate

    return {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        conversionRate
    };
};

/**
 * Get revenue over time (last N days)
 */
export const getRevenueOverTime = (orders: Order[], days: number = 30): RevenueDataPoint[] => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Create date buckets
    const dateBuckets: Record<string, number> = {};

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now - i * dayMs);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dateBuckets[dateStr] = 0;
    }

    // Fill buckets with order data
    orders.forEach(order => {
        const orderDate = new Date(order.createdAt);
        const dateStr = orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (dateBuckets[dateStr] !== undefined) {
            dateBuckets[dateStr] += order.total;
        }
    });

    return Object.entries(dateBuckets).map(([date, revenue]) => ({
        date,
        revenue
    }));
};

/**
 * Get top products by sales
 */
export const getTopProducts = (orders: Order[], products: Product[], limit: number = 10): PopularProduct[] => {
    const productStats: Record<string, { unitsSold: number; revenue: number }> = {};

    orders.forEach(order => {
        order.items.forEach(item => {
            if (!productStats[item.productId]) {
                productStats[item.productId] = { unitsSold: 0, revenue: 0 };
            }
            productStats[item.productId].unitsSold += item.quantity;
            productStats[item.productId].revenue += item.price * item.quantity;
        });
    });

    return Object.entries(productStats)
        .map(([productId, stats]) => {
            const product = products.find(p => p.id === productId);
            return {
                productId,
                productName: product?.name || 'Unknown Product',
                unitsSold: stats.unitsSold,
                revenue: stats.revenue
            };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
};

/**
 * Calculate customer statistics
 */
export const getCustomerStats = (orders: Order[]): CustomerStats => {
    const customerOrders: Record<string, number> = {};

    orders.forEach(order => {
        const customerId = order.userId || 'guest';
        customerOrders[customerId] = (customerOrders[customerId] || 0) + 1;
    });

    const totalCustomers = Object.keys(customerOrders).length;
    const returningCustomers = Object.values(customerOrders).filter(count => count > 1).length;
    const newCustomers = totalCustomers - returningCustomers;
    const repeatPurchaseRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

    return {
        totalCustomers,
        newCustomers,
        returningCustomers,
        repeatPurchaseRate
    };
};
