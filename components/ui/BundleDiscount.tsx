import React from 'react';
import { Tag, Percent } from 'lucide-react';

interface BundleDiscountProps {
    originalPrice: number;
    discountedPrice: number;
    savings: number;
    discountPercentage: number;
    className?: string;
}

const BundleDiscount: React.FC<BundleDiscountProps> = ({
    originalPrice,
    discountedPrice,
    savings,
    discountPercentage,
    className = ''
}) => {
    if (savings <= 0) return null;

    return (
        <div className={`bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4 ${className}`}>
            {/* Discount Badge */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full">
                        <Percent className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-bold text-purple-400">
                            {discountPercentage}% OFF
                        </span>
                    </div>
                    <span className="text-sm text-gray-400">Bundle Discount</span>
                </div>
                <div className="flex items-center gap-1 text-green-400">
                    <Tag className="w-4 h-4" />
                    <span className="text-sm font-bold">
                        Save ${savings.toFixed(2)}
                    </span>
                </div>
            </div>

            {/* Price Comparison */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-500 line-through">
                        Original: ${originalPrice.toFixed(2)}
                    </p>
                    <p className="text-lg font-bold text-white">
                        Bundle Price: ${discountedPrice.toFixed(2)}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-400">You save</p>
                    <p className="text-xl font-bold text-green-400">
                        ${savings.toFixed(2)}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BundleDiscount;
