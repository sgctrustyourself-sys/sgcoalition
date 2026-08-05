// Admin piece metadata update endpoint.
// Accepts POST with pieceId, nftTokenId, nfcTagUrl. Verifies the Bearer
// token against ADMIN_API_TOKEN, then uses SUPABASE_SERVICE_ROLE_KEY to
// update the numbered_pieces table bypassing RLS.
//
// WHY: The numbered_pieces table RLS policy for UPDATE requires
//   EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
// but Coalition admins using the admin-verify flow don't have a Supabase
// auth session, so direct client writes fail. This server-side handler
// mirrors the complete-order / admin-products pattern.

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
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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

async function updateMetadata(body: any) {
    const pieceId = String(body.pieceId || '').trim();
    if (!pieceId) {
        throw Object.assign(new Error('pieceId is required.'), { status: 400 });
    }

    // Only update fields that were explicitly provided. Strip empty strings
    // to NULL so the PDP falls back to the openseaUrl for the piece.
    const updates: Record<string, any> = {};
    if (body.nftTokenId !== undefined) {
        updates.nft_token_id = String(body.nftTokenId || '').trim() || null;
    }
    if (body.nfcTagUrl !== undefined) {
        updates.nfc_tag_url = String(body.nfcTagUrl || '').trim() || null;
    }

    if (Object.keys(updates).length === 0) {
        throw Object.assign(new Error('At least one field (nftTokenId, nfcTagUrl) is required.'), { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('numbered_pieces')
        .update(updates)
        .eq('id', pieceId)
        .select()
        .single();

    if (error) {
        throw Object.assign(new Error(error.message || 'Failed to update piece metadata.'), { status: 500 });
    }

    return data;
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
        if (req.method === 'POST') {
            res.status(200).json(await updateMetadata(parseBody(req)));
            return;
        }

        res.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        const status = Number(error?.status || 500);
        console.error('[update-piece-metadata]', error?.message || error);
        res.status(status).json({ error: error?.message || 'Piece metadata update failed.' });
    }
}
