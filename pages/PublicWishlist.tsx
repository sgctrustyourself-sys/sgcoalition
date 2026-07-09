import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, Share2, User, Loader2 } from 'lucide-react';
import { Product, UserProfile } from '../types';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import ProductCard from '../components/ProductCard';
import WishlistShare from '../components/WishlistShare';

interface WishlistShareRow {
    share_id: string;
    owner_id: string;
    owner_name: string;
    items: string[];
    created_at: string;
}

const PublicWishlist = () => {
    const { shareId } = useParams<{ shareId: string }>();
    const navigate = useNavigate();
    // isAppLoading is gated on the dep array so the effect only
    // runs after AppContext has finished fetching products. Without
    // this, the SELECT would resolve while products is still []
    // and the intersection would be empty, even for a share that
    // DOES match real products. The wait cost is one extra render
    // cycle on first page load; the alternative is a flash of
    // empty grid + a wasted SELECT.
    const { products, isLoading: isAppLoading, user, addToCart } = useApp();
    const [wishlistOwner, setWishlistOwner] = useState<UserProfile | null>(null);
    const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
    const [showShareModal, setShowShareModal] = useState(false);
    // isLoading distinguishes the 3 terminal states the page can
    // render: (1) loading, (2) found, (3) not-found. Without it,
    // the initial render would flash "Wishlist Not Found" before
    // the SELECT resolves. wishlistOwner being null used to mean
    // "not found"; now it means "not loaded yet" OR "not found",
    // and isLoading disambiguates.
    const [isLoading, setIsLoading] = useState(true);
    // Lookup failure (network error, schema missing, etc.) -- shown
    // via the same "Wishlist Not Found" UI but with a distinct
    // message so the founder can tell the difference between
    // "share doesn't exist" and "the page is broken".
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSharedWishlist = async () => {
            if (!shareId) {
                setIsLoading(false);
                return;
            }
            // Wait for AppContext to finish its initial product
            // fetch before doing the products-intersection. The
            // dep array includes isAppLoading so this re-runs when
            // it flips false. We intentionally do NOT include
            // `products` in the dep array: that would re-fire the
            // effect on every Supabase realtime product update
            // (AppContext subscribes to `products_channel`), and
            // a public share view doesn't need to live-update.
            if (isAppLoading) return;
            setIsLoading(true);
            setError(null);
            setWishlistOwner(null);
            setWishlistProducts([]);
            try {
                // Public read RLS on wishlist_shares (see
                // supabase/migrations/20260709_add_wishlist_shares.sql)
                // allows the anonymous recipient to SELECT this row.
                const { data, error: fetchError } = await supabase
                    .from('wishlist_shares')
                    .select('share_id, owner_id, owner_name, items, created_at')
                    .eq('share_id', shareId)
                    .maybeSingle();
                if (fetchError) {
                    throw fetchError;
                }
                if (!data) {
                    setIsLoading(false);
                    return;
                }
                const row = data as WishlistShareRow;
                // Build a synthetic UserProfile from the share row so
                // the existing UI (which destructures displayName,
                // wishlistSettings.name, wishlistSettings.shareId,
                // wishlistSettings.shareCount) renders without
                // changes. owner_id stays in the profile so future
                // "view owner's other wishlists" features have the
                // FK handy.
                setWishlistOwner({
                    uid: row.owner_id,
                    displayName: row.owner_name,
                    email: null,
                    walletAddress: null,
                    sgCoinBalance: 0,
                    isAdmin: false,
                    favorites: row.items,
                    wishlistSettings: {
                        isPublic: true,
                        name: `${row.owner_name}'s Wishlist`,
                        shareId: row.share_id,
                        shareCount: 0,
                        createdAt: new Date(row.created_at).getTime(),
                        updatedAt: new Date(row.created_at).getTime(),
                    },
                } as UserProfile);
                // Intersect the stored favorite IDs with the live
                // products array so a product that's been archived
                // or deleted since the share was created doesn't
                // 404 the wishlist tile. Order follows the share
                // snapshot order so the owner's intent is preserved.
                // `products` is captured at the time of the effect
                // run; if a later realtime update changes the
                // products array, the page won't re-fetch (see the
                // dep-array comment above).
                const productMap = new Map(products.map(p => [p.id, p]));
                const matched = row.items
                    .map(id => productMap.get(id))
                    .filter((p): p is Product => Boolean(p));
                setWishlistProducts(matched);
                setIsLoading(false);
            } catch (err) {
                console.error('Failed to load shared wishlist:', err);
                setError(err instanceof Error ? err.message : 'Failed to load wishlist.');
                setIsLoading(false);
            }
        };
        fetchSharedWishlist();
    }, [shareId, isAppLoading]);

    // Loading state: render a skeleton matching the loaded layout
    // so the page doesn't jump on hydrate. The user sees the
    // avatar + title + count placeholder, then the products grid
    // swaps in when the SELECT resolves.
    if (isLoading) {
        return (
            <div className="pt-24 min-h-screen bg-black text-white pb-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">
                    <div className="mb-12 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-white/10" />
                            <div>
                                <div className="h-8 w-48 bg-white/10 rounded mb-2" />
                                <div className="h-4 w-32 bg-white/10 rounded" />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="aspect-[3/4] bg-white/5 rounded-lg" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!wishlistOwner) {
        return (
        <div className="pt-24 min-h-screen bg-black text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
                <Heart className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                <h2 className="text-2xl font-bold mb-2">Wishlist Not Found</h2>
                <p className="text-gray-400 mb-6">
                    {error
                        ? `We hit an error loading this wishlist: ${error}`
                        : "This wishlist doesn't exist or is no longer public."}
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
                        {wishlistProducts.map((product, idx) => (
                            <ProductCard key={product.id} product={product} priority={idx === 0} />
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
                    favoriteIds={wishlistProducts.map(p => p.id)}
                />
            )}
        </div>
    );
};

export default PublicWishlist;
