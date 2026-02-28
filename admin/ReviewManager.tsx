import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, XCircle, Search, ShoppingBag } from 'lucide-react';
import { Review } from '../types';
import { useApp } from '../context/AppContext';

const ReviewManager = () => {
    const { products } = useApp();
    const [allReviews, setAllReviews] = useState<Review[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Load all reviews from localStorage
    useEffect(() => {
        const loadedReviews: Review[] = [];
        products.forEach(product => {
            const savedReviews = localStorage.getItem(`coalition_reviews_${product.id}`);
            if (savedReviews) {
                const productReviews = JSON.parse(savedReviews);
                loadedReviews.push(...productReviews);
            }
        });
        setAllReviews(loadedReviews);
    }, [products]);

    const handleApprove = (review: Review) => {
        const updatedReview = { ...review, verified: true };
        updateReview(updatedReview);
    };

    const handleReject = (review: Review) => {
        if (window.confirm('Are you sure you want to delete this review?')) {
            deleteReview(review);
        }
    };

    const updateReview = (updatedReview: Review) => {
        // Update in localStorage
        const productReviews = JSON.parse(localStorage.getItem(`coalition_reviews_${updatedReview.productId}`) || '[]');
        const updatedReviews = productReviews.map((r: Review) =>
            r.id === updatedReview.id ? updatedReview : r
        );
        localStorage.setItem(`coalition_reviews_${updatedReview.productId}`, JSON.stringify(updatedReviews));

        // Update local state
        setAllReviews(prev => prev.map(r => r.id === updatedReview.id ? updatedReview : r));
    };

    const deleteReview = (review: Review) => {
        // Remove from localStorage
        const productReviews = JSON.parse(localStorage.getItem(`coalition_reviews_${review.productId}`) || '[]');
        const filteredReviews = productReviews.filter((r: Review) => r.id !== review.id);
        localStorage.setItem(`coalition_reviews_${review.productId}`, JSON.stringify(filteredReviews));

        // Update local state
        setAllReviews(prev => prev.filter(r => r.id !== review.id));
    };

    const pendingReviews = allReviews.filter(r => !r.verified);
    const approvedReviews = allReviews.filter(r => r.verified);

    const filteredPending = pendingReviews.filter(review => {
        const product = products.find(p => p.id === review.productId);
        const productName = product?.name || '';
        return productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            review.userName.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const getProductName = (productId: string) => {
        return products.find(p => p.id === productId)?.name || 'Unknown Product';
    };

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold mb-2">Review Management</h2>
                <p className="text-gray-400 text-sm">Approve or reject customer reviews</p>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by product or customer name..."
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <div className="text-yellow-500 text-2xl font-bold">{pendingReviews.length}</div>
                    <div className="text-gray-400 text-sm">Pending Approval</div>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="text-green-500 text-2xl font-bold">{approvedReviews.length}</div>
                    <div className="text-gray-400 text-sm">Approved</div>
                </div>
            </div>

            {/* Pending Reviews */}
            <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                    Pending Reviews ({filteredPending.length})
                </h3>

                {filteredPending.length === 0 ? (
                    <div className="text-center py-12 bg-gray-900/50 rounded-xl border border-gray-800 border-dashed">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-700" />
                        <p className="text-gray-500">No pending reviews</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredPending.map((review) => (
                            <div key={review.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <ShoppingBag className="w-4 h-4 text-gray-500" />
                                            <h4 className="font-bold">{getProductName(review.productId)}</h4>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <span>{review.userName}</span>
                                            <span>•</span>
                                            <span>{new Date(review.createdAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex text-yellow-500">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-gray-700'}`}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {review.comment && (
                                    <p className="text-gray-300 text-sm mb-4 bg-black/30 p-3 rounded">
                                        "{review.comment}"
                                    </p>
                                )}

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleApprove(review)}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold flex items-center justify-center gap-2 transition"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(review)}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded font-bold flex items-center justify-center gap-2 transition"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewManager;
