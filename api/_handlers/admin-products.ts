// Admin product mutation endpoint.
// Accepts POST (add), PATCH (update), DELETE requests with a Bearer token
// that matches ADMIN_API_TOKEN. Uses SUPABASE_SERVICE_ROLE_KEY to bypass
// RLS so admins who logged in via /api/admin-verify (which doesn't create
// a Supabase auth session) can still mutate products.
//
// WHY: The products table RLS policy requires
//   EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
// but the admin-verify flow stores a token in sessionStorage without
// creating a Supabase auth session, so auth.uid() is always null.
// This handler mirrors the complete-order pattern: verify the static
// token, then use the service-role client for the actual write.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { clearOtherFeaturedProducts } from '../../utils/featuredExclusivity.js';
import {
    type ApiRequest,
    type ApiResponse,
    type ProductRow,
} from '../_types.js';
import {
    createHttpError,
    parseBody,
    setCorsHeaders,
    type HttpError,
} from '../_helpers.js';

function getBearerToken(req: ApiRequest): string | null {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    return match?.[1] || null;
}

function isAuthorized(req: ApiRequest): boolean {
    const token = getBearerToken(req);
    if (!token) return false;
    const adminToken = (process.env.ADMIN_API_TOKEN || '').trim();
    return adminToken.length > 0 && token === adminToken;
}

function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase admin service is not configured.');
    }

    return createClient(supabaseUrl, serviceRoleKey);
}

// Inputs from the Admin Product Manager UI. All fields optional because
// the UI uses these as a partial-update payload (any field the operator
// omits is left untouched on the DB row).
interface ProductDraft {
    id?: string;
    name?: string;
    price?: number | string;
    category?: string;
    images?: string[];
    description?: string;
    isFeatured?: boolean;
    isLimitedEdition?: boolean;
    pricingTiers?: unknown;
    editionSize?: number | string | null;
    sizes?: string[];
    sizeInventory?: Record<string, number>;
    nft?: unknown;
    archived?: boolean;
    soldAt?: string | null;
    archivedAt?: string | null;
}

interface AddProductBody {
    product?: ProductDraft;
    [key: string]: unknown;
}

async function addProduct(body: AddProductBody): Promise<ProductRow> {
    const supabase = getSupabaseAdmin();
    const product = body.product;
    if (!product || !product.id || !product.name) {
        throw createHttpError(400, 'Product with id and name is required.');
    }

    const dbProduct = {
        id: product.id,
        name: product.name,
        price: Number(product.price || 0),
        category: product.category || 'apparel',
        images: product.images || [],
        description: product.description || '',
        is_featured: !!product.isFeatured,
        is_limited_edition: product.isLimitedEdition ?? false,
        pricing_tiers: product.pricingTiers ?? null,
        edition_size: product.editionSize ?? null,
        sizes: product.sizes || [],
        size_inventory: product.sizeInventory || {},
        nft_metadata: product.nft ?? null,
        archived: product.archived || false,
    };

    const { data, error } = await supabase
        .from('products')
        .insert([dbProduct])
        .select()
        .single();

    if (error) {
        throw createHttpError(500, error.message || 'Failed to add product.');
    }

    // Clear other featured products AFTER successful insert so a failed
    // write doesn't leave the catalog with no featured product at all.
    // (Clear failure is logged at WARN, not thrown — by design. See
    // utils/featuredExclusivity.ts header comment for the rationale.)
    await clearOtherFeaturedProducts(supabase, product.id, dbProduct.is_featured, {
        warn: (message) => console.warn(`[admin-products] ${message.replace('[featured-exclusivity] ', '')}`),
    });

    return data as ProductRow;
}

async function updateProduct(body: AddProductBody): Promise<ProductRow> {
    const supabase = getSupabaseAdmin();
    const product = body.product;
    if (!product || !product.id) {
        throw createHttpError(400, 'Product with id is required.');
    }

    // Non-destructive PATCH: only update fields the client actually sent
    // (mirrors the same fix in server.cjs).
    const dbProduct: Record<string, unknown> = {};
    if (product.name !== undefined) dbProduct.name = product.name;
    if (product.price !== undefined) dbProduct.price = Number(product.price || 0);
    if (product.category !== undefined) dbProduct.category = product.category;
    if (product.images !== undefined) dbProduct.images = product.images;
    if (product.description !== undefined) dbProduct.description = product.description;
    if (product.isFeatured !== undefined) dbProduct.is_featured = !!product.isFeatured;
    if (product.isLimitedEdition !== undefined) dbProduct.is_limited_edition = product.isLimitedEdition;
    if (product.pricingTiers !== undefined) dbProduct.pricing_tiers = product.pricingTiers;
    if (product.editionSize !== undefined) dbProduct.edition_size = product.editionSize;
    if (product.sizes !== undefined) dbProduct.sizes = product.sizes;
    if (product.sizeInventory !== undefined) dbProduct.size_inventory = product.sizeInventory;
    if (product.nft !== undefined) dbProduct.nft_metadata = product.nft;
    if (product.archived !== undefined) dbProduct.archived = product.archived;
    if (product.soldAt !== undefined) dbProduct.sold_at = product.soldAt;
    if (product.archivedAt !== undefined) dbProduct.archived_at = product.archivedAt;

    const { data, error } = await supabase
        .from('products')
        .update(dbProduct)
        .eq('id', product.id)
        .select()
        .single();

    if (error) {
        throw createHttpError(500, error.message || 'Failed to update product.');
    }

    // Clear other featured products AFTER successful update (see addProduct comment)
    await clearOtherFeaturedProducts(supabase, product.id, !!product.isFeatured, {
        warn: (message) => console.warn(`[admin-products] ${message.replace('[featured-exclusivity] ', '')}`),
    });

    return data as ProductRow;
}

async function deleteProduct(body: { id?: string }): Promise<{ deleted: true; id: string }> {
    const supabase = getSupabaseAdmin();
    const id = String(body.id || '').trim();
    if (!id) {
        throw createHttpError(400, 'Product ID is required.');
    }

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) {
        throw createHttpError(500, error.message || 'Failed to delete product.');
    }

    return { deleted: true, id };
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (!isAuthorized(req)) {
        res.status(401).json({ error: 'Admin authorization required.' });
        return;
    }

    try {
        const body = parseBody(req);

        if (req.method === 'POST') {
            res.status(200).json(await addProduct(body as AddProductBody));
            return;
        }

        if (req.method === 'PATCH') {
            res.status(200).json(await updateProduct(body as AddProductBody));
            return;
        }

        if (req.method === 'DELETE') {
            res.status(200).json(await deleteProduct(body));
            return;
        }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (error: unknown) {
        const httpError = error as Partial<HttpError>;
        const status = Number(httpError?.status || 500);
        console.error('[admin-products]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Product request failed.' });
    }
}
