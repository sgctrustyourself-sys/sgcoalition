import React, { useEffect, useState } from 'react';
import { Truck, TrendingUp, Sparkles } from 'lucide-react';
import { getNextShippingThreshold } from '../../utils/upsellUtils';

interface FreeShippingBarProps {
    cartTotal: number;
    className?: string;
}

const FreeShippingBar: React.FC<FreeShippingBarProps> = ({ cartTotal, className = '' }) => {
    const [showCelebration, setShowCelebration] = useState(false);
    const thresholdInfo = getNextShippingThreshold(cartTotal);

    useEffect(() => {
        // Show celebration when free shipping is reached
        if (!thresholdInfo && cartTotal >= 100) {
            setShowCelebration(true);
            const timer = setTimeout(() => setShowCelebration(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [thresholdInfo, cartTotal]);

    // If already at max tier (free shipping)
    if (!thresholdInfo) {
        return (
            <div className={`bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg p-4 ${className}`}>
                <div className="flex items-center justify-center gap-2">
                    {showCelebration && <Sparkles className="w-5 h-5 text-green-400 animate-pulse" />}
                    <Truck className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-bold">
                        🎉 You've earned FREE shipping!
                    </span>
                    {showCelebration && <Sparkles className="w-5 h-5 text-green-400 animate-pulse" />}
                </div>
            </div>
        );
    }

    const { amountNeeded, progress, nextTier } = thresholdInfo;
    const isCloseToThreshold = amountNeeded <= 20;

    return (
        <div className={`bg-gray-900/50 border border-white/10 rounded-lg p-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Truck className={`w-4 h-4 ${isCloseToThreshold ? 'text-green-400' : 'text-blue-400'}`} />
                    <span className="text-sm font-medium text-gray-300">
                        {nextTier.cost === 0 ? 'Free Shipping' : 'Reduced Shipping'}
                    </span>
                </div>
                <span className={`text-sm font-bold ${isCloseToThreshold ? 'text-green-400 animate-pulse' : 'text-blue-400'}`}>
                    ${amountNeeded.toFixed(2)} away
                </span>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className={`absolute top-0 left-0 h-full transition-all duration-500 ${isCloseToThreshold
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                            : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                        }`}
                    style={{ width: `${progress}%` }}
                />
                {isCloseToThreshold && (
                    <div className="absolute top-0 left-0 w-full h-full bg-green-400/20 animate-pulse" />
                )}
            </div>

            {/* Message */}
            <div className="mt-2 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3 text-gray-400" />
                <p className="text-xs text-gray-400">
                    {nextTier.message.replace('$X', `$${amountNeeded.toFixed(2)}`)}
                </p>
            </div>
        </div>
    );
};

export default FreeShippingBar;
