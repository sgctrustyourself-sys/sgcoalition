import React, { useState, useEffect } from 'react';
import { Star, User, MessageSquare, ThumbsUp, CheckCircle, Camera, Filter } from 'lucide-react';
import { Review } from '../types';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import ReviewPhotoUpload from './ui/ReviewPhotoUpload';
import StarRatingBreakdown from './ui/StarRatingBreakdown';
import PhotoLightbox from './ui/PhotoLightbox';

interface ProductReviewsProps {
    productId: string;
}

type SortOption = 'recent' | 'highest' | 'lowest' | 'helpful';
type FilterOption = 'all' | 'verified' | 'photos' | number; // number for star rating

const ProductReviews: React.FC<ProductReviewsProps> = ({ productId }) => {
    const { user, orders, updateUser } = useApp();
    const { addToast } = useToast();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    const [isWriting, setIsWriting] = useState(false);
    const [sortBy, setSortBy] = useState<SortOption>('recent');
    const [filterBy, setFilterBy] = useState<FilterOption>('all');
    const [lightboxPhotos, setLightboxPhotos] = useState<string[] | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // Load reviews from localStorage
    useEffect(() => {
        const savedReviews = localStorage.getItem(`coalition_reviews_${productId}`);
        if (savedReviews) {
            setReviews(JSON.parse(savedReviews));
        }
    }, [productId]);

    // Check if user purchased this product
    const hasPurchased = user && orders.some(order =>
        order.userId === user.uid &&
        order.items.some(item => item.productId === productId) &&
        order.paymentStatus === 'paid'
    );

    // Check if user already reviewed this product
    const hasReviewed = user && reviews.some(r => r.userId === user.uid);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (rating === 0) {
            addToast('Please select a rating', 'warning');
            return;
        }

        const newReview: Review = {
            id: Math.random().toString(36).substr(2, 9),
            productId,
            userId: user?.uid || 'guest',
            userName: user?.displayName || 'Guest User',
            rating,
            comment,
            createdAt: Date.now(),
            verified: false,
            purchaseVerified: hasPurchased || false,
            photos: photos.length > 0 ? photos : undefined,
            helpfulCount: 0,
            helpfulVotes: [],
            sgCoinRewarded: false
        };

        const updatedReviews = [newReview, ...reviews];
        setReviews(updatedReviews);
        localStorage.setItem(`coalition_reviews_${productId}`, JSON.stringify(updatedReviews));

        // Award SGCoins (will be processed when admin approves)
        const coinReward = photos.length > 0 ? 100 : 50;
        addToast(
            `Review submitted! You'll earn ${coinReward} SGCoins once approved.`,
            'success'
        );

        // Reset form
        setRating(0);
        setComment('');
        setPhotos([]);
        setIsWriting(false);
    };

    const handleHelpfulVote = (reviewId: string) => {
        if (!user) {
            addToast('Please login to vote', 'warning');
            return;
        }

        setReviews(prev => prev.map(review => {
            if (review.id === reviewId) {
                const hasVoted = review.helpfulVotes?.includes(user.uid);
                if (hasVoted) {
                    return review; // Already voted
                }
                return {
                    ...review,
                    helpfulCount: (review.helpfulCount || 0) + 1,
                    helpfulVotes: [...(review.helpfulVotes || []), user.uid]
                };
            }
            return review;
        }));

        // Save to localStorage
        const updatedReviews = reviews.map(review => {
            if (review.id === reviewId) {
                const hasVoted = review.helpfulVotes?.includes(user.uid);
                if (!hasVoted) {
                    return {
                        ...review,
                        helpfulCount: (review.helpfulCount || 0) + 1,
                        helpfulVotes: [...(review.helpfulVotes || []), user.uid]
                    };
                }
            }
            return review;
        });
        localStorage.setItem(`coalition_reviews_${productId}`, JSON.stringify(updatedReviews));
    };

    const openLightbox = (photos: string[], index: number) => {
        setLightboxPhotos(photos);
        setLightboxIndex(index);
    };

    // Filter reviews
    let filteredReviews = reviews.filter(r => r.verified);

    if (filterBy === 'verified') {
        filteredReviews = filteredReviews.filter(r => r.purchaseVerified);
    } else if (filterBy === 'photos') {
        filteredReviews = filteredReviews.filter(r => r.photos && r.photos.length > 0);
    } else if (typeof filterBy === 'number') {
        filteredReviews = filteredReviews.filter(r => r.rating === filterBy);
    }

    // Sort reviews
    const sortedReviews = [...filteredReviews].sort((a, b) => {
        switch (sortBy) {
            case 'highest':
                return b.rating - a.rating;
            case 'lowest':
                return a.rating - b.rating;
            case 'helpful':
                return (b.helpfulCount || 0) - (a.helpfulCount || 0);
            case 'recent':
            default:
                return b.createdAt - a.createdAt;
        }
    });

    const verifiedReviews = reviews.filter(r => r.verified);
    const averageRating = verifiedReviews.length > 0
        ? (verifiedReviews.reduce((acc, r) => acc + r.rating, 0) / verifiedReviews.length).toFixed(1)
        : '0.0';

    return (
        <div className="mt-16 border-t border-white/10 pt-12">
            {/* Header with Average Rating */}
            <div className="flex flex-col lg:flex-row gap-8 mb-8">
                <div className="flex-1">
                    <h2 className="text-2xl font-bold font-display uppercase mb-4">Customer Reviews</h2>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="text-center">
                            <div className="text-4xl font-bold mb-1">{averageRating}</div>
                            <div className="flex text-yellow-500 mb-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                        key={star}
                                        className={`w-5 h-5 ${star <= Math.round(Number(averageRating)) ? 'fill-current' : 'text-gray-600'}`}
                                    />
                                ))}
                            </div>
                            <span className="text-xs text-gray-400">
                                {verifiedReviews.length} reviews
                            </span>
                        </div>
                    </div>

                    {/* Star Rating Breakdown */}
                    <StarRatingBreakdown
                        reviews={verifiedReviews}
                        onFilterByRating={(rating) => setFilterBy(rating || 'all')}
                    />
                </div>

                {/* Write Review Button */}
                <div className="flex flex-col gap-4">
                    {!isWriting && (
                        <button
                            onClick={() => setIsWriting(true)}
                            disabled={!user || hasReviewed}
                            className="px-6 py-3 bg-white text-black hover:bg-gray-200 font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {hasReviewed ? 'Already Reviewed' : 'Write a Review'}
                        </button>
                    )}
                    {!user && (
                        <p className="text-xs text-gray-400 text-center">
                            Login to write a review
                        </p>
                    )}
                    {hasPurchased && (
                        <div className="flex items-center gap-2 text-xs text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            Verified Purchase
                        </div>
                    )}
                </div>
            </div>

            {/* Write Review Form */}
            {isWriting && (
                <form onSubmit={handleSubmit} className="mb-12 bg-gray-900/50 p-6 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold">Write a Review</h3>
                        <button
                            type="button"
                            onClick={() => setIsWriting(false)}
                            className="text-gray-400 hover:text-white text-sm"
                        >
                            Cancel
                        </button>
                    </div>

                    {/* SGCoin Reward Info */}
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-sm text-green-400 flex items-center gap-2">
                            <span className="text-xl">🪙</span>
                            Earn <strong>50 SGCoins</strong> for your review, or <strong>100 SGCoins</strong> with photos!
                        </p>
                    </div>

                    {/* Rating */}
                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2">Rating *</label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="transition-transform hover:scale-110"
                                >
                                    <Star
                                        className={`w-8 h-8 ${star <= (hoverRating || rating)
                                                ? 'fill-yellow-500 text-yellow-500'
                                                : 'text-gray-600'
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Comment */}
                    <div className="mb-4">
                        <label htmlFor="review-comment" className="block text-sm font-bold mb-2">
                            Your Review
                        </label>
                        <textarea
                            id="review-comment"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={4}
                            placeholder="Share your experience with this product..."
                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white placeholder-gray-500 focus:border-white/30 focus:outline-none"
                        />
                    </div>

                    {/* Photo Upload */}
                    <div className="mb-6">
                        <label className="block text-sm font-bold mb-2 flex items-center gap-2">
                            <Camera className="w-4 h-4" />
                            Add Photos (Optional)
                        </label>
                        <ReviewPhotoUpload photos={photos} onPhotosChange={setPhotos} />
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        className="w-full bg-white text-black py-3 rounded-lg font-bold uppercase tracking-wide hover:bg-gray-200 transition"
                    >
                        Submit Review
                    </button>
                </form>
            )}

            {/* Sorting & Filtering */}
            {verifiedReviews.length > 0 && (
                <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-400">Sort by:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="bg-gray-900 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
                            aria-label="Sort reviews"
                        >
                            <option value="recent">Most Recent</option>
                            <option value="highest">Highest Rating</option>
                            <option value="lowest">Lowest Rating</option>
                            <option value="helpful">Most Helpful</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Filter:</span>
                        <button
                            onClick={() => setFilterBy('all')}
                            className={`px-3 py-1.5 rounded text-sm transition ${filterBy === 'all'
                                    ? 'bg-white text-black'
                                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterBy('verified')}
                            className={`px-3 py-1.5 rounded text-sm transition ${filterBy === 'verified'
                                    ? 'bg-white text-black'
                                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                                }`}
                        >
                            Verified
                        </button>
                        <button
                            onClick={() => setFilterBy('photos')}
                            className={`px-3 py-1.5 rounded text-sm transition ${filterBy === 'photos'
                                    ? 'bg-white text-black'
                                    : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
                                }`}
                        >
                            With Photos
                        </button>
                    </div>
                </div>
            )}

            {/* Reviews List */}
            <div className="space-y-6">
                {sortedReviews.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-white/5 rounded-xl border border-white/5 border-dashed">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No reviews yet. Be the first to review this product!</p>
                    </div>
                ) : (
                    sortedReviews.map((review) => (
                        <div key={review.id} className="bg-white/5 p-6 rounded-xl border border-white/5">
                            {/* Review Header */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center border border-white/10">
                                        <User className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-sm">{review.userName}</h4>
                                            {review.purchaseVerified && (
                                                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Verified Purchase
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex text-yellow-500 text-xs mt-0.5">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`w-3 h-3 ${i < review.rating ? 'fill-current' : 'text-gray-700'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-500">
                                    {new Date(review.createdAt).toLocaleDateString()}
                                </span>
                            </div>

                            {/* Review Comment */}
                            <p className="text-gray-300 text-sm leading-relaxed mb-4">
                                {review.comment}
                            </p>

                            {/* Review Photos */}
                            {review.photos && review.photos.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    {review.photos.map((photo, index) => (
                                        <button
                                            key={index}
                                            onClick={() => openLightbox(review.photos!, index)}
                                            className="aspect-square rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition"
                                        >
                                            <img
                                                src={photo}
                                                alt={`Review photo ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Helpful Button */}
                            <div className="flex items-center gap-4 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => handleHelpfulVote(review.id)}
                                    disabled={!user || review.helpfulVotes?.includes(user.uid)}
                                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ThumbsUp className="w-4 h-4" />
                                    Helpful ({review.helpfulCount || 0})
                                </button>
                            </div>

                            {/* Brand Response */}
                            {review.brandResponse && (
                                <div className="mt-4 pl-4 border-l-2 border-blue-500 bg-blue-500/5 p-4 rounded-r-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-bold text-blue-400 uppercase">
                                            Response from Coalition
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {new Date(review.brandResponse.respondedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-300">
                                        {review.brandResponse.message}
                                    </p>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Photo Lightbox */}
            {lightboxPhotos && (
                <PhotoLightbox
                    photos={lightboxPhotos}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxPhotos(null)}
                />
            )}
        </div>
    );
};

export default ProductReviews;
