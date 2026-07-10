import React from 'react';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { getRelatedProducts } from '../utils/recommendationEngine';
import ProductCard from './ProductCard';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface YouMayAlsoLikeProps {
    currentProduct: Product;
}

const YouMayAlsoLike: React.FC<YouMayAlsoLikeProps> = ({ currentProduct }) => {
    const { products } = useApp();
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const recommendations = getRelatedProducts(currentProduct, products, 6);

    if (recommendations.length === 0) return null;

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const scrollAmount = 300;
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="mt-16 border-t border-white/10 pt-12">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold font-display uppercase">You May Also Like</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => scroll('left')}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition"
                        aria-label="Scroll left"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition"
                        aria-label="Scroll right"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto scrollbar-hide scroll-smooth pb-4"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {recommendations.map(product => (
                    <div key={product.id} className="flex-shrink-0 w-64">
                        <ProductCard product={product} />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default YouMayAlsoLike;
