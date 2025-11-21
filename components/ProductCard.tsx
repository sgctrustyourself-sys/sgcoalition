import React from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';

const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
    const { addToCart, toggleFavorite, user } = useApp();
    const isFav = user?.favorites.includes(product.id);

    return (
        <div className="group relative bg-white">
            <div className="aspect-[4/5] overflow-hidden bg-gray-100 relative">
                <img
                    src={product.images[0]}
                    alt={product.name}
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition duration-500"
                />
                {product.nft && (
                    <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-600 to-brand-accent text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                        <span className="text-xs">🔗</span>
                        NFT-BACKED
                    </div>
                )}
                {user && (
                    <button
                        onClick={(e) => { e.preventDefault(); toggleFavorite(product.id); }}
                        className="absolute top-2 right-2 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition"
                    >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : 'text-gray-900'}`} />
                    </button>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition duration-300 bg-gradient-to-t from-black/80 to-transparent">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            // Default size for quick add
                            const size = product.sizes?.[0] || 'One Size';
                            addToCart(product, size);
                        }}
                        className="w-full bg-white text-black py-2 text-xs font-bold uppercase tracking-wide"
                    >
                        Quick Add
                    </button>
                </div>
            </div>
            <div className="mt-4 flex justify-between">
                <div>
                    <h3 className="text-sm text-gray-900 font-medium">
                        <Link to={`/product/${product.id}`}>
                            <span aria-hidden="true" className="absolute inset-0" />
                            {product.name}
                        </Link>
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 uppercase">{product.category}</p>
                </div>
                <p className="text-sm font-medium text-gray-900">${product.price}</p>
            </div>
        </div>
    );
};

export default ProductCard;
