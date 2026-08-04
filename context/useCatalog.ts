// context/useCatalog.ts
// Domain hook for the Product catalog — single owner of fetch, merge,
// dedup, enrichment, CRUD, inventory deduction, and reviews.

import { useState, useEffect } from 'react';
import { Product, Review, OrderItem } from '../types';
import { INITIAL_PRODUCTS, PRODUCT_LOCAL_OVERRIDES } from '../constants';
import { supabase } from '../services/supabase';
import { resolveLocalImageUrls } from '../utils/localImageAssets';
import { normalizeProductSizeData } from '../utils/productSizes';
import { fetchPaidCountsByProduct } from '../services/numberedPieces';
import { clearOtherFeaturedProducts } from '../utils/featuredExclusivity';
import { autoCommit, generateProductAddedMessage, generateProductUpdatedMessage, generateProductDeletedMessage } from '../services/autoCommitService';

import { safeJsonParse } from '../utils/storage';

const applyLocalProductOverrides = (items: Product[]) =>
    items.map(product => ({ ...product, ...(PRODUCT_LOCAL_OVERRIDES[product.id] || {}) }));

const getExclusiveFeaturedProducts = (featuredProductId: string, baseProducts: Product[]) =>
    baseProducts.map(product => ({ ...product, isFeatured: product.id === featuredProductId }));

export function useCatalog(
    isSupabaseConfigured: boolean,
    getAdminToken: () => string | null,
    addToast: (msg: string, type: 'success' | 'error' | 'info') => void,
    onConfigError?: (isError: boolean) => void,
) {
    const [products, setProducts] = useState<Product[]>([]);

    const fetchProducts = async (): Promise<Product[]> => {
        if (!isSupabaseConfigured) {
            const localProducts = applyLocalProductOverrides(INITIAL_PRODUCTS);
            setProducts(localProducts);
            return localProducts;
        }
        try {
            const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (data) {
                const mapped = data.map(item => {
                    const savedReviews = safeJsonParse(`coalition_reviews_${item.id}`, []);
                    return {
                        id: item.id, name: item.name, price: Number(item.price), stock: item.stock, category: item.category,
                        createdAt: item.created_at || item.createdAt,
                        images: resolveLocalImageUrls(item.images || []), description: item.description,
                        makingVideoUrl: item.making_video_url || item.makingVideoUrl,
                        isFeatured: item.is_featured,
                        isLimitedEdition: item.is_limited_edition ?? false,
                        pricingTiers: item.pricing_tiers ?? null,
                        editionSize: item.edition_size ?? null,
                        editionSoldCount: null as number | null,
                        sizes: item.sizes || [], sizeInventory: item.size_inventory || {}, nft: item.nft_metadata,
                        reviews: savedReviews, archived: item.archived || false,
                        archivedAt: item.archived_at, releasedAt: item.released_at, soldAt: item.sold_at,
                        archiveNote: PRODUCT_LOCAL_OVERRIDES[item.id]?.archiveNote
                    };
                });
                const uniqueProducts = mapped.reduce((acc: any[], current) => {
                    if (!acc.find(item => item.id === current.id)) return acc.concat([current]);
                    console.warn('[products] dropping duplicate id row:', current.id, current.name);
                    return acc;
                }, []);
                const initialProductMap = new Map(INITIAL_PRODUCTS.map(p => [p.id, p]));
                const interceptedProducts = uniqueProducts.map((sp: any) => {
                    const local = initialProductMap.get(sp.id);
                    if (local) return { ...local, ...sp, isFeatured: typeof sp.isFeatured === 'boolean' ? sp.isFeatured : local.isFeatured };
                    return sp;
                });
                const supabaseIds = new Set(interceptedProducts.map((p: any) => p.id));
                const localOnly = INITIAL_PRODUCTS.filter(p => !supabaseIds.has(p.id));
                const finalMerged = [...interceptedProducts, ...localOnly];
                const finalWithOverrides = applyLocalProductOverrides(finalMerged);
                const numberedIds = finalWithOverrides.filter(p => p.editionSize && p.pricingTiers && p.pricingTiers.length > 0).map(p => p.id);
                const countsByProduct = numberedIds.length > 0 ? await fetchPaidCountsByProduct(numberedIds) : {};
                const enrichedProducts = finalWithOverrides.map(p =>
                    countsByProduct[p.id] !== undefined ? { ...p, editionSoldCount: countsByProduct[p.id] } : p
                );
                setProducts(enrichedProducts);
                onConfigError?.(false);
                return enrichedProducts;
            }
            return [];
        } catch (err) {
            console.error('Error fetching products:', err);
            onConfigError?.(true);
            const fallback = applyLocalProductOverrides(INITIAL_PRODUCTS);
            setProducts(fallback);
            return fallback;
        }
    };

    // Realtime products channel
    useEffect(() => {
        if (!isSupabaseConfigured) return;
        const channel = supabase.channel('products_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchProducts())
            .subscribe();
        return () => { channel.unsubscribe(); };
    }, [isSupabaseConfigured]);

    const addProduct = async (p: Product) => {
        if (!isSupabaseConfigured) return;
        const originalProducts = products;
        const normalizedSizes = normalizeProductSizeData(p.sizes, p.sizeInventory);
        const normalizedProduct = {
            ...p,
            createdAt: p.createdAt || new Date().toISOString(),
            isFeatured: !!p.isFeatured,
            sizes: normalizedSizes.sizes,
            sizeInventory: normalizedSizes.sizeInventory,
        };
        const nextProducts = normalizedProduct.isFeatured
            ? getExclusiveFeaturedProducts(normalizedProduct.id, [...originalProducts, normalizedProduct])
            : [...originalProducts, normalizedProduct];

        setProducts(nextProducts);
        try {
            const adminToken = getAdminToken();
            if (adminToken) {
                const response = await fetch('/api/admin-products', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify({ product: normalizedProduct })
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error || 'Failed to add product via API');
                }
            } else {
                const { error } = await supabase.from('products').insert([{
                    id: normalizedProduct.id, name: normalizedProduct.name, price: normalizedProduct.price, category: normalizedProduct.category, images: normalizedProduct.images,
                    description: normalizedProduct.description, is_featured: normalizedProduct.isFeatured,
                    is_limited_edition: normalizedProduct.isLimitedEdition ?? false,
                    pricing_tiers: normalizedProduct.pricingTiers ?? null,
                    edition_size: normalizedProduct.editionSize ?? null,
                    sizes: normalizedProduct.sizes,
                    size_inventory: normalizedProduct.sizeInventory, nft_metadata: normalizedProduct.nft
                }]);
                if (error) throw error;
                if (normalizedProduct.isFeatured) {
                    await clearOtherFeaturedProducts(supabase, normalizedProduct.id, normalizedProduct.isFeatured);
                }
            }
            await autoCommit({ message: generateProductAddedMessage(p.name) });
        } catch (err) {
            setProducts(originalProducts);
            addToast('Failed to add product.', 'error');
            throw err;
        }
    };

    const updateProduct = async (updated: Product) => {
        if (!isSupabaseConfigured) return;
        const original = products.find(p => p.id === updated.id);
        const normalizedSizes = normalizeProductSizeData(updated.sizes, updated.sizeInventory);
        const normalizedUpdated = {
            ...updated,
            isFeatured: !!updated.isFeatured,
            sizes: normalizedSizes.sizes,
            sizeInventory: normalizedSizes.sizeInventory,
        };
        const nextProducts = normalizedUpdated.isFeatured
            ? getExclusiveFeaturedProducts(normalizedUpdated.id, products.map(p => p.id === normalizedUpdated.id ? normalizedUpdated : p))
            : products.map(p => p.id === normalizedUpdated.id ? normalizedUpdated : p);

        setProducts(nextProducts);
        try {
            const adminToken = getAdminToken();
            if (adminToken) {
                const response = await fetch('/api/admin-products', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify({ product: normalizedUpdated })
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error || 'Failed to update product via API');
                }
            } else {
                const updates: Record<string, unknown> = {
                    name: normalizedUpdated.name, price: normalizedUpdated.price, category: normalizedUpdated.category, images: normalizedUpdated.images,
                    description: normalizedUpdated.description,
                    is_featured: normalizedUpdated.isFeatured,
                    is_limited_edition: normalizedUpdated.isLimitedEdition ?? false,
                    pricing_tiers: normalizedUpdated.pricingTiers ?? null,
                    edition_size: normalizedUpdated.editionSize ?? null,
                    sizes: normalizedUpdated.sizes,
                    size_inventory: normalizedUpdated.sizeInventory, nft_metadata: normalizedUpdated.nft, archived: normalizedUpdated.archived,
                };
                if (normalizedUpdated.soldAt !== undefined) updates.sold_at = normalizedUpdated.soldAt;
                if (normalizedUpdated.archivedAt !== undefined) updates.archived_at = normalizedUpdated.archivedAt;

                const { error } = await supabase.from('products').update(updates).eq('id', normalizedUpdated.id);
                if (error) throw error;
                if (normalizedUpdated.isFeatured) {
                    await clearOtherFeaturedProducts(supabase, normalizedUpdated.id, normalizedUpdated.isFeatured);
                }
            }
            await autoCommit({ message: generateProductUpdatedMessage(updated.name) });
        } catch (err) {
            setProducts(prev => prev.map(p => p.id === updated.id && original ? original : p));
            addToast('Update failed.', 'error');
            throw err;
        }
    };

    const deleteProduct = async (id: string) => {
        const product = products.find(p => p.id === id);
        if (!isSupabaseConfigured) return;
        try {
            const adminToken = getAdminToken();
            if (adminToken) {
                const response = await fetch('/api/admin-products', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${adminToken}`
                    },
                    body: JSON.stringify({ id })
                });
                if (!response.ok) {
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error || 'Failed to delete product via API');
                }
            } else {
                const { error } = await supabase.from('products').delete().eq('id', id);
                if (error) throw error;
            }
            setProducts(prev => prev.filter(p => p.id !== id));
            await autoCommit({ message: generateProductDeletedMessage(product?.name || id) });
        } catch (err) {
            addToast('Failed to delete product.', 'error');
            throw err;
        }
    };

    const deductInventory = async (items: OrderItem[]) => {
        setProducts(prev => prev.map(p => {
            const item = items.find(i => i.productId === p.id);
            if (item && p.sizeInventory) {
                const inv = { ...p.sizeInventory };
                inv[item.selectedSize] = Math.max(0, (inv[item.selectedSize] || 0) - item.quantity);
                return { ...p, sizeInventory: inv };
            }
            return p;
        }));
    };

    const addReview = async (pid: string, r: Review) => {
        setProducts(prev => prev.map(p => p.id === pid ? { ...p, reviews: [r, ...(p.reviews || [])] } : p));
        const saved = safeJsonParse(`coalition_reviews_${pid}`, []);
        localStorage.setItem(`coalition_reviews_${pid}`, JSON.stringify([r, ...saved]));
    };

    return {
        products,
        fetchProducts,
        addProduct,
        updateProduct,
        deleteProduct,
        deductInventory,
        addReview,
    };
}
