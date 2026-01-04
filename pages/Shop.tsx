import React, { useState } from 'react';
import { Filter, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import Seo from '../components/Seo';

const Shop = () => {
    const { products, isLoading, isConfigError } = useApp();
    const [isFiltersOpen, setFiltersOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter States
    const [category, setCategory] = useState<string>('all');
    const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
    const [priceRange, setPriceRange] = useState<{ min: number, max: number }>({ min: 0, max: 500 });
    const [sortOption, setSortOption] = useState<string>('newest');

    // VIP Banner State
    const [showVIPBanner, setShowVIPBanner] = useState<boolean>(() => {
        return localStorage.getItem('coalition_vip_banner_dismissed') !== 'true';
    });

    const dismissVIPBanner = () => {
        setShowVIPBanner(false);
        localStorage.setItem('coalition_vip_banner_dismissed', 'true');
    };

    // Derived Data
    const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
    const allSizes = Array.from(new Set(products.flatMap(p => p.sizes || []))) as string[];

    const toggleSize = (size: string) => {
        setSelectedSizes(prev =>
            prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size]
        );
    };

    const filteredProducts = React.useMemo(() => products
        .filter(p => !p.archived) // Exclude archived products from shop
        .filter(p => {
            // Search filter
            if (!searchQuery) return true;
            const query = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(query) ||
                p.description.toLowerCase().includes(query);
        })
        .filter(p => category === 'all' || p.category === category)
        .filter(p => selectedSizes.length === 0 || (p.sizes && p.sizes.some(s => selectedSizes.includes(s))))
        .filter(p => p.price >= priceRange.min && p.price <= priceRange.max)
        .sort((a, b) => {
            // Sort Logic
            if (sortOption === 'price-asc') return a.price - b.price;
            if (sortOption === 'price-desc') return b.price - a.price;
            if (sortOption === 'name-asc') return a.name.localeCompare(b.name);
            if (sortOption === 'name-desc') return b.name.localeCompare(a.name);
            // Popularity Proxy: Featured items first
            if (sortOption === 'popularity') return (a.isFeatured === b.isFeatured) ? 0 : a.isFeatured ? -1 : 1;
            // Newest Proxy: Compare IDs (assuming ascending ID string = newer) and reverse
            if (sortOption === 'newest') return String(b.id).localeCompare(String(a.id));

            return 0;
        }), [products, searchQuery, category, selectedSizes, priceRange, sortOption]);

    return (
        <div className="pt-12 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-screen">
            <Seo
                title="Shop"
                description="Browse the latest Coalition streetwear collection. Premium hoodies, tees, and accessories."
            />
            {/* VIP Membership Banner */}
            {showVIPBanner && (
                <div className="mb-8 bg-gradient-to-r from-purple-900/30 via-purple-800/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="relative flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-purple-300 bg-purple-500/20 px-2 py-1 rounded">MEMBERS ONLY</span>
                            </div>
                            <h3 className="text-lg md:text-xl font-display font-bold uppercase text-white mb-2">
                                Get Free Shipping + $15 Monthly Credit
                            </h3>
                            <p className="text-sm text-gray-300">
                                Join Coalition VIP for only $15/month. Build your credit while you shop.
                                <span className="hidden md:inline"> The membership that pays for itself.</span>
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                            <a
                                href="#/membership"
                                className="px-6 py-3 bg-white text-black font-bold text-sm uppercase tracking-widest hover:bg-gray-200 transition-all whitespace-nowrap"
                            >
                                Learn More
                            </a>
                            <button
                                onClick={dismissVIPBanner}
                                className="text-gray-400 hover:text-white transition-colors text-sm whitespace-nowrap"
                                title="Dismiss"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-baseline border-b border-gray-200 pb-6 mb-8">
                <h1 className="text-4xl font-display font-bold uppercase">Shop All</h1>

                <div className="flex items-center gap-4 mt-4 md:mt-0">
                    <button
                        className="md:hidden flex items-center text-sm font-bold uppercase"
                        onClick={() => setFiltersOpen(!isFiltersOpen)}
                    >
                        <Filter className="w-4 h-4 mr-2" /> Filters
                    </button>

                    <div className="relative">
                        <span className="text-sm text-gray-500 mr-2">Sort by:</span>
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value)}
                            className="text-sm font-bold uppercase bg-white border border-gray-300 rounded px-2 py-1 focus:ring-0 cursor-pointer text-black"
                            title="Sort products"
                        >
                            <option value="newest">Newest Arrivals</option>
                            <option value="popularity">Popularity</option>
                            <option value="name-asc">Name (A-Z)</option>
                            <option value="name-desc">Name (Z-A)</option>
                            <option value="price-asc">Price: Low to High</option>
                            <option value="price-desc">Price: High to Low</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="mb-8">
                <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search products by name or description..."
                />
            </div>

            <div className="flex flex-col md:flex-row gap-12">
                {/* Sidebar Filters */}
                <div className={`w-full md:w-64 flex-shrink-0 ${isFiltersOpen ? 'block' : 'hidden md:block'}`}>
                    <div className="space-y-8 sticky top-24">
                        {/* Categories */}
                        <div>
                            <h3 className="text-sm font-bold uppercase mb-4">Category</h3>
                            <div className="space-y-2">
                                {categories.map(cat => (
                                    <label key={cat} className="flex items-center cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="category"
                                            checked={category === cat}
                                            onChange={() => setCategory(cat)}
                                            className="sr-only"
                                        />
                                        <span className={`w-4 h-4 border mr-3 flex items-center justify-center ${category === cat ? 'bg-black border-black' : 'border-gray-300 group-hover:border-gray-500'}`}>
                                            {category === cat && <Check className="w-3 h-3 text-white" />}
                                        </span>
                                        <span className={`text-sm uppercase ${category === cat ? 'font-bold' : 'text-gray-600'}`}>{cat}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Price */}
                        <div>
                            <h3 className="text-sm font-bold uppercase mb-4">Price Range</h3>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-500">$</span>
                                <input
                                    type="number"
                                    value={priceRange.min}
                                    onChange={(e) => setPriceRange({ ...priceRange, min: Number(e.target.value) })}
                                    className="w-16 border-b border-gray-300 p-1 focus:outline-none focus:border-black text-white bg-transparent"
                                    aria-label="Minimum price"
                                />
                                <span className="text-gray-400">-</span>
                                <span className="text-gray-500">$</span>
                                <input
                                    type="number"
                                    value={priceRange.max}
                                    onChange={(e) => setPriceRange({ ...priceRange, max: Number(e.target.value) })}
                                    className="w-16 border-b border-gray-300 p-1 focus:outline-none focus:border-black text-white bg-transparent"
                                    aria-label="Maximum price"
                                />
                            </div>
                        </div>

                        {/* Sizes */}
                        <div>
                            <h3 className="text-sm font-bold uppercase mb-4">Sizes</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {allSizes.map(size => (
                                    <button
                                        key={size}
                                        onClick={() => toggleSize(size)}
                                        className={`text-xs py-2 border uppercase transition ${selectedSizes.includes(size) ? 'bg-black text-white border-black' : 'border-gray-200 hover:border-black'}`}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="pt-4 border-t border-gray-100">
                            <button
                                onClick={() => { setCategory('all'); setSelectedSizes([]); setPriceRange({ min: 0, max: 500 }); setSearchQuery(''); }}
                                className="text-xs text-gray-500 underline hover:text-black"
                            >
                                Clear All Filters
                            </button>
                        </div>
                    </div>
                </div>

                {/* Product Grid */}
                <div className="flex-1">
                    {isLoading && products.length === 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
                            {[...Array(6)].map((_, i) => (
                                <ProductCardSkeleton key={i} />
                            ))}
                        </div>
                    ) : filteredProducts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
                            {filteredProducts.map(p => <ProductCard key={p.id} product={p} />)}
                        </div>
                    ) : isConfigError ? (
                        <div className="py-20 text-center px-4 bg-red-900/10 border border-red-500/20 rounded-lg">
                            <h3 className="text-xl font-bold text-red-400 mb-2 font-display uppercase">Database Connection Error</h3>
                            <p className="text-gray-400 max-w-md mx-auto mb-6">
                                The application is unable to connect to the database. This is usually caused by missing or invalid environment variables in your Vercel settings.
                            </p>
                            <div className="text-xs text-left bg-black/50 p-4 rounded border border-white/10 font-mono text-gray-400 max-w-lg mx-auto overflow-x-auto">
                                <p className="text-red-300 mb-2">// Diagnostic Info:</p>
                                <p>Error: Invalid API Key (PGRST301)</p>
                                <p>Variable Status:</p>
                                <p>- VITE_SUPABASE_URL: {import.meta.env.VITE_SUPABASE_URL ? (import.meta.env.VITE_SUPABASE_URL === 'VITE_SUPABASE_URL' ? 'PLACEHOLDER' : 'SET') : 'MISSING'}</p>
                                <p>- VITE_SUPABASE_ANON_KEY: {import.meta.env.VITE_SUPABASE_ANON_KEY ? (import.meta.env.VITE_SUPABASE_ANON_KEY === 'VITE_SUPABASE_ANON_KEY' ? 'PLACEHOLDER' : 'SET') : 'MISSING'}</p>
                                <p className="mt-2 text-yellow-300/70">Tip: Ensure these are set in Vercel Project Settings &gt; Environment Variables and that you have triggered a new deployment.</p>
                            </div>
                            <div className="mt-10 border-t border-white/5 pt-10">
                                <p className="text-gray-500 text-sm mb-4">Displaying fallback products catalog:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10 text-left">
                                    {products.map(p => <ProductCard key={p.id} product={p} />)}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 text-center text-gray-500">
                            <p>No products match your criteria.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Shop;
