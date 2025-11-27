import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import WishlistShare from '../components/WishlistShare';

const Favorites = () => {
    const { products, user, isLoading } = useApp();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [isSharedView, setIsSharedView] = useState(false);
    const [sharedItems, setSharedItems] = useState<string[]>([]);

    useEffect(() => {
        // Check if viewing a shared wishlist
        const itemsParam = searchParams.get('items');
        if (itemsParam) {
            setIsSharedView(true);
            setSharedItems(itemsParam.split(','));
        }
    }, [searchParams]);

    // Determine which favorites to show
    const favoriteIds = isSharedView ? sharedItems : (user?.favorites || []);
    const favoriteProducts = products.filter(p => favoriteIds.includes(p.id) && !p.archived);

    if (isLoading) {
        return (
            <div className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen">
                <div className="text-center text-white">Loading...</div>
            </div>
        );
    }

    return (
        <div className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen">
            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-sm text-gray-400 hover:text-white mb-4 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>

                {isSharedView ? (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                        <p className="text-blue-400 text-sm font-bold">
                            👀 You're viewing a shared wishlist
                        </p>
                    </div>
                ) : null}

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-display font-bold uppercase mb-2">
                            {isSharedView ? 'Shared Wishlist' : 'My Favorites'}
                        </h1>
                        <p className="text-gray-400">
                            {favoriteProducts.length} {favoriteProducts.length === 1 ? 'item' : 'items'}
                        </p>
                    </div>

                    {!isSharedView && favoriteProducts.length > 0 && (
                        <WishlistShare favoriteIds={favoriteIds} />
                    )}
                </div>
            </div>

            {/* Products Grid */}
            {favoriteProducts.length === 0 ? (
                <div className="text-center py-20">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white/5 rounded-full mb-6">
                        <Heart className="w-10 h-10 text-gray-600" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">
                        {isSharedView ? 'No items in this wishlist' : 'No favorites yet'}
                    </h2>
                    <p className="text-gray-400 mb-8">
                        {isSharedView
                            ? 'This wishlist is empty or the items are no longer available.'
                            : 'Start adding items to your favorites by clicking the heart icon on products.'
                        }
                    </p>
                    {!isSharedView && (
                        <button
                            onClick={() => navigate('/shop')}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition"
                        >
                            <ShoppingBag className="w-5 h-5" />
                            Browse Products
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {favoriteProducts.map(product => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Favorites;
