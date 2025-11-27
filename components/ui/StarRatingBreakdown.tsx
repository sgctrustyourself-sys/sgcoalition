import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingBreakdownProps {
    reviews: Array<{ rating: number }>;
    onFilterByRating?: (rating: number | null) => void;
}

const StarRatingBreakdown: React.FC<StarRatingBreakdownProps> = ({ reviews, onFilterByRating }) => {
    const totalReviews = reviews.length;

    // Count reviews by rating
    const ratingCounts = [5, 4, 3, 2, 1].map(rating => ({
        rating,
        count: reviews.filter(r => r.rating === rating).length,
        percentage: totalReviews > 0
            ? (reviews.filter(r => r.rating === rating).length / totalReviews) * 100
            : 0
    }));

    return (
        <div className="space-y-2">
            {ratingCounts.map(({ rating, count, percentage }) => (
                <button
                    key={rating}
                    onClick={() => onFilterByRating?.(rating)}
                    className="w-full flex items-center gap-3 text-sm hover:bg-white/5 p-2 rounded transition group"
                >
                    {/* Star Rating */}
                    <div className="flex items-center gap-1 w-12">
                        <span className="text-gray-400 font-medium">{rating}</span>
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                    </div>

                    {/* Progress Bar */}
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-yellow-500 transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                        />
                    </div>

                    {/* Percentage & Count */}
                    <div className="flex items-center gap-2 w-24 justify-end">
                        <span className="text-gray-400 text-xs">
                            {percentage.toFixed(0)}%
                        </span>
                        <span className="text-gray-500 text-xs">
                            ({count})
                        </span>
                    </div>
                </button>
            ))}
        </div>
    );
};

export default StarRatingBreakdown;
