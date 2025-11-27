import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

export interface FilterState {
    categories: string[];
    priceMin: number;
    priceMax: number;
    sizes: string[];
    sortBy: 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'newest';
}

interface FilterPanelProps {
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
    availableSizes: string[];
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFilterChange, availableSizes }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const handleCategoryToggle = (category: string) => {
        const newCategories = filters.categories.includes(category)
            ? filters.categories.filter(c => c !== category)
            : [...filters.categories, category];
        onFilterChange({ ...filters, categories: newCategories });
    };

    const handleSizeToggle = (size: string) => {
        const newSizes = filters.sizes.includes(size)
            ? filters.sizes.filter(s => s !== size)
            : [...filters.sizes, size];
        onFilterChange({ ...filters, sizes: newSizes });
    };

    const handleClearFilters = () => {
        onFilterChange({
            categories: [],
            priceMin: 0,
            priceMax: 1000,
            sizes: [],
            sortBy: 'newest'
        });
    };

    const activeFilterCount = filters.categories.length + filters.sizes.length +
        (filters.priceMin > 0 || filters.priceMax < 1000 ? 1 : 0);

    return (
        <>
            {/* Mobile Filter Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition"
            >
                <SlidersHorizontal className="w-5 h-5" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {activeFilterCount}
                    </span>
                )}
            </button>

            {/* Filter Panel */}
            <div className={`
                ${isOpen ? 'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:relative md:bg-transparent md:backdrop-blur-none' : 'hidden md:block'}
            `}>
                <div className={`
                    ${isOpen ? 'fixed right-0 top-0 h-full w-80 bg-black border-l border-white/10 overflow-y-auto' : ''}
                    md:relative md:w-full md:border-0
                `}>
                    {/* Mobile Header */}
                    {isOpen && (
                        <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10">
                            <h3 className="font-bold text-lg">Filters</h3>
                            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    )}

                    <div className="p-4 space-y-6">
                        {/* Sort By */}
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-wider text-gray-400 mb-3">Sort By</h4>
                            <select
                                value={filters.sortBy}
                                onChange={(e) => onFilterChange({ ...filters, sortBy: e.target.value as any })}
                                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            >
                                <option value="newest">Newest</option>
                                <option value="name-asc">Name (A-Z)</option>
                                <option value="name-desc">Name (Z-A)</option>
                                <option value="price-asc">Price (Low to High)</option>
                                <option value="price-desc">Price (High to Low)</option>
                            </select>
                        </div>

                        {/* Category */}
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-wider text-gray-400 mb-3">Category</h4>
                            <div className="space-y-2">
                                {['apparel', 'accessory'].map(category => (
                                    <label key={category} className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            checked={filters.categories.includes(category)}
                                            onChange={() => handleCategoryToggle(category)}
                                            className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                                        />
                                        <span className="text-sm capitalize group-hover:text-white transition">
                                            {category}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Price Range */}
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-wider text-gray-400 mb-3">Price Range</h4>
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 mb-1 block">Min</label>
                                    <input
                                        type="number"
                                        value={filters.priceMin}
                                        onChange={(e) => onFilterChange({ ...filters, priceMin: Number(e.target.value) })}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                                        min="0"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 mb-1 block">Max</label>
                                    <input
                                        type="number"
                                        value={filters.priceMax}
                                        onChange={(e) => onFilterChange({ ...filters, priceMax: Number(e.target.value) })}
                                        className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Size */}
                        {availableSizes.length > 0 && (
                            <div>
                                <h4 className="font-bold text-sm uppercase tracking-wider text-gray-400 mb-3">Size</h4>
                                <div className="flex flex-wrap gap-2">
                                    {availableSizes.map(size => (
                                        <button
                                            key={size}
                                            onClick={() => handleSizeToggle(size)}
                                            className={`px-3 py-1.5 text-sm font-bold rounded border transition ${filters.sizes.includes(size)
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
                                                }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Clear Filters */}
                        {activeFilterCount > 0 && (
                            <button
                                onClick={handleClearFilters}
                                className="w-full py-2 text-sm text-gray-400 hover:text-white border border-gray-800 rounded-lg hover:bg-white/5 transition"
                            >
                                Clear All Filters
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default FilterPanel;
