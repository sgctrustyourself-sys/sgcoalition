import React, { useState } from 'react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { getFrequentlyBoughtTogether } from '../utils/recommendationEngine';
import { applyBundleDiscount } from '../utils/upsellUtils';
import { ShoppingBag, Plus } from 'lucide-react';
import BundleDiscount from './ui/BundleDiscount';

interface FrequentlyBoughtTogetherProps {
    currentProduct: Product;
}

const FrequentlyBoughtTogether: React.FC<FrequentlyBoughtTogetherProps> = ({ currentProduct }) => {
    const { products, addToCart } = useApp();
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set([currentProduct.id]));

    const bundleProducts = getFrequentlyBoughtTogether(currentProduct.id, products);

    if (bundleProducts.length === 0) return null;

    const allBundleProducts = [currentProduct, ...bundleProducts];

    const toggleProduct = (productId: string) => {
        const newSelected = new Set(selectedProducts);
        if (productId === currentProduct.id) return; // Can't deselect current product

        if (newSelected.has(productId)) {
            newSelected.delete(productId);
        } else {
            newSelected.add(productId);
        }
        setSelectedProducts(newSelected);
    };

    const selectedItems = allBundleProducts.filter(p => selectedProducts.has(p.id));
    const totalPrice = selectedItems.reduce((sum, p) => sum + p.price, 0);
    const bundleInfo = applyBundleDiscount(totalPrice, selectedItems.length);

    const handleAddToCart = () => {
        selectedItems.forEach(p => addToCart(p, p.sizes?.[0] || ''));
    };

    return (
        <div className="mt-12 bg-gradient-to-br from-blue-900/10 to-purple-900/10 border border-white/10 rounded-xl p-6">
            <h3 className="text-xl font-bold font-display uppercase mb-6">Frequently Bought Together</h3>

            <div className="space-y-4 mb-6">
                {allBundleProducts.map((product, index) => (
                    <div key={product.id} className="flex items-center gap-4">
                        {index > 0 && (
                            <div className="flex items-center justify-center w-8 h-8 bg-white/5 rounded-full">
                                <Plus className="w-4 h-4 text-gray-400" />
                            </div>
                        )}

                        <label className="flex items-center gap-4 flex-1 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={selectedProducts.has(product.id)}
                                onChange={() => toggleProduct(product.id)}
                                disabled={product.id === currentProduct.id}
                                className="w-5 h-5 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50"
                            />

                            <div className="flex items-center gap-4 flex-1">
                                <img
                                    src={product.images[0]}
                                    alt={product.name}
                                    className="w-16 h-16 object-cover rounded border border-white/10"
                                />
                                <div className="flex-1">
                                    <h4 className="font-bold text-sm group-hover:text-blue-400 transition">
                                        {product.name}
                                    </h4>
                                    <p className="text-gray-400 text-xs mt-1">
                                        ${product.price.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </label>
                    </div>
                ))}
            </div>

            {/* Bundle Discount Display */}
            {bundleInfo.savings > 0 && (
                <BundleDiscount
                    originalPrice={bundleInfo.originalPrice}
                    discountedPrice={bundleInfo.discountedPrice}
                    savings={bundleInfo.savings}
                    discountPercentage={bundleInfo.discountPercentage}
                    className="mb-6"
                />
            )}

            <div className="flex items-center justify-between pt-6 border-t border-white/10">
                <div>
                    <p className="text-sm text-gray-400">
                        Total for {selectedProducts.size} {selectedProducts.size === 1 ? 'item' : 'items'}
                    </p>
                    {bundleInfo.savings > 0 ? (
                        <div>
                            <p className="text-lg text-gray-500 line-through">
                                ${bundleInfo.originalPrice.toFixed(2)}
                            </p>
                            <p className="text-2xl font-bold text-green-400">
                                ${bundleInfo.discountedPrice.toFixed(2)}
                            </p>
                        </div>
                    ) : (
                        <p className="text-2xl font-bold">${totalPrice.toFixed(2)}</p>
                    )}
                </div>
                <button
                    onClick={handleAddToCart}
                    disabled={selectedProducts.size === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ShoppingBag className="w-5 h-5" />
                    {bundleInfo.savings > 0
                        ? `Add Bundle - Save $${bundleInfo.savings.toFixed(2)}!`
                        : 'Add Selected to Cart'
                    }
                </button>
            </div>
        </div>
    );
};

export default FrequentlyBoughtTogether;
