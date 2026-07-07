import React from 'react';
import { Coins } from 'lucide-react';
import { calculateSGCoinPrice, formatPrice, isSGCoinDiscountEnabled, getDiscountPercentageText } from '../utils/pricing';
import { getEffectiveDiscountPercent, getDiscountedUnitPrice } from '../utils/productDiscount';
import { Product } from '../types';

interface PriceDisplayProps {
    basePrice: number;
    size?: 'small' | 'medium' | 'large';
    showDiscount?: boolean;
    className?: string;
    product?: Pick<Product, 'price' | 'discountPercent'> | Product;
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
    basePrice,
    size = 'medium',
    showDiscount = true,
    className = '',
    product,
}) => {
    const effectiveProduct = product ?? { price: basePrice, discountPercent: 0 };
    const discountPct = getEffectiveDiscountPercent(effectiveProduct);
    const hasProductDiscount = discountPct > 0;
    const salePrice = hasProductDiscount ? getDiscountedUnitPrice(effectiveProduct) : basePrice;

    const discountEnabled = isSGCoinDiscountEnabled();
    const sgcoinBase = hasProductDiscount ? salePrice : basePrice;
    const sgcoinPrice = calculateSGCoinPrice(sgcoinBase);

    const sizeClasses = {
        small: { base: 'text-base', sgcoin: 'text-sm', label: 'text-xs' },
        medium: { base: 'text-2xl', sgcoin: 'text-lg', label: 'text-sm' },
        large: { base: 'text-3xl', sgcoin: 'text-xl', label: 'text-base' }
    };

    return (
        <div className={`max-w-full space-y-2 ${className}`}>
            {hasProductDiscount && showDiscount && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className={`text-white font-bold ${sizeClasses[size].base}`}>
                        {formatPrice(salePrice)}
                    </span>
                    <span className="text-gray-500 line-through text-sm font-medium">
                        {formatPrice(basePrice)}
                    </span>
                    <span className="rounded-full border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-green-300">
                        {discountPct}% off
                    </span>
                </div>
            )}
            {!hasProductDiscount && (
                <div className={`text-white font-bold ${sizeClasses[size].base}`}>
                    {formatPrice(basePrice)}
                </div>
            )}
            {discountEnabled && showDiscount && (
                <div className="flex max-w-full items-start gap-2 bg-green-900/20 border border-green-500/30 rounded-lg p-2">
                    <Coins className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                        <div className={`break-words leading-tight text-green-300 ${sizeClasses[size].label}`}>
                            Pay with SGCoin/GMONEY:
                        </div>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
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
