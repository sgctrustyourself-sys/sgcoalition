import { Product } from '../types';

/**
 * Calculate urgency level based on stock.
 *
 * Survives the "Peaceful Space" wedge because it drives the
 * "low-stock" branch of <UrgencyBadge>. The label the badge renders
 * (X remaining) is now neutral — no red, no pulse — but the underlying
 * "this is a low-stock item" decision still needs the threshold.
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
 * Get stock count for display.
 *
 * Feeds the "X remaining" label on <UrgencyBadge type="low-stock">.
 * Sum of sizeInventory, defaulting to 100 (effectively "plenty left")
 * when no inventory tracking is configured.
 */
export const getStockCount = (product: Product): number => {
    if (!product.sizeInventory) return 100;
    return Object.values(product.sizeInventory).reduce((sum, count) => sum + count, 0);
};

/**
 * Compute the live availability fraction shown on limited-edition badges.
 * Returns null when the cap can't be derived so callers can fall back
 * to the static "Limited Edition" label.
 *
 * `cap` is the total units ever available. We require sizeInventory for
 * the cap so the per-size breakdown is preserved -- "5 / 5 available"
 * on a row with no per-size detail is technically accurate but reads
 * as noise. Static "Limited Edition" copy wins in that case.
 *
 * `remaining` is the current available count. We prefer product.stock
 * (the column maintained by /api/complete-order on every order, so it
 * tracks the DB truth across sessions) and fall back to the
 * sizeInventory sum for local-only rendering (where deductInventory
 * mutates sizeInventory directly and the sum is the live truth).
 */
export const getMintFraction = (product: Product): { remaining: number; cap: number } | null => {
    if (!product.sizeInventory) return null;
    const cap = Object.values(product.sizeInventory).reduce((sum, n) => sum + n, 0);
    if (cap <= 0) return null;

    const remaining = typeof product.stock === 'number'
        ? product.stock
        : Object.values(product.sizeInventory).reduce((sum, n) => sum + n, 0);

    return { remaining, cap };
};

// =====================================================================
// FOMO machinery removed as part of the "Peaceful Space" wedge.
//
//   generateViewCount  : simulated "X viewing now" social proof, no
//                        real basis. Card overlay no longer renders it.
//   getRecentSales     : "X sold today" / "sold-recently" badge feed.
//   hasActiveFlashSale : "Flash Sale" badge trigger.
//   getTimeRemaining   : per-second countdown that fed the deleted
//                        components/ui/CountdownTimer.tsx and the
//                        deleted components/PromoBar.tsx.
//   formatTimeRemaining: formatter for the per-second countdown.
//
// All five existed to manufacture urgency. The card, the PDP, the
// announcement bar, and the cart drawer no longer reference any of
// them. The Order type import is no longer needed either; it was only
// referenced by getRecentSales. If a real viewer-count or recent-sales
// signal is wired in later, it should come from a server-side metric
// (e.g. last-hour product_detail views, last-24h paid orders from
// analytics), not client-side random math.
// =====================================================================
