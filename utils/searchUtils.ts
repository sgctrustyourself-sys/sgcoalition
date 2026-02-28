import { Product } from '../types';

export interface SearchResult {
    product: Product;
    score: number;
    matchedFields: string[];
}

/**
 * Search products by query string
 * @param products - Array of products to search
 * @param query - Search query string
 * @param includeArchived - Whether to include archived products
 * @returns Array of search results sorted by relevance
 */
export const searchProducts = (
    products: Product[],
    query: string,
    includeArchived: boolean = true
): SearchResult[] => {
    if (!query || query.trim().length === 0) {
        return [];
    }

    const searchTerm = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    products.forEach(product => {
        // Skip archived products if not included
        if (!includeArchived && product.archived) {
            return;
        }

        let score = 0;
        const matchedFields: string[] = [];

        // Search in product name (highest weight)
        if (product.name.toLowerCase().includes(searchTerm)) {
            score += 10;
            matchedFields.push('name');

            // Bonus for exact match
            if (product.name.toLowerCase() === searchTerm) {
                score += 20;
            }

            // Bonus for starts with
            if (product.name.toLowerCase().startsWith(searchTerm)) {
                score += 5;
            }
        }

        // Search in description (medium weight)
        if (product.description.toLowerCase().includes(searchTerm)) {
            score += 5;
            matchedFields.push('description');
        }

        // Search in category (low weight)
        if (product.category.toLowerCase().includes(searchTerm)) {
            score += 3;
            matchedFields.push('category');
        }

        // Fuzzy matching for typos (very low weight)
        if (score === 0) {
            const fuzzyScore = fuzzyMatch(product.name.toLowerCase(), searchTerm);
            if (fuzzyScore > 0.7) {
                score += fuzzyScore * 2;
                matchedFields.push('fuzzy');
            }
        }

        // Add to results if there's a match
        if (score > 0) {
            results.push({
                product,
                score,
                matchedFields
            });
        }
    });

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
};

/**
 * Simple fuzzy matching algorithm
 * Returns a score between 0 and 1 indicating similarity
 */
const fuzzyMatch = (str: string, pattern: string): number => {
    const patternLength = pattern.length;
    const strLength = str.length;

    if (patternLength === 0) return 1.0;
    if (patternLength > strLength) return 0.0;

    let score = 0;
    let patternIdx = 0;

    for (let strIdx = 0; strIdx < strLength; strIdx++) {
        if (str[strIdx] === pattern[patternIdx]) {
            score++;
            patternIdx++;

            if (patternIdx === patternLength) {
                break;
            }
        }
    }

    return score / patternLength;
};

/**
 * Highlight matching text in a string
 * @param text - Original text
 * @param query - Search query to highlight
 * @returns Text with <mark> tags around matches
 */
export const highlightMatch = (text: string, query: string): string => {
    if (!query || query.trim().length === 0) {
        return text;
    }

    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 text-black">$1</mark>');
};

/**
 * Escape special regex characters
 */
const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Get search suggestions (top N results)
 */
export const getSearchSuggestions = (
    products: Product[],
    query: string,
    limit: number = 5
): SearchResult[] => {
    const results = searchProducts(products, query, true);
    return results.slice(0, limit);
};
