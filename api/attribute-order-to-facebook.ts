// /api/attribute-order-to-facebook
// Admin-only: stamp orders.facebook_username onto an existing order row. The
// maintainer supplies the FB handle (the URL starrboii067 resolves to the
// username "starrboii067") and optionally a free-text note that gets appended
// to orders.notes.
//
// Idempotency: re-stamping the same order with the same username is a no-op
// for the actual data; the orders.updated_at bump is fine. If you stamp a
// DIFFERENT username on top of an existing one, the row's facebook_username
// overwrites — this is intentional (a single order can only be attributed to
// one person in the campaign log).

import { createClient } from '@supabase/supabase-js';
import { EXTENDED_CORS_HEADERS, createHttpError, parseBody, withAdminAuth, type HttpError } from './_helpers';
import type {
    ApiRequest,
    ApiResponse,
    AttributeOrderToFacebookBody,
    AttributeOrderToFacebookResponse,
    SupabaseClient,
} from './_types';

// Lazy Supabase admin client. Previously eager `createClient(...)` crashed
// the Lambda at cold start when VITE_SUPABASE_URL was unset (SDK validates
// URL format immediately). Lazy-init matches paypal-order.ts + complete-order.ts
// + create-payment-intent.ts + verify-subscription.ts + place-order-credits.ts
// convention. Callers hit this once and get a 503 from the inner handler.
let cachedAdminClient: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
    if (cachedAdminClient) return cachedAdminClient;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase is not configured on this server.');
    }
    cachedAdminClient = createClient(supabaseUrl, serviceRoleKey);
    return cachedAdminClient;
}

// Strip the protocol + domain so the operator can paste either
// 'facebook.com/starrboii067' or '@starrboii067' or just 'starrboii067' and
// we still write the canonical 'starrboii067' row.
function normalizeFacebookUsername(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';
    let cleaned = trimmed;
    cleaned = cleaned.replace(/^https?:\/\/(www\.)?facebook\.com\//i, '');
    cleaned = cleaned.replace(/^facebook\.com\//i, '');
    cleaned = cleaned.replace(/^@/, '');
    // Drop trailing slashes/paths so 'profile.php?id=...' reduces cleanly if it ever comes up.
    cleaned = cleaned.split('?')[0].replace(/\/$/, '');
    return cleaned;
}

async function attributeOrderToFacebook(req: ApiRequest): Promise<AttributeOrderToFacebookResponse> {
    const rawBody = parseBody(req);
    const body = rawBody as AttributeOrderToFacebookBody;

    const orderId = String(body.orderId || '').trim();
    const rawUsername = String(body.facebookUsername || '').trim();
    const note = body.note ? String(body.note).trim() : '';

    if (!orderId) {
        throw createHttpError(400, 'orderId is required');
    }
    if (!rawUsername) {
        throw createHttpError(400, 'facebookUsername is required');
    }

    const username = normalizeFacebookUsername(rawUsername);
    if (!username) {
        throw createHttpError(400, 'facebookUsername must contain a non-empty handle');
    }
    // Match lowercase letters/digits/dots/underscores — Facebook handle rules.
    if (!/^[a-z0-9._]{1,50}$/i.test(username)) {
        throw createHttpError(400, 'facebookUsername must be a valid Facebook handle (letters, digits, dots, underscores)');
    }

    // 1. Fetch the existing row INCLUDING its current facebook_username so
    //    we can detect no-op re-runs (same handle) and avoid appending
    //    duplicate [fb @<ts>] stamp lines. The orders.updated_at bump is
    //    harmless but the notes audit trail must NOT show duplicate
    //    stamps for the same attribution -- this is the audit-duplication
    //    risk the Batch B code-reviewer flagged (deferred from 8ac4d7b).
    const { data: existing, error: fetchError } = await getSupabaseAdmin()
        .from('orders')
        .select('id, notes, facebook_username')
        .eq('id', orderId)
        .single();

    if (fetchError || !existing) {
        throw createHttpError(404, 'Order not found');
    }

    const existingNotes = String((existing as { notes?: string | null }).notes || '');
    const existingHandle = String(
        (existing as { facebook_username?: string | null }).facebook_username || ''
    );
    // Idempotency guard (Batch B deferred-fix, flag (a)): a re-run with the
    // same handle is a no-op -- return success WITHOUT appending a duplicate
    // [fb @<ts>] stamp line. The header docstring already promises this;
    // this branch enforces the promise. A DIFFERENT handle falls through
    // here and overwrites facebook_username + appends a new stamp (per the
    // docstring's override intent -- a single order can only be attributed
    // to one person in the campaign log).
    if (existingHandle === username) {
        return {
            success: true,
            orderId,
            facebookUsername: username,
        };
    }
    const stampedAt = new Date().toISOString();
    const stampLine = `[fb @${stampedAt}] attributed to @${username}`;
    const mergedNotes = note
        ? `${existingNotes ? existingNotes + '\n' : ''}${stampLine}\n${note}`
        : `${existingNotes ? existingNotes + '\n' : ''}${stampLine}`;

    // 2. Update facebook_username + append to notes. We do NOT bump the row's
    //    paidAt or paymentStatus — attribution is purely metadata.
    const updateResult = await getSupabaseAdmin()
        .from('orders')
        .update({
            facebook_username: username,
            notes: mergedNotes,
        })
        .eq('id', orderId);

    if (updateResult.error) {
        throw createHttpError(500, 'Failed to attribute order to Facebook');
    }

    return {
        success: true,
        orderId,
        facebookUsername: username,
    };
}

export default withAdminAuth(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        res.status(200).json(await attributeOrderToFacebook(req));
    } catch (error: unknown) {
        const httpError = error as HttpError | null;
        const message = (error as { message?: string } | null)?.message;
        const status = Number(httpError?.status || 500);
        console.error('Attribute-order-to-facebook error:', error);
        res.status(status).json({ error: message || 'Attribution failed' });
    }
}, { cors: { methods: 'POST,OPTIONS', allowedHeaders: EXTENDED_CORS_HEADERS } });
