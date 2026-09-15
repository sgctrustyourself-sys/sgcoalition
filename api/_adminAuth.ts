// api/_adminAuth.ts
//
// THE SINGLE OWNER OF ADMIN AUTHORIZATION.
//
// Before this module existed the policy existed six times over: four
// `isAdminRequest`/`isAuthorized`/`getBearerToken` copies across
// complete-order.ts, ai-chat.ts, admin-products.ts, payment-settings.ts and
// update-piece-metadata.ts, plus one inline compare — and the endpoint with NO
// copy at all (git-operations.ts) was an unauthenticated repo-write primitive
// for months. Two of the copies also implemented a *different* policy without
// saying so (see POLICY below), so reading any one of them gave a misleading
// picture of who counts as an admin.
//
// POLICY — two independent ways to be an admin, and that is deliberate:
//
//   1. SHARED SECRET (sync). The operator's browser gets ADMIN_API_TOKEN from
//      /api/admin-verify on login and echoes it as a Bearer token.
//      ADMIN_PASSPHRASE is accepted too because admin-verify accepts either as
//      a login credential, which keeps passphrase-only deployments working.
//      The legacy trio (ADMIN_SESSION_TOKEN / FULL_AI_PASSWORD /
//      AI_SESSION_SECRET) is honoured for deployments that predate the
//      canonical pair and are still set somewhere.
//
//   2. SUPABASE ADMIN USER (async). A real Supabase session JWT belonging to a
//      row in `admin_users`. This is the only policy ai-chat.ts had, and one of
//      the two complete-order.ts had; it exists so a Supabase-authenticated
//      admin (the dashboard login) can act without the shared secret.
//
// WHO USES WHICH:
//
//   withAdminAuth(...)        all-or-nothing surfaces: git-operations,
//                             marketing-stats. Structurally guarantees the gate
//                             runs before any handler code — the property whose
//                             absence caused the git-operations hole.
//   requireAdmin(req, res)    all-or-nothing, but the handler needs its own
//                             CORS/method shape: admin-products,
//                             payment-settings, update-piece-metadata.
//   isSharedSecretAdmin(req)  partial allowance: send-email (anonymous callers
//                             may still reach the owner address).
//   isAdminRequest(req)       the full union, for surfaces where a
//                             Supabase-authenticated admin must also pass:
//                             complete-order order listing/update.
//   isSupabaseAdminRequest()  Supabase-session-only surfaces: ai-chat brain
//                             tools, which never accepted the shared secret and
//                             still do not (no widening here).
//
// DELIBERATE, DISCLOSED DELTA from the copies this replaced: handlers that
// compared against ADMIN_API_TOKEN only (admin-products, payment-settings,
// update-piece-metadata, complete-order) now also accept ADMIN_PASSPHRASE and
// the legacy trio. Nothing new becomes reachable for an anonymous caller; the
// set of admin credentials simply stops being defined in six places. In
// production the set resolves to exactly {ADMIN_API_TOKEN, ADMIN_PASSPHRASE}.

import { createClient } from '@supabase/supabase-js';
import type { ApiRequest, ApiResponse } from './_types.js';
import { setCorsHeaders, type CorsOptions } from './_helpers.js';

/** The one 401 body every admin surface returns. */
export const ADMIN_UNAUTHORIZED_ERROR = 'Admin authorization required.';

// ---------------------------------------------------------------------------
// Credential policy
// ---------------------------------------------------------------------------

/** Legacy shared secrets, kept for deployments that predate the canonical pair. */
const LEGACY_ADMIN_SECRET_KEYS = ['ADMIN_SESSION_TOKEN', 'FULL_AI_PASSWORD', 'AI_SESSION_SECRET'] as const;

/**
 * Every configured shared secret, canonical first. One list, so a rotation that
 * forgets one name is a one-line change here instead of a six-file hunt.
 */
export function getSharedAdminSecrets(): string[] {
    const keys = ['ADMIN_API_TOKEN', 'ADMIN_PASSPHRASE', ...LEGACY_ADMIN_SECRET_KEYS];
    return keys.map((key) => (process.env[key] || '').trim()).filter((secret) => secret.length > 0);
}

const BEARER_RE = /^Bearer\s+(.+)$/i;

/** The bearer value from either header casing; '' when absent or non-Bearer. */
export function extractBearerToken(req: ApiRequest): string {
    const headerRaw = req?.headers?.authorization ?? req?.headers?.Authorization;
    const header = typeof headerRaw === 'string' ? headerRaw : '';
    const match = header.match(BEARER_RE);
    return (match?.[1] || '').trim();
}

/**
 * Policy 1: the caller presented a configured shared secret.
 *
 * Fail-closed — with no secret configured, nobody is an admin.
 */
export function isSharedSecretAdmin(req: ApiRequest): boolean {
    const bearer = extractBearerToken(req);
    if (bearer.length === 0) return false;
    return getSharedAdminSecrets().some((secret) => secret === bearer);
}

/**
 * Policy 2: the caller presented a Supabase session belonging to an
 * `admin_users` row.
 *
 * The SDK is imported lazily so handlers that only use the shared-secret path
 * (send-email, git-operations, the admin tooling) never pay for it. Every
 * failure mode — no config, bad JWT, query error, thrown exception — returns
 * false rather than propagating, because this runs on the auth path.
 */
export async function isSupabaseAdminUser(token: string): Promise<boolean> {
    if (!token) return false;
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !anonKey || !serviceKey) return false;

    try {
        const authClient = createClient(url, anonKey);
        const adminClient = createClient(url, serviceKey);
        const { data: userData, error: userError } = await authClient.auth.getUser(token);
        const userId = userData?.user?.id;
        if (userError || !userId) return false;
        const { data, error } = await adminClient
            .from('admin_users')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();
        return !error && Boolean(data);
    } catch {
        return false;
    }
}

/** Policy 2, request-shaped, for surfaces that never accepted shared secrets. */
export async function isSupabaseAdminRequest(req: ApiRequest): Promise<boolean> {
    return isSupabaseAdminUser(extractBearerToken(req));
}

/** The full union: a shared secret OR a Supabase admin user. */
export async function isAdminRequest(req: ApiRequest): Promise<boolean> {
    if (isSharedSecretAdmin(req)) return true;
    return isSupabaseAdminUser(extractBearerToken(req));
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

/**
 * All-or-nothing gate for handlers that manage their own CORS/method shape.
 * Writes the 401 itself and returns false, so callers read:
 *
 *     if (!requireAdmin(req, res)) return;
 *
 * Logs the rejection once, here, rather than in each handler — the earlier
 * per-handler warnings were the only reason a blocked call was visible at all,
 * and git-operations' copy logged a caller-controlled action string.
 */
export function requireAdmin(req: ApiRequest, res: ApiResponse): boolean {
    if (isSharedSecretAdmin(req)) return true;

    const path = typeof req?.url === 'string' ? req.url.split('?')[0] : '';
    const safePath = /^[\w\-./]{0,80}$/.test(path) && path ? path : '[non-conforming]';
    console.warn('[admin-auth] rejected unauthenticated request', { path: safePath });
    res.status(401).json({ error: ADMIN_UNAUTHORIZED_ERROR });
    return false;
}

export interface WithAdminAuthOptions {
    cors?: CorsOptions;
}

/**
 * Wrap a whole handler so it cannot run without an admin credential:
 *
 *   1. CORS headers (so preflight AND the 401 both echo Origin/Methods/Headers).
 *   2. OPTIONS short-circuit (preflight never carries auth).
 *   3. Shared-secret check, 401 on failure.
 *   4. Forward to the inner handler.
 *
 * Step 3 happening before step 4 is the structural guarantee that made
 * git-operations safe; a handler written this way cannot forget its own gate.
 */
export function withAdminAuth(
    handler: (req: ApiRequest, res: ApiResponse) => Promise<unknown>,
    options: WithAdminAuthOptions = {},
): (req: ApiRequest, res: ApiResponse) => Promise<void> {
    return async (req, res) => {
        setCorsHeaders(req, res, options.cors);
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }
        if (!requireAdmin(req, res)) return;

        await handler(req, res);
    };
}
