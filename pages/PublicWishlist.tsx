import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, Share2, User } from 'lucide-react';
import { Product, UserProfile } from '../types';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import WishlistShare from '../components/WishlistShare';

const PublicWishlist = () => {
    const { shareId } = useParams<{ shareId: string }>();
    const navigate = useNavigate();
    const { products, users, user, addToCart } = useApp();
    const [wishlistOwner, setWishlistOwner] = useState<UserProfile | null>(null);
    const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
    const [showShareModal, setShowShareModal] = useState(false);

    useEffect(() => {
        // Find the user who owns this wishlist
        const owner = users?.find(u => u.wishlistSettings?.shareId === shareId);

        if (owner) {
            setWishlistOwner(owner);

            // Check if wishlist is public
            if (!owner.wishlistSettings?.isPublic) {
                // Redirect if wishlist is private
                navigate('/');
                return;
            }

            // Get wishlist products
            const favoriteProducts = products.filter(p =>
                owner.favorites.includes(p.id) && !p.archived
            );
            setWishlistProducts(favoriteProducts);
        }
    }, [shareId, users, products, navigate]);

    if (!wishlistOwner) {
        return (
            <div className="pt-24 min-h-screen bg-black text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                    <Heart className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                    <h2 className="text-2xl font-bold mb-2">Wishlist Not Found</h2>
                    <p className="text-gray-400 mb-6">
                        This wishlist doesn't exist or is no longer public.
                    </p>
                    <button
                        onClick={() => navigate('/shop')}
                        className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition"
                    >
                        Browse Products
                    </button>
                </div>
            </div>
        );
    }

    const wishlistName = wishlistOwner.wishlistSettings?.name || `${wishlistOwner.displayName}'s Wishlist`;
    const wishlistDescription = wishlistOwner.wishlistSettings?.description;

    return (
        <div className="pt-24 min-h-screen bg-black text-white pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                                <User className="w-8 h-8 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold font-display uppercase">
                                    {wishlistName}
                                </h1>
                                <p className="text-gray-400 mt-1">
                                    by {wishlistOwner.displayName || 'Anonymous'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowShareModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition"
                        >
                            <Share2 className="w-4 h-4" />
                            Share
                        </button>
                    </div>

                    {wishlistDescription && (
                        <p className="text-gray-300 max-w-2xl">
                            {wishlistDescription}
                        </p>
                    )}

                    <div className="flex items-center gap-6 mt-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                            <Heart className="w-4 h-4" />
                            {wishlistProducts.length} {wishlistProducts.length === 1 ? 'item' : 'items'}
                        </div>
                        {wishlistOwner.wishlistSettings?.shareCount && wishlistOwner.wishlistSettings.shareCount > 0 && (
                            <div className="flex items-center gap-2">
                                <Share2 className="w-4 h-4" />
                                {wishlistOwner.wishlistSettings.shareCount} {wishlistOwner.wishlistSettings.shareCount === 1 ? 'share' : 'shares'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Products Grid */}
                {wishlistProducts.length === 0 ? (
                    <div className="text-center py-20">
                        <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                        <h3 className="text-xl font-bold mb-2">No Items Yet</h3>
                        <p className="text-gray-400 mb-6">
                            This wishlist is empty. Check back later!
                        </p>
                        <button
                            onClick={() => navigate('/shop')}
                            className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition"
                        >
                            Browse Products
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {wishlistProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}

                {/* Login Prompt for Visitors */}
                {!user && wishlistProducts.length > 0 && (
                    <div className="mt-12 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10 rounded-xl p-6 text-center">
                        <h3 className="text-xl font-bold mb-2">Love these items?</h3>
                        <p className="text-gray-400 mb-4">
                            Create an account to save your own wishlist and share it with friends!
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition"
                        >
                            Sign Up / Login
                        </button>
                    </div>
                )}
            </div>

            {/* Share Modal */}
            {showShareModal && shareId && (
                <WishlistShare
                    shareId={shareId}
                    userName={wishlistOwner.displayName || 'Anonymous'}
                    itemCount={wishlistProducts.length}
                    onClose={() => setShowShareModal(false)}
                />
            )}
        </div>
    );
};

export default PublicWishlist;
