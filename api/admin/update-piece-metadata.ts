import { createClient } from '@supabase/supabase-js';

// =============================================================================
// /api/admin/update-piece-metadata
// -----------------------------------------------------------------------------
// Server-routed admin UPDATE for public.numbered_pieces. Exists because the
// Coalition admin login flow (sessionStorage.coalition_admin_token +
// /api/admin/verify) does NOT mint a Supabase auth session, so the row's
// UPDATE policy `EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())`
// fires against `auth.uid() = NULL` from the browser and silently 403s.
//
// Routing through here lets ADMIN_SESSION_TOKEN be the auth gate, with the
// SUPABASE_SERVICE_ROLE_KEY doing the actual write so RLS is bypassed on
// the data side. Mirrors api/complete-order.ts's order-write pattern.
//
// ENV VARS REQUIRED:
//   ADMIN_SESSION_TOKEN       -- bearer token (same secret as /api/admin/verify)
//   SUPABASE_URL              -- database URL (server env)
//   SUPABASE_SERVICE_ROLE_KEY -- service role JWT (server only)
// =============================================================================

export default async function handler(req: any, res: any) {
    // CORS so the Vite-served SPA can post; mirror the rest of /api/.
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const expected = process.env.ADMIN_SESSION_TOKEN || '';
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!expected || !bearer || bearer !== expected) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    const { pieceId, nftTokenId, nfcTagUrl } = req.body || {};
    if (typeof pieceId !== 'string' || !pieceId) {
        res.status(400).json({ error: 'pieceId required' });
        return;
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !supabaseServiceKey) {
        res.status(500).json({ error: 'Supabase server env not configured' });
        return;
    }

    // Build the patch with explicit null-meaning (empty string OR null from
    // the client clears the column, so the PDP falls back to openseaUrl).
    // Only include keys the caller passed in, so a partial update doesn't
    // stomp the other field.
    const patch: Record<string, string | null> = {};
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'nftTokenId')) {
        patch.nft_token_id = nftTokenId == null || nftTokenId === '' ? null : String(nftTokenId);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'nfcTagUrl')) {
        patch.nfc_tag_url = nfcTagUrl == null || nfcTagUrl === '' ? null : String(nfcTagUrl);
    }
    if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
    }

    let supabaseAdmin;
    try {
        supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    } catch (e: any) {
        res.status(500).json({ error: e?.message || 'Failed to init Supabase admin client' });
        return;
    }

    const { error } = await supabaseAdmin
        .from('numbered_pieces')
        .update(patch)
        .eq('id', pieceId);

    if (error) {
        res.status(500).json({ error: error.message });
        return;
    }

    res.status(200).json({ ok: true });
}
