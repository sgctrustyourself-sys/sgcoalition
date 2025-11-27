import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import PriceDisplay from './PriceDisplay';
import UrgencyBadge from './ui/UrgencyBadge';
import { getStockUrgency, getStockCount, generateViewCount } from '../utils/urgencyUtils';

const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
    const { addToCart, toggleFavorite, user } = useApp();
    const isFav = user?.favorites.includes(product.id);

    // Calculate urgency metrics
    const stockUrgency = getStockUrgency(product);
    const stockCount = getStockCount(product);
    const viewCount = generateViewCount(product);
    const showLowStock = stockUrgency !== 'normal' && !product.archived;

    return (
        <div className="group relative bg-transparent">
            <div className="aspect-[4/5] overflow-hidden bg-gray-900 relative border border-white/5">
                <img
                    src={product.images[0]}
                    alt={product.name}
                    className="h-full w-full object-cover object-center group-hover:scale-105 group-hover:grayscale transition duration-700 ease-in-out"
                />
                {product.nft && (
                    <div className="absolute top-2 left-2 bg-black/80 backdrop-blur border border-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
                        <span className="text-brand-accent">✦</span>
                        Digital Twin
                    </div>
                )}

                {/* Urgency Badges */}
                <div className="absolute top-2 left-2 flex flex-col gap-1.5">
                    {product.isLimitedEdition && (
                        <UrgencyBadge type="limited-edition" />
                    )}
                    {showLowStock && (
                        <UrgencyBadge type="low-stock" count={stockCount} />
                    )}
                </div>

                {user && (
                    <button
                        onClick={(e) => { e.preventDefault(); toggleFavorite(product.id); }}
                        className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-white hover:text-black transition-all border border-white/10"
                        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                    >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                    </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition duration-300 bg-gradient-to-t from-black via-black/80 to-transparent">
                    {product.archived ? (
                        <div className="w-full bg-gray-700 text-gray-400 py-3 text-xs font-bold uppercase tracking-widest text-center cursor-not-allowed">
                            Archived
                        </div>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                // Default size for quick add
                                const size = product.sizes?.[0] || 'One Size';
                                addToCart(product, size);
                            }}
                            className="w-full bg-white text-black py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors"
                        >
                            Quick Add
                        </button>
                    )}
                </div>
            </div>
            <div className="mt-4 flex justify-between items-start">
                <div>
                    <h3 className="text-sm text-white font-bold uppercase tracking-wide">
                        <Link to={`/product/${product.id}`}>
                            <span aria-hidden="true" className="absolute inset-0" />
                            {product.name}
                        </Link>
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 uppercase tracking-widest">{product.category}</p>
                </div>
                <PriceDisplay basePrice={product.price} size="small" showDiscount={true} />
            </div>
        </div>
    );
};

export default ProductCard;
