import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Order } from '../types';

/**
 * LiveOrdersTicker — subtle social-proof ticker below the AnnouncementBar.
 *
 * Renders the latest 5 paid orders from the AppContext orders array as a
 * CSS-only horizontally-scrolling marquee. Each entry shows a thumbnail,
 * the customer name, product name, and size — e.g. "Calieb just claimed
 * the Coalition Set in XL".
 *
 * Design constraints (Coalition brand voice):
 *   - No pulsing icons, no countdowns, no "HOT" badges.
 *   - Thin bar with border-top, low-contrast text.
 *   - CSS animation only — no JS-driven scroll loop.
 *   - Pauses on hover for accessibility.
 */

interface TickerItem {
    customerName: string;
    productName: string;
    productImage: string;
    selectedSize: string;
    productId: string;
    createdAt: string;
}

const MAX_TICKER_ITEMS = 5;

/** Extract display-friendly first name from a full name string. */
const firstName = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return 'Someone';
    const first = parts[0];
    return first.length > 16 ? first.slice(0, 15) + '\u2026' : first;
};

/** Format a single order into ticker items (one per line item). */
const orderToTickerItems = (order: Order): TickerItem[] => {
    return order.items.map((item) => ({
        customerName: order.customerName || 'Someone',
        productName: item.productName || 'a product',
        productImage: item.productImage || '',
        selectedSize: item.selectedSize || 'One Size',
        productId: item.productId || '',
        createdAt: order.createdAt,
    }));
};

const LiveOrdersTicker: React.FC = () => {
    const { orders } = useApp();

    const tickerItems = useMemo<TickerItem[]>(() => {
        const paid = orders.filter((o) => o.paymentStatus === 'paid');
        const sorted = [...paid].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const items: TickerItem[] = [];
        for (const order of sorted) {
            items.push(...orderToTickerItems(order));
            if (items.length >= MAX_TICKER_ITEMS) break;
        }

        return items.slice(0, MAX_TICKER_ITEMS);
    }, [orders]);

    if (tickerItems.length === 0) return null;

    return (
        <div
            className="border-t border-b border-white/[0.04] bg-black overflow-hidden select-none"
            role="status"
            aria-live="polite"
            aria-label="Recent orders activity"
        >
            <div className="flex animate-marquee hover:[animation-play-state:paused]">
                {/* Duplicate the items so the scroll is seamless */}
                {[...tickerItems, ...tickerItems].map((item, i) => (
                    <Link
                        key={`${item.productId}-${i}`}
                        to={item.productId ? `/product/${item.productId}` : '#'}
                        className="flex items-center gap-3 py-2 px-6 shrink-0 text-gray-500 hover:text-gray-300 transition-colors group"
                    >
                        <div className="flex items-center gap-2">
                            {item.productImage ? (
                                <img
                                    src={item.productImage}
                                    alt=""
                                    className="w-6 h-6 rounded object-cover border border-white/5 group-hover:border-white/20 transition-colors"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-6 h-6 rounded bg-gray-800 flex items-center justify-center">
                                    <ShoppingBag className="w-3 h-3 text-gray-600" />
                                </div>
                            )}
                            <span className="text-[11px] whitespace-nowrap">
                                <span className="text-gray-400 font-medium">{firstName(item.customerName)}</span>
                                <span className="mx-1 text-white/30">&middot;</span>
                                <span>claimed</span>
                                <span className="mx-1 text-white/20">&mdash;</span>
                                <span className="text-gray-400 italic">{item.productName}</span>
                                {item.selectedSize !== 'One Size' && (
                                    <>
                                        <span className="mx-1 text-white/30">&middot;</span>
                                        <span className="text-gray-600">{item.selectedSize}</span>
                                    </>
                                )}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default LiveOrdersTicker;
