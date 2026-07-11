const path = require('path');
const fs = require('fs');

// Load .env for local development (Vercel injects env vars directly in production)
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

// Import Git service functions
const gitService = require('./services/gitService.cjs');

const app = express();
const PORT = 4242;

// Middleware
app.use(cors({ 
    origin: [
        process.env.VITE_APP_URL || 'https://sgcoalition.xyz',
        'http://localhost:3000',
        'http://localhost:3001',
    ],
    credentials: true,
}));
app.use(express.json());

// Git operations endpoint
app.all('/api/git-operations', async (req, res) => {
    try {
        // Check if Git repository exists
        const isRepo = await gitService.isGitRepository();
        if (!isRepo) {
            return res.status(500).json({ error: 'Git repository not initialized' });
        }

        const { action } = req.query;

        switch (action) {
            case 'commit': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { message, author } = req.body;
                if (!message) {
                    return res.status(400).json({ error: 'Commit message is required' });
                }

                const hash = await gitService.createCommit(message, author);
                return res.status(200).json({ success: true, hash });
            }

            case 'log': {
                const limit = parseInt(req.query.limit) || 50;
                const commits = await gitService.getCommitHistory(limit);
                return res.status(200).json({ commits });
            }

            case 'branches': {
                const branches = await gitService.getBranches();
                const currentBranch = await gitService.getCurrentBranch();
                return res.status(200).json({ branches, currentBranch });
            }

            case 'checkout': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { branch } = req.body;
                if (!branch) {
                    return res.status(400).json({ error: 'Branch name is required' });
                }

                await gitService.switchBranch(branch);
                return res.status(200).json({ success: true, branch });
            }

            case 'reset': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                const { commitHash, hard } = req.body;
                if (!commitHash) {
                    return res.status(400).json({ error: 'Commit hash is required' });
                }

                await gitService.resetToCommit(commitHash, hard || false);
                return res.status(200).json({ success: true, commitHash });
            }

            case 'diff': {
                const { commitHash } = req.query;
                if (!commitHash) {
                    return res.status(400).json({ error: 'Commit hash is required' });
                }

                const diff = await gitService.getCommitDiff(commitHash);
                return res.status(200).json({ diff });
            }

            case 'status': {
                const status = await gitService.getStatus();
                const currentBranch = await gitService.getCurrentBranch();
                return res.status(200).json({ status, currentBranch });
            }

            case 'sync-constants': {
                if (req.method !== 'POST') {
                    return res.status(405).json({ error: 'Method not allowed' });
                }

                // Fetch every product from Supabase using the service-role client
                // so we bypass RLS (consistent with the admin-products handler).
                const supabase = await getSupabaseAdmin();
                const { data: dbProducts, error: fetchError } = await supabase
                    .from('products')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (fetchError) return res.status(500).json({ error: fetchError.message });
                if (!dbProducts) return res.status(500).json({ error: 'No products returned from Supabase' });

                // Mirror scripts/syncProducts.ts mapping. Trimmed/camelCased
                // keys to match the Product[] shape in types.ts.
                const mappedProducts = dbProducts.map(p => ({
                    id: p.id,
                    name: (p.name || '').trim(),
                    price: p.price,
                    images: p.images || [],
                    description: (p.description || '').trim(),
                    // Normalize legacy "accessories" plural to the Product type's
                    // accepted "accessory" to keep the storefront category filter
                    // working.
                    category: (() => {
                        const c = (p.category || 'apparel').toLowerCase().trim();
                        return c === 'accessories' ? 'accessory' : c;
                    })(),
                    isFeatured: !!p.is_featured,
                    isLimitedEdition: p.is_limited_edition ?? false,
                    sizes: p.sizes || [],
                    sizeInventory: p.size_inventory || {},
                    nft: p.nft_metadata || null,
                    archived: !!p.archived,
                    archivedAt: p.archived_at || null,
                    releasedAt: p.released_at || null,
                    soldAt: p.sold_at || null,
                }));

                // Build the replacement INITIAL_PRODUCTS block and diff
                // against the current file contents. If nothing changed,
                // skip the write+commit to avoid noise commits.
                const constantsPath = path.resolve(__dirname, 'constants.ts');
                const beforeContent = fs.readFileSync(constantsPath, 'utf8');
                const replacement = `export const INITIAL_PRODUCTS: Product[] = ${JSON.stringify(mappedProducts, null, 2)};`;
                const afterContent = beforeContent.replace(
                    /export const INITIAL_PRODUCTS: Product\[\] = \[[\s\S]*?\];/,
                    replacement
                );

                if (afterContent === beforeContent) {
                    const head = await gitService.executeGitCommand('git rev-parse --short HEAD');
                    return res.status(200).json({ noChanges: true, hash: head });
                }

                fs.writeFileSync(constantsPath, afterContent, 'utf8');
                const commitMessage = (req.body && req.body.message) || 'Sync products from Supabase';
                const hash = await gitService.createCommit(commitMessage, 'Coalition Admin <admin@coalition.local>');
                return res.status(200).json({ success: true, hash });
            }

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }
    } catch (error) {
        console.error('Git operation error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Git API server is running' });
});

// ---------------------------------------------------------------------------
// Admin verify — mirrors api/_handlers/admin-verify.ts
// ---------------------------------------------------------------------------
app.all('/api/admin-verify', (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const password = String(req.body?.password || '').trim();
    if (!password) {
        res.status(400).json({ error: 'Password is required.' });
        return;
    }

    const adminPassphrase = (process.env.ADMIN_PASSPHRASE || '').trim();
    const adminApiToken = (process.env.ADMIN_API_TOKEN || '').trim();

    if (!adminPassphrase && !adminApiToken) {
        console.error('[admin-verify] Neither ADMIN_PASSPHRASE nor ADMIN_API_TOKEN is set.');
        res.status(503).json({ error: 'Admin authentication is not configured on this server.' });
        return;
    }

    const isValid = password === adminPassphrase || password === adminApiToken;
    if (!isValid) {
        console.warn('[admin-verify] Failed admin login attempt.');
        res.status(401).json({ error: 'Invalid admin passphrase.' });
        return;
    }

    const token = adminApiToken || adminPassphrase;
    console.log('[admin-verify] Admin login successful.');
    res.status(200).json({ token, success: true });
});

// ---------------------------------------------------------------------------
// Admin product CRUD — mirrors api/_handlers/admin-products.ts
// These run locally via Express (Vite proxies /api -> localhost:4242).
// In production, Vercel serves the api/_handlers/*.ts serverless functions.
// ---------------------------------------------------------------------------

async function getSupabaseAdmin() {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw Object.assign(new Error('Supabase admin service is not configured.'), { status: 503 });
    }
    return createClient(supabaseUrl, serviceRoleKey);
}

function getBearerToken(req) {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    return match?.[1] || null;
}

function isAdminAuthorized(req) {
    const token = getBearerToken(req);
    if (!token) return false;
    const adminToken = (process.env.ADMIN_API_TOKEN || '').trim();
    return adminToken.length > 0 && token === adminToken;
}

app.all('/api/admin-products', async (req, res) => {
    try {
        if (!isAdminAuthorized(req)) {
            return res.status(401).json({ error: 'Admin authorization required.' });
        }

        const supabase = await getSupabaseAdmin();

        if (req.method === 'POST') {
            const product = req.body?.product;
            if (!product || !product.id || !product.name) {
                return res.status(400).json({ error: 'Product with id and name is required.' });
            }
            const dbProduct = {
                id: product.id, name: product.name, price: Number(product.price || 0),
                category: product.category || 'apparel', images: product.images || [],
                description: product.description || '', is_featured: !!product.isFeatured,
                is_limited_edition: product.isLimitedEdition ?? false,
                pricing_tiers: product.pricingTiers ?? null,
                edition_size: product.editionSize ?? null,
                sizes: product.sizes || [], size_inventory: product.sizeInventory || {},
                nft_metadata: product.nft || null, archived: product.archived || false,
            };
            const { data, error } = await supabase.from('products').insert([dbProduct]).select().single();
            if (error) return res.status(500).json({ error: error.message });
            if (dbProduct.is_featured) {
                await supabase.from('products').update({ is_featured: false }).eq('is_featured', true).neq('id', product.id);
            }
            return res.status(200).json(data);
        }

        if (req.method === 'PATCH') {
            const product = req.body?.product;
            if (!product || !product.id) {
                return res.status(400).json({ error: 'Product with id is required.' });
            }
            // Non-destructive PATCH: only update fields the client actually sent.
            // Using `?? null` fallbacks on every field was silently wiping
            // pricing_tiers/edition_size to NULL whenever the admin saved a
            // product via a form that didn't include those fields.
            const dbProduct = {};
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
            const { data, error } = await supabase.from('products').update(dbProduct).eq('id', product.id).select().single();
            if (error) return res.status(500).json({ error: error.message });
            if (dbProduct.is_featured) {
                await supabase.from('products').update({ is_featured: false }).eq('is_featured', true).neq('id', product.id);
            }
            return res.status(200).json(data);
        }

        if (req.method === 'DELETE') {
            const id = String(req.body?.id || '').trim();
            if (!id) return res.status(400).json({ error: 'Product ID is required.' });
            const { error } = await supabase.from('products').delete().eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ deleted: true, id });
        }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('[admin-products]', error?.message || error);
        res.status(error?.status || 500).json({ error: error?.message || 'Product request failed.' });
    }
});

app.all('/api/update-piece-metadata', async (req, res) => {
    try {
        if (!isAdminAuthorized(req)) {
            return res.status(401).json({ error: 'Admin authorization required.' });
        }

        const supabase = await getSupabaseAdmin();
        const pieceId = String(req.body?.pieceId || '').trim();
        if (!pieceId) return res.status(400).json({ error: 'pieceId is required.' });

        const updates = {};
        if (req.body?.nftTokenId !== undefined) {
            updates.nft_token_id = String(req.body.nftTokenId || '').trim() || null;
        }
        if (req.body?.nfcTagUrl !== undefined) {
            updates.nfc_tag_url = String(req.body.nfcTagUrl || '').trim() || null;
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'At least one field (nftTokenId, nfcTagUrl) is required.' });
        }

        const { data, error } = await supabase.from('numbered_pieces').update(updates).eq('id', pieceId).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    } catch (error) {
        console.error('[update-piece-metadata]', error?.message || error);
        res.status(error?.status || 500).json({ error: error?.message || 'Piece metadata update failed.' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Git API server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoint: http://localhost:${PORT}/api/git-operations`);
});
