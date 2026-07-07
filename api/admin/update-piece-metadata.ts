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
// 2026-07-07 `withAdminAuth` migration: the inline 5-setHeader CORS block,
// 405 method guard + OPTIONS preflight, and Bearer-token check are now
// handled by the shared `withAdminAuth` wrapper. Auth gate uses the
// 3-token canonical surface (`ADMIN_SESSION_TOKEN` -> `FULL_AI_PASSWORD`
// -> `AI_SESSION_SECRET`) and the wrapper also re-sets the OPTIONS
// preflight + CORS echo so the Vite SPA post still works.
//
// ENV VARS REQUIRED:
//   ADMIN_SESSION_TOKEN       -- bearer token (same secret as /api/admin/verify)
//   SUPABASE_URL              -- database URL (server env)
//   SUPABASE_SERVICE_ROLE_KEY -- service role JWT (server only)
// =============================================================================
// 2026-07-07: `Cache-Control: no-store` was previously a 5th setHeader on the
// inline CORS block. It's preserved inside the wrapped handler below so
// the admin tooling doesn't see stale numbered_pieces rows after a
// successful update.
import { withAdminAuth, parseBody } from '../_helpers';
import type { ApiRequest, ApiResponse } from '../_types';

export default withAdminAuth(async (req: ApiRequest, res: ApiResponse) => {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    // 2026-07-07 wrapper migration: route req.body through `parseBody` (the
    // shared `_helpers` function) so the JSON-string fallback + the strict
    // `Record<string, unknown>` cast + the 400-on-invalid-JSON behavior all
    // come for free instead of being duplicated here. Code-review blocker.
    const body = parseBody(req);
    const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
    const nftTokenId = body.nftTokenId;
    const nfcTagUrl = body.nfcTagUrl;
    if (!pieceId) {
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
    if (Object.prototype.hasOwnProperty.call(body, 'nftTokenId')) {
        patch.nft_token_id = nftTokenId == null || nftTokenId === '' ? null : String(nftTokenId);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'nfcTagUrl')) {
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

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true });
}, { cors: { methods: 'POST,OPTIONS' } });
