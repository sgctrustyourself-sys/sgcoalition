import React from 'react';
import { Coins } from 'lucide-react';
import { calculateSGCoinPrice, formatPrice, isSGCoinDiscountEnabled, getDiscountPercentageText } from '../utils/pricing';

interface PriceDisplayProps {
    basePrice: number;
    size?: 'small' | 'medium' | 'large';
    showDiscount?: boolean;
    className?: string;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
    basePrice,
    size = 'medium',
    showDiscount = true,
    className = ''
}) => {
    const discountEnabled = isSGCoinDiscountEnabled();
    const sgcoinPrice = calculateSGCoinPrice(basePrice);

    const sizeClasses = {
        small: {
            base: 'text-base',
            sgcoin: 'text-sm',
            label: 'text-xs'
        },
        medium: {
            base: 'text-2xl',
            sgcoin: 'text-lg',
            label: 'text-sm'
        },
        large: {
            base: 'text-3xl',
            sgcoin: 'text-xl',
            label: 'text-base'
        }
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Regular Price - NOT crossed out */}
            <div className={`text-white font-bold ${sizeClasses[size].base}`}>
                {formatPrice(basePrice)}
            </div>

            {/* SGCoin Payment Option - Only if enabled and showDiscount is true */}
            {discountEnabled && showDiscount && (
                <div className="flex items-start gap-2 bg-green-900/20 border border-green-500/30 rounded-lg p-2">
                    <Coins className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <div className={`text-green-300 ${sizeClasses[size].label}`}>
                            Pay with SGCoin/GMONEY:
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-green-400 font-bold ${sizeClasses[size].sgcoin}`}>
                                {formatPrice(sgcoinPrice)}
                            </span>
                            <span className="text-green-300 text-xs">
                                (Save {getDiscountPercentageText()}!)
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PriceDisplay;
