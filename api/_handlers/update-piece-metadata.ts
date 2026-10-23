// Admin piece metadata update endpoint.
// Accepts POST with pieceId, nftTokenId, nfcTagUrl. The admin gate is
// withAdminAuth() from api/_adminAuth.ts, which owns the credential policy;
// this handler then uses SUPABASE_SERVICE_ROLE_KEY to update the
// numbered_pieces table bypassing RLS.
//
// WHY: The numbered_pieces table RLS policy for UPDATE requires
//   EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
// but Coalition admins using the admin-verify flow don't have a Supabase
// auth session, so direct client writes fail. This server-side handler
// mirrors the complete-order / admin-products pattern.

import { createClient } from '@supabase/supabase-js';
import { withAdminAuth } from '../_adminAuth.js';
import { LOCAL_DEV_ORIGINS, parseBody } from '../_helpers.js';

function getSupabaseAdmin() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !serviceRoleKey) {
        throw Object.assign(new Error('Supabase admin service is not configured.'), { status: 503 });
    }

    return createClient(supabaseUrl, serviceRoleKey);
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

// Whole-handler gate. The allowed CORS methods are pinned to GET,OPTIONS,POST
// (the set this endpoint always advertised) rather than the wrapper's default.
async function handler(req: any, res: any) {
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

export default withAdminAuth(handler, {
    cors: { originWhitelist: LOCAL_DEV_ORIGINS, methods: 'GET,OPTIONS,POST' },
});
