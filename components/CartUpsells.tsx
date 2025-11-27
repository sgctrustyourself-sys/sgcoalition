import React from 'react';
import { CartItem, Product } from '../types';
import { useApp } from '../context/AppContext';
import { getUpsellProducts, getProductsToReachThreshold, getNextShippingThreshold } from '../utils/upsellUtils';
import { ShoppingBag, TrendingUp, Sparkles } from 'lucide-react';

interface CartUpsellsProps {
    cartItems: CartItem[];
    cartTotal: number;
    className?: string;
}

const CartUpsells: React.FC<CartUpsellsProps> = ({ cartItems, cartTotal, className = '' }) => {
    const { products, addToCart } = useApp();
    const cartProductIds = new Set<string>(cartItems.map(item => item.id));

    // Get products to help reach free shipping
    const thresholdInfo = getNextShippingThreshold(cartTotal);
    const thresholdProducts = thresholdInfo
        ? getProductsToReachThreshold(cartTotal, products, cartProductIds, 3)
        : [];

    // Get general upsell recommendations
    const upsellProducts = getUpsellProducts(cartItems, products, 4);

    // Prioritize threshold products if close to free shipping
    const displayProducts = thresholdInfo && thresholdInfo.amountNeeded <= 30
        ? thresholdProducts
        : upsellProducts;

    if (displayProducts.length === 0) return null;

    const handleQuickAdd = (product: Product) => {
        const defaultSize = product.sizes?.[0] || 'One Size';
        addToCart(product, defaultSize);
    };

    return (
        <div className={`bg-gray-900/30 border border-white/10 rounded-lg p-4 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    {thresholdInfo && thresholdInfo.amountNeeded <= 30 ? (
                        <>
                            <Sparkles className="w-5 h-5 text-green-400" />
                            <h3 className="font-bold text-white">Reach Free Shipping!</h3>
                        </>
                    ) : (
                        <>
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                            <h3 className="font-bold text-white">You May Also Like</h3>
                        </>
                    )}
                </div>
            </div>

            {/* Products Grid */}
            <div className="space-y-3">
                {displayProducts.map((product) => (
                    <div
                        key={product.id}
                        className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition group"
                    >
                        {/* Product Image */}
                        <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-16 h-16 object-cover rounded border border-white/10"
                        />

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-sm text-white truncate group-hover:text-blue-400 transition">
                                {product.name}
                            </h4>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {product.category}
                            </p>
                            <p className="text-sm font-bold text-white mt-1">
                                ${product.price.toFixed(2)}
                            </p>
                        </div>

                        {/* Quick Add Button */}
                        <button
                            onClick={() => handleQuickAdd(product)}
                            disabled={product.archived}
                            className="px-4 py-2 bg-white text-black text-sm font-bold rounded hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                        >
                            <ShoppingBag className="w-4 h-4" />
                            Add
                        </button>
                    </div>
                ))}
            </div>

            {/* Helper Text */}
            {thresholdInfo && thresholdInfo.amountNeeded <= 30 && (
                <p className="text-xs text-green-400 mt-3 text-center">
                    Add any of these to unlock free shipping! 🚚
                </p>
            )}
        </div>
    );
};

export default CartUpsells;
