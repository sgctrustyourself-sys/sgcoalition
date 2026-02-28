import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, ArrowLeft } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { searchProducts } from '../utils/searchUtils';
import ProductCard from '../components/ProductCard';

const SearchResults: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { products } = useApp();
    const query = searchParams.get('q') || '';
    const [sortBy, setSortBy] = useState<'relevance' | 'price-low' | 'price-high' | 'name'>('relevance');

    // Get search results
    const results = query.trim() ? searchProducts(products, query, true) : [];

    // Sort results
    const sortedResults = [...results].sort((a, b) => {
        switch (sortBy) {
            case 'price-low':
                return a.product.price - b.product.price;
            case 'price-high':
                return b.product.price - a.product.price;
            case 'name':
                return a.product.name.localeCompare(b.product.name);
            case 'relevance':
            default:
                return b.score - a.score;
        }
    });

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 bg-black">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-sm text-gray-400 hover:text-white mb-6 transition"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                    <div>
                        <h1 className="font-display text-3xl font-bold text-white mb-2">
                            Search Results
                        </h1>
                        {query && (
                            <p className="text-gray-400">
                                {results.length} {results.length === 1 ? 'result' : 'results'} for "{query}"
                            </p>
                        )}
                    </div>

                    {/* Sort Options */}
                    {results.length > 0 && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-400">Sort by:</label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/40"
                                aria-label="Sort search results"
                            >
                                <option value="relevance">Relevance</option>
                                <option value="price-low">Price: Low to High</option>
                                <option value="price-high">Price: High to Low</option>
                                <option value="name">Name: A-Z</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Results */}
                {!query.trim() ? (
                    <div className="text-center py-20">
                        <SearchIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                        <h2 className="text-xl font-bold text-white mb-2">
                            Enter a search query
                        </h2>
                        <p className="text-gray-400">
                            Use the search bar above to find products
                        </p>
                    </div>
                ) : results.length === 0 ? (
                    <div className="text-center py-20">
                        <SearchIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                        <h2 className="text-xl font-bold text-white mb-2">
                            No results found
                        </h2>
                        <p className="text-gray-400 mb-6">
                            We couldn't find any products matching "{query}"
                        </p>
                        <button
                            onClick={() => navigate('/shop')}
                            className="bg-white text-black px-6 py-3 rounded-lg font-bold uppercase tracking-wide hover:bg-gray-200 transition"
                        >
                            Browse All Products
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {sortedResults.map(({ product }) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchResults;
