import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Star, Edit2, Trash2, MessageSquare, Shield } from 'lucide-react';
import { Review } from '../types';

const MyReviews = () => {
    const { user, products } = useApp();
    const navigate = useNavigate();
    const [myReviews, setMyReviews] = useState<Review[]>([]);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        // Load all reviews from localStorage and filter by current user
        const loadedReviews: Review[] = [];
        products.forEach(product => {
            const savedReviews = localStorage.getItem(`coalition_reviews_${product.id}`);
            if (savedReviews) {
                const productReviews = JSON.parse(savedReviews);
                loadedReviews.push(...productReviews);
            }
        });

        // Filter by current user
        const userReviews = loadedReviews.filter(review => review.userId === user?.uid);
        setMyReviews(userReviews);
    }, [products, user]);

    const filteredReviews = myReviews.filter(review => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'verified') return review.verified;
        if (filterStatus === 'pending') return !review.verified;
        return true;
    });

    const handleDelete = (review: Review) => {
        if (window.confirm('Are you sure you want to delete this review?')) {
            // Remove from localStorage
            const productReviews = JSON.parse(localStorage.getItem(`coalition_reviews_${review.productId}`) || '[]');
            const filteredReviews = productReviews.filter((r: Review) => r.id !== review.id);
            localStorage.setItem(`coalition_reviews_${review.productId}`, JSON.stringify(filteredReviews));

            // Update local state
            setMyReviews(prev => prev.filter(r => r.id !== review.id));
        }
    };

    const getProductName = (productId: string) => {
        return products.find(p => p.id === productId)?.name || 'Unknown Product';
    };

    const getProductImage = (productId: string) => {
        return products.find(p => p.id === productId)?.images[0] || '';
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold font-display uppercase mb-2">My Reviews</h1>
                <p className="text-gray-400">Manage your product reviews</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6">
                {['all', 'verified', 'pending'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg font-bold text-sm uppercase transition ${filterStatus === status
                                ? 'bg-white text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        {status}
                    </button>
                ))}
            </div>

            {/* Reviews List */}
            {filteredReviews.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/50 rounded-xl border border-white/10 border-dashed">
                    <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                    <h2 className="text-xl font-bold mb-2">No reviews found</h2>
                    <p className="text-gray-400 mb-6">
                        {filterStatus === 'all'
                            ? "You haven't written any reviews yet"
                            : `No ${filterStatus} reviews`
                        }
                    </p>
                    <button
                        onClick={() => navigate('/shop')}
                        className="px-6 py-3 bg-white text-black font-bold rounded hover:bg-gray-200 transition"
                    >
                        Browse Products
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredReviews.map(review => (
                        <div key={review.id} className="bg-gray-900 border border-white/10 rounded-xl p-6">
                            <div className="flex gap-4 mb-4">
                                <img
                                    src={getProductImage(review.productId)}
                                    alt={getProductName(review.productId)}
                                    className="w-20 h-20 object-cover rounded border border-white/10 cursor-pointer"
                                    onClick={() => navigate(`/product/${review.productId}`)}
                                />
                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3
                                                className="font-bold text-lg cursor-pointer hover:text-blue-400 transition"
                                                onClick={() => navigate(`/product/${review.productId}`)}
                                            >
                                                {getProductName(review.productId)}
                                            </h3>
                                            <p className="text-sm text-gray-400">
                                                {new Date(review.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {review.verified ? (
                                                <span className="flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-green-500 text-xs font-bold">
                                                    <Shield className="w-3 h-3" />
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-500 text-xs font-bold">
                                                    Pending
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex text-yellow-500 mb-2">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-gray-700'}`}
                                            />
                                        ))}
                                    </div>

                                    {review.comment && (
                                        <p className="text-sm text-gray-300 mb-3 bg-black/30 p-3 rounded">
                                            "{review.comment}"
                                        </p>
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleDelete(review)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded text-xs font-bold transition"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyReviews;
