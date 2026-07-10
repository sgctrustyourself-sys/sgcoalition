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

import { createClient } from '@supabase/supabase-js';

function setCorsHeaders(req: any, res: any) {
    const configuredOrigin = process.env.VITE_APP_URL || 'https://sgcoalition.xyz';
    const allowedOrigins = new Set([
        configuredOrigin,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
    ]);
    const requestOrigin = req.headers?.origin;
    const responseOrigin = requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : configuredOrigin;

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getBearerToken(req: any): string | null {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    return match?.[1] || null;
}

function isAuthorized(req: any): boolean {
    const token = getBearerToken(req);
    if (!token) return false;
    const adminToken = (process.env.ADMIN_API_TOKEN || '').trim();
    return adminToken.length > 0 && token === adminToken;
}

function getSupabaseAdmin() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
        throw Object.assign(new Error('Supabase admin service is not configured.'), { status: 503 });
    }

    return createClient(supabaseUrl, serviceRoleKey);
}

function parseBody(req: any) {
    if (!req.body) return {};
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch {
            throw Object.assign(new Error('Invalid JSON request body.'), { status: 400 });
        }
    }
    return req.body;
}

async function addProduct(body: any) {
    const supabase = getSupabaseAdmin();
    const product = body.product;
    if (!product || !product.id || !product.name) {
        throw Object.assign(new Error('Product with id and name is required.'), { status: 400 });
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
        nft_metadata: product.nft || null,
        archived: product.archived || false,
    };

    const { data, error } = await supabase
        .from('products')
        .insert([dbProduct])
        .select()
        .single();

    if (error) {
        throw Object.assign(new Error(error.message || 'Failed to add product.'), { status: 500 });
    }

    // Clear other featured products AFTER successful insert so a failed
    // write doesn't leave the catalog with no featured product at all.
    if (dbProduct.is_featured) {
        const { error: clearError } = await supabase
            .from('products')
            .update({ is_featured: false })
            .eq('is_featured', true)
            .neq('id', product.id);
        if (clearError) {
            console.warn('[admin-products] Failed to clear other featured products:', clearError);
        }
    }

    return data;
}

async function updateProduct(body: any) {
    const supabase = getSupabaseAdmin();
    const product = body.product;
    if (!product || !product.id) {
        throw Object.assign(new Error('Product with id is required.'), { status: 400 });
    }

    // Non-destructive PATCH: only update fields the client actually sent
    // (mirrors the same fix in server.cjs).
    const dbProduct: Record<string, any> = {};
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

    const { data, error } = await supabase
        .from('products')
        .update(dbProduct)
        .eq('id', product.id)
        .select()
        .single();

    if (error) {
        throw Object.assign(new Error(error.message || 'Failed to update product.'), { status: 500 });
    }

    // Clear other featured products AFTER successful update (see addProduct comment)
    if (dbProduct.is_featured) {
        const { error: clearError } = await supabase
            .from('products')
            .update({ is_featured: false })
            .eq('is_featured', true)
            .neq('id', product.id);
        if (clearError) {
            console.warn('[admin-products] Failed to clear other featured products:', clearError);
        }
    }

    return data;
}

async function deleteProduct(body: any) {
    const supabase = getSupabaseAdmin();
    const id = String(body.id || '').trim();
    if (!id) {
        throw Object.assign(new Error('Product ID is required.'), { status: 400 });
    }

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) {
        throw Object.assign(new Error(error.message || 'Failed to delete product.'), { status: 500 });
    }

    return { deleted: true, id };
}

export default async function handler(req: any, res: any) {
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
            res.status(200).json(await addProduct(body));
            return;
        }

        if (req.method === 'PATCH') {
            res.status(200).json(await updateProduct(body));
            return;
        }

        if (req.method === 'DELETE') {
            res.status(200).json(await deleteProduct(body));
            return;
        }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        const status = Number(error?.status || 500);
        console.error('[admin-products]', error?.message || error);
        res.status(status).json({ error: error?.message || 'Product request failed.' });
    }
}
