import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/Button';
import { Heart, ChevronRight, ArrowLeft, Star, Coins } from 'lucide-react';
import { SG_COIN_RATE } from '../constants';

export const ProductPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { products, addToCart, user, toggleFavorite, isAdminMode, updateProduct, addReview } = useApp();
  
  const product = products.find(p => p.id === id);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [isAnimating, setIsAnimating] = useState(false);

  // Review State
  const [ratingInput, setRatingInput] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    if (product && product.sizes.length > 0) {
        setSelectedSize(product.sizes[0]);
    }
  }, [product]);

  if (!product) return <div className="p-20 text-center">Product not found</div>;

  const isFavorite = user?.favorites.includes(product.id);

  // Calculate Ratings
  const reviews = product.reviews || [];
  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
    : '0.0';

  // Calculate SGCoin Earnings
  const potentialCoins = Math.floor(product.price * SG_COIN_RATE);

  const handleAddToCart = () => {
    setIsAnimating(true);
    addToCart(product, selectedSize);
    setTimeout(() => setIsAnimating(false), 1000);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      
      addReview(product.id, {
          id: `r_${Date.now()}`,
          userId: user.id,
          userName: user.email ? user.email.split('@')[0] : 'Verified User',
          rating: ratingInput,
          comment: reviewText,
          date: new Date().toISOString().split('T')[0]
      });
      setReviewText('');
      setReviewSubmitted(true);
      setTimeout(() => setReviewSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen bg-white pt-12 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-500 mb-8 hover:text-black">
            <ArrowLeft size={16} className="mr-2" /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 mb-20">
          {/* Images */}
          <div className="space-y-4">
            <div className="aspect-[4/5] w-full bg-gray-100 overflow-hidden rounded-sm">
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                {product.images.slice(1).map((img, idx) => (
                    <img key={idx} src={img} className="aspect-square object-cover bg-gray-100" alt="" />
                ))}
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col justify-center">
             <div className="flex items-center gap-2 mb-2">
                <div className="flex text-yellow-500">
                    <Star size={16} fill="currentColor" />
                </div>
                <span className="text-sm font-bold">{averageRating}</span>
                <span className="text-sm text-gray-400">({reviews.length} Reviews)</span>
             </div>

             <h1 className="text-4xl font-bold tracking-tight mb-2">{product.name}</h1>
             <div className="text-2xl text-gray-900 mb-8">${product.price}</div>

             <div className="prose prose-lg text-gray-500 mb-8">
                 <p>{product.description}</p>
             </div>

             {/* Colors */}
             {product.colors && product.colors.length > 0 && (
                 <div className="mb-6">
                     <h3 className="text-sm font-medium text-gray-900 mb-2">Available Colors</h3>
                     <div className="flex gap-2">
                         {product.colors.map(c => (
                             <span key={c} className="px-3 py-1 bg-gray-100 text-xs uppercase font-bold text-gray-600 rounded">{c}</span>
                         ))}
                     </div>
                 </div>
             )}

             {/* Size Selector */}
             <div className="mb-8">
                 <h3 className="text-sm font-medium text-gray-900 mb-4">Select Size</h3>
                 <div className="flex flex-wrap gap-3">
                     {product.sizes.map(size => (
                         <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
                            className={`w-14 h-14 flex items-center justify-center border text-sm font-medium transition-all
                                ${selectedSize === size ? 'border-black bg-black text-white' : 'border-gray-200 text-gray-900 hover:border-black'}
                            `}
                         >
                             {size}
                         </button>
                     ))}
                 </div>
             </div>

             {/* Actions */}
             <div className="flex space-x-4 mb-8">
                 <Button 
                    onClick={handleAddToCart} 
                    size="lg" 
                    className={`flex-1 transition-all duration-300 ${isAnimating ? 'bg-green-600 scale-95' : ''}`}
                 >
                    {isAnimating ? 'Added to Cart' : 'Add to Cart'}
                 </Button>
                 <button 
                    onClick={() => toggleFavorite(product.id)}
                    className={`p-4 border border-gray-200 rounded-none hover:border-black transition-colors ${isFavorite ? 'text-red-500 border-red-500' : 'text-gray-400'}`}
                 >
                     <Heart fill={isFavorite ? "currentColor" : "none"} />
                 </button>
             </div>

             <div className="border-t border-gray-100 pt-8">
                 <div className="flex items-center text-sm text-gray-500 mb-2">
                     <span className="w-4 h-4 bg-green-500 rounded-full mr-3"></span>
                     In Stock - Ready to Ship from Baltimore
                 </div>
             </div>

             {/* SGCoin Rewards Badge */}
             <div className="mt-4 bg-yellow-50 border border-yellow-100 p-4 rounded flex items-start gap-3">
                 <div className="text-yellow-600 mt-0.5">
                     <Coins size={18} />
                 </div>
                 <div>
                     <p className="font-bold text-yellow-900 text-sm">
                         Earn {potentialCoins.toLocaleString()} SGCoin with this purchase
                     </p>
                     <p className="text-xs text-yellow-700 mt-1">
                         Rewards Program: 30,000 SGCoin per $20 spent. Connect wallet to claim.
                     </p>
                 </div>
             </div>
             
             {/* Admin Edit Controls */}
             {isAdminMode && (
                 <div className="mt-10 p-4 border border-dashed border-red-300 bg-red-50 rounded">
                     <h4 className="font-bold text-red-800 mb-2">Admin: Product Settings</h4>
                     <div className="space-y-2">
                         <label className="block text-xs">Name</label>
                         <input className="w-full p-2 border" value={product.name} onChange={(e) => updateProduct({...product, name: e.target.value})} />
                         <label className="block text-xs">Price</label>
                         <input className="w-full p-2 border" type="number" value={product.price} onChange={(e) => updateProduct({...product, price: parseFloat(e.target.value)})} />
                     </div>
                 </div>
             )}
          </div>
        </div>

        {/* Reviews Section */}
        <div className="border-t border-gray-100 pt-16">
            <h2 className="text-3xl font-bold mb-8">Customer Reviews</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                {/* Review Form */}
                <div className="md:col-span-1">
                    <div className="bg-gray-50 p-6 rounded-xl">
                        <h3 className="text-lg font-bold mb-4">Write a Review</h3>
                        {user ? (
                            <form onSubmit={handleSubmitReview}>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                                    <div className="flex space-x-2">
                                        {[1,2,3,4,5].map(num => (
                                            <button 
                                                key={num} 
                                                type="button"
                                                onClick={() => setRatingInput(num)}
                                                className={`focus:outline-none ${num <= ratingInput ? 'text-yellow-500' : 'text-gray-300'}`}
                                            >
                                                <Star fill="currentColor" size={24} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Review</label>
                                    <textarea 
                                        required
                                        value={reviewText}
                                        onChange={(e) => setReviewText(e.target.value)}
                                        rows={4}
                                        className="w-full p-3 border border-gray-200 rounded focus:border-black focus:ring-0 transition-colors"
                                        placeholder="Tell us what you think..."
                                    ></textarea>
                                </div>
                                <Button type="submit" className="w-full">
                                    {reviewSubmitted ? 'Submitted!' : 'Submit Review'}
                                </Button>
                            </form>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-gray-500 mb-4">Please log in to leave a review.</p>
                                <Button variant="outline" onClick={() => navigate('/')}>Go to Login</Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reviews List */}
                <div className="md:col-span-2 space-y-6">
                    {reviews.length === 0 ? (
                        <p className="text-gray-500 italic">No reviews yet. Be the first to write one!</p>
                    ) : (
                        reviews.map((review) => (
                            <div key={review.id} className="border-b border-gray-100 pb-6 last:border-0">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold">{review.userName}</div>
                                        {/* Verified badge visual */}
                                        <span className="text-green-600 text-xs bg-green-50 px-2 py-0.5 rounded-full">Verified Buyer</span>
                                    </div>
                                    <div className="text-sm text-gray-400">{review.date}</div>
                                </div>
                                <div className="flex text-yellow-500 mb-3">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} size={14} fill={i < review.rating ? "currentColor" : "none"} className={i < review.rating ? "" : "text-gray-300"} />
                                    ))}
                                </div>
                                <p className="text-gray-600 leading-relaxed">{review.comment}</p>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};