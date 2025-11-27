import { Product } from '../types';

/**
 * Get related products based on category and price range
 */
export const getRelatedProducts = (
    currentProduct: Product,
    allProducts: Product[],
    limit: number = 6
): Product[] => {
    return allProducts
        .filter(p =>
            p.id !== currentProduct.id && // Exclude current product
            !p.archived && // Exclude archived products
            p.category === currentProduct.category // Same category
        )
        .sort((a, b) => {
            // Sort by price similarity
            const aDiff = Math.abs(a.price - currentProduct.price);
            const bDiff = Math.abs(b.price - currentProduct.price);
            return aDiff - bDiff;
        })
        .slice(0, limit);
};

/**
 * Get frequently bought together products
 * For now, using predefined bundles. In production, this would analyze order history.
 */
export const getFrequentlyBoughtTogether = (
    productId: string,
    allProducts: Product[]
): Product[] => {
    // Predefined bundles (productId -> related product IDs)
    const bundles: Record<string, string[]> = {
        'prod_nft_001': ['prod_wallet_001', 'prod_keychain_001'], // Coalition NF-Tee + Wallet + Keychain
        'prod_wallet_001': ['prod_nft_001', 'prod_keychain_001'], // Wallet + Tee + Keychain
        'prod_keychain_001': ['prod_nft_001', 'prod_wallet_001'], // Keychain + Tee + Wallet
    };

    const relatedIds = bundles[productId] || [];

    return allProducts
        .filter(p => relatedIds.includes(p.id) && !p.archived)
        .slice(0, 3); // Limit to 3 items
};

/**
 * Get similar products (broader matching than related)
 */
export const getSimilarProducts = (
    currentProduct: Product,
    allProducts: Product[],
    limit: number = 4
): Product[] => {
    return allProducts
        .filter(p =>
            p.id !== currentProduct.id &&
            !p.archived &&
            (p.category === currentProduct.category ||
                Math.abs(p.price - currentProduct.price) < 20) // Within $20 price range
        )
        .slice(0, limit);
};
