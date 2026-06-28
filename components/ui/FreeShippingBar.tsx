import React, { useEffect, useState } from 'react';
import { Truck, TrendingUp, Sparkles } from 'lucide-react';
import { getNextShippingThreshold } from '../../utils/upsellUtils';

interface FreeShippingBarProps {
    cartTotal: number;
    /**
     * True when at least one cart line has freeShipping: true (e.g., the
     * wallets, the Above-as-Below tee + shorts, and the Overwhelmingly
     * Patient hoodie). Without this flag the bar would still plead
     * "add $X more for free shipping" on orders that already include a
     * line which ships at $0 today — confusing. Mirrors how
     * CompleteTheFitCart reassures the shopper that the present line
     * "ships free already".
     */
    hasFreeShippingItems?: boolean;
    className?: string;
}

// Shared brand-accent surface so FreeShippingBar visually matches
// components/CompleteTheFitCart.tsx. The two surfaces in the cart
// drawer now read as ONE shipping upsell with complementary framings
// rather than two disjoint notifications. Edit this constant to evolve
// both at once.
const BRAND_ACCENT_SURFACE =
    'border border-brand-accent/30 rounded-lg bg-gradient-to-br from-brand-accent/[0.08] via-transparent to-transparent';

const FreeShippingBar: React.FC<FreeShippingBarProps> = ({
    cartTotal,
    hasFreeShippingItems = false,
    className = '',
}) => {
    const [showCelebration, setShowCelebration] = useState(false);

    // Source of truth for tier math is cartTotal alone. The
    // hasFreeShippingItems flag is a *display* signal, not a celebration
    // trigger — animating on every wallet add would be noisy.
    const thresholdInfo = getNextShippingThreshold(cartTotal);
    const cartAtMaxTier = !thresholdInfo;

    useEffect(() => {
        // Animate only when the cart crosses the $100 threshold — that's
        // a true "you unlocked free shipping" moment worth celebrating.
        // hasFreeShippingItems alone stays calm: the green chip is the
        // loud-enough signal.
        if (!cartAtMaxTier) {
            setShowCelebration(false);
            return;
        }
        setShowCelebration(true);
        const timer = setTimeout(() => setShowCelebration(false), 3000);
        return () => clearTimeout(timer);
    }, [cartAtMaxTier, cartTotal]);

    if (cartAtMaxTier) {
        const celebrationCopy = hasFreeShippingItems
            ? 'Free shipping across your order — qualifying items ship at $0'
            : "You've crossed the $100 threshold — entire order ships free";
        return (
            <div className={`${BRAND_ACCENT_SURFACE} p-4 ${className}`}>
                {/* Header — mirrors CompleteTheFitCart: theme icon
                    (Truck) + uppercase eyebrow title left, green
                    "Free Ship" chip right. */}
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <Truck className="h-4 w-4 text-brand-accent flex-shrink-0" />
                        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white truncate">
                            Free Shipping
                        </h3>
                    </div>
                    <span className="border border-green-500/40 bg-green-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-green-200 whitespace-nowrap flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        Free Ship
                    </span>
                </div>
                {/* Full-width green bar to celebrate unlock */}
                <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-green-500 to-emerald-500" />
                    <div className="absolute top-0 left-0 w-full h-full bg-green-400/20 animate-pulse" />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                    <Sparkles className={`h-3 w-3 ${showCelebration ? 'text-green-300 animate-pulse' : 'text-green-400'}`} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-green-200">
                        {celebrationCopy}
                    </p>
                </div>
            </div>
        );
    }

    const { amountNeeded, progress, nextTier } = thresholdInfo;
    const isCloseToThreshold = amountNeeded <= 20;

    return (
        <div className={`${BRAND_ACCENT_SURFACE} p-4 ${className}`}>
            {/* Header — mirrors CompleteTheFitCart: Truck + uppercase
                eyebrow on the left, "$X away" or "Free Ship" chip on
                the right. */}
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Truck className="h-4 w-4 text-brand-accent flex-shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white truncate">
                        Free Shipping
                    </h3>
                </div>
                {hasFreeShippingItems ? (
                    <span className="border border-green-500/40 bg-green-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-green-200 whitespace-nowrap flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        Free Ship
                    </span>
                ) : (
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] whitespace-nowrap ${isCloseToThreshold ? 'text-green-200' : 'text-gray-300'}`}>
                        ${amountNeeded.toFixed(2)} away
                    </span>
                )}
            </div>

            {/* Progress bar — brand-accent gradient so it visually
                rhymes with CompleteTheFitCart. Flips to green when
                close to the threshold OR when a free-shipping line
                already lifts the cart. */}
            <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                {hasFreeShippingItems ? (
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-green-500 to-emerald-500" />
                ) : (
                    <div
                        className={`absolute top-0 left-0 h-full transition-all duration-500 ${isCloseToThreshold
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                : 'bg-gradient-to-r from-brand-accent to-brand-accent/70'
                            }`}
                        style={{ width: `${progress}%` }}
                    />
                )}
                {isCloseToThreshold && (
                    <div className="absolute top-0 left-0 w-full h-full bg-green-400/20 animate-pulse" />
                )}
            </div>

            {/* Caption — same uppercase eyebrow voice as CompleteTheFitCart */}
            <div className="mt-2 flex items-center gap-1.5">
                {hasFreeShippingItems ? (
                    <Sparkles className="h-3 w-3 text-green-400" />
                ) : (
                    <TrendingUp className="h-3 w-3 text-gray-400" />
                )}
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">
                    {hasFreeShippingItems
                        ? `Qualifying items ship free · add $${amountNeeded.toFixed(2)} to lift the rest of your bag`
                        : nextTier.cost === 0
                            ? `Add $${amountNeeded.toFixed(2)} more for free shipping`
                            : `Add $${amountNeeded.toFixed(2)} more for reduced shipping · free at $100`}
                </p>
            </div>
        </div>
    );
};

export default FreeShippingBar;
