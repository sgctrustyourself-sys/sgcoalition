import React from 'react';
import { Link } from 'react-router-dom';
import { Coins } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { calculateSGCoinPrice, formatPrice, isSGCoinDiscountEnabled, getDiscountPercentageText } from '../utils/pricing';
import { MEMBER_DISCOUNT_RATE, getMemberPrice, isMemberPromoActive } from '../utils/memberDiscount';

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
    const { user } = useApp();
    const discountEnabled = isSGCoinDiscountEnabled();
    const sgcoinPrice = calculateSGCoinPrice(basePrice);
    const isMember = Boolean(user?.uid);
    // null once the promotion ends, so the crossed-out price and the invite
    // below both disappear together.
    const memberPrice = isMember ? getMemberPrice(basePrice) : null;
    const memberPercent = Math.round(MEMBER_DISCOUNT_RATE * 100);

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
        <div className={`max-w-full space-y-2 ${className}`}>
            {/* Regular price. Crossed out only while the member promotion runs. */}
            {isMember && memberPrice !== null ? (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className={`text-gray-500 font-medium line-through ${sizeClasses[size].label}`}>
                        {formatPrice(basePrice)}
                    </span>
                    <span className={`text-emerald-400 font-bold ${sizeClasses[size].base}`}>
                        {formatPrice(memberPrice)}
                    </span>
                    <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">
                        Member {memberPercent}% off
                    </span>
                </div>
            ) : (
                <div className="space-y-1">
                    <div className={`text-white font-bold ${sizeClasses[size].base}`}>
                        {formatPrice(basePrice)}
                    </div>
                    {!isMember && isMemberPromoActive() && (
                        <Link to="/login" className="text-pink-300 text-xs font-bold uppercase tracking-widest hover:text-pink-200 underline decoration-pink-500/40">
                            👻 Log in or sign up to unlock {memberPercent}% off →
                        </Link>
                    )}
                </div>
            )}

            {/* SGCoin Payment Option - Only if enabled and showDiscount is true */}
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
