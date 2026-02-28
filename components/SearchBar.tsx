import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getSearchSuggestions } from '../utils/searchUtils';

interface SearchBarProps {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    showSuggestions?: boolean; // New prop to enable/disable suggestions
}

const SearchBar: React.FC<SearchBarProps> = ({
    value: controlledValue,
    onChange: controlledOnChange,
    placeholder = 'Search products...',
    showSuggestions = true
}) => {
    const navigate = useNavigate();
    const { products } = useApp();
    const [internalQuery, setInternalQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Use controlled or uncontrolled mode
    const query = controlledValue !== undefined ? controlledValue : internalQuery;
    const setQuery = controlledOnChange || setInternalQuery;

    // Get search suggestions (only if enabled)
    const suggestions = showSuggestions && query.trim().length > 0
        ? getSearchSuggestions(products, query, 5)
        : [];

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!showSuggestions) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSuggestions]);

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions) return;

        if (e.key === 'Escape') {
            setIsOpen(false);
            inputRef.current?.blur();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev =>
                prev < suggestions.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                // Navigate to selected product
                navigate(`/product/${suggestions[selectedIndex].product.id}`);
                setIsOpen(false);
                setQuery('');
            } else if (query.trim()) {
                // Navigate to search results page
                navigate(`/search?q=${encodeURIComponent(query)}`);
                setIsOpen(false);
            }
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        if (showSuggestions) {
            setIsOpen(value.trim().length > 0);
            setSelectedIndex(-1);
        }
    };

    const handleClear = () => {
        setQuery('');
        setIsOpen(false);
        inputRef.current?.focus();
    };

    const handleSuggestionClick = (productId: string) => {
        navigate(`/product/${productId}`);
        setIsOpen(false);
        setQuery('');
    };

    return (
        <div ref={searchRef} className="relative w-full">
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => showSuggestions && query.trim() && setIsOpen(true)}
                    placeholder={placeholder}
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-12 pr-12 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition"
                />
                {query && (
                    <button
                        onClick={handleClear}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition"
                        aria-label="Clear search"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Suggestions Dropdown (only when enabled) */}
            {showSuggestions && isOpen && suggestions.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-gray-900 border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                    {suggestions.map((result, index) => (
                        <button
                            key={result.product.id}
                            onClick={() => handleSuggestionClick(result.product.id)}
                            className={`w-full flex items-center gap-3 p-3 text-left transition ${index === selectedIndex
                                    ? 'bg-white/10'
                                    : 'hover:bg-white/5'
                                }`}
                        >
                            {/* Product Image */}
                            <img
                                src={result.product.images[0]}
                                alt={result.product.name}
                                className="w-12 h-12 object-cover rounded"
                            />

                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">
                                    {result.product.name}
                                </p>
                                <p className="text-sm text-gray-400">
                                    ${result.product.price.toFixed(2)}
                                    {result.product.archived && (
                                        <span className="ml-2 text-xs text-yellow-500">
                                            Archived
                                        </span>
                                    )}
                                </p>
                            </div>
                        </button>
                    ))}

                    {/* View All Results */}
                    <button
                        onClick={() => {
                            navigate(`/search?q=${encodeURIComponent(query)}`);
                            setIsOpen(false);
                        }}
                        className="w-full p-3 text-center text-sm text-blue-400 hover:bg-white/5 border-t border-white/10 transition"
                    >
                        View all results for "{query}"
                    </button>
                </div>
            )}

            {/* No Results (only when enabled) */}
            {showSuggestions && isOpen && query.trim() && suggestions.length === 0 && (
                <div className="absolute top-full mt-2 w-full bg-gray-900 border border-white/10 rounded-lg shadow-xl p-4 z-50">
                    <p className="text-gray-400 text-sm text-center">
                        No products found for "{query}"
                    </p>
                </div>
            )}
        </div>
    );
};

export default SearchBar;
