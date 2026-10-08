// api/_adminAuth.ts
//
// THE SINGLE GATE FOR ADMIN AUTHORIZATION.
//
// History worth keeping: the policy used to exist six times over — four
// isAdminRequest/isAuthorized/getBearerToken copies plus one inline compare —
// and the endpoint with NO copy at all (git-operations.ts) was an
// unauthenticated repo-write primitive for months. Two of the copies also
// implemented a *different* policy without saying so, so reading any one of
// them gave a misleading picture of who counts as an admin.
//
// Now there is exactly one gate, withAdminAuth(), and the only thing a call site
// chooses is WHICH CREDENTIALS count for that surface:
//
//   policy: 'shared'   (default) — the shared secret. Synchronous, no network.
//   policy: 'union'              — the shared secret OR a Supabase admin user.
//   policy: 'supabase'           — a Supabase admin user only.
//
// The policy is stated at each call site, so the surface that differs is visible
// in a diff instead of buried in a local copy. Every gated surface is WRAPPED,
// which is the structural property whose absence caused the git-operations hole:
// a wrapped handler cannot forget its own gate, because the gate runs before any
// handler code.
//
// WHO USES WHICH POLICY, and why the outliers are outliers:
//
//   'shared'    git-operations, marketing-stats, admin-products,
//               payment-settings, update-piece-metadata — the operator tooling.
//   'union'     complete-order's order listing/update. The dashboard login is a
//               Supabase session, so those surfaces must accept one.
//   'supabase'  ai-chat's brain actions. Deliberately narrower than the union —
//               they have never accepted the shared secret, and this module does
//               not widen them.
//
// Mixed handlers (complete-order, payment-settings, ai-chat) carry public
// actions alongside admin ones, so the wrapper is applied to the ADMIN BRANCH
// and the public branch dispatches around it. All-or-nothing surfaces wrap the
// whole handler.
//
// send-email is NOT an admin surface: it has a deliberate anonymous allowance
// (any caller may reach the owner address) and consults isSharedSecretAdmin() to
// decide whether the caller may address anyone else. It is the one place a
// predicate is the right shape.
//
// CREDENTIAL SET: ADMIN_API_TOKEN and ADMIN_PASSPHRASE, from one list below. The
// legacy trio this module used to accept (ADMIN_SESSION_TOKEN / FULL_AI_PASSWORD
// / AI_SESSION_SECRET) is DELETED: none of the three is set in any environment,
// so it was an orphaned credential path kept alive only by its own tests — and
// because FULL_AI_PASSWORD / AI_SESSION_SECRET are ai-chat's AI-access secrets,
// accepting them here also meant that knowing the AI password made you an admin.
// Only the canonical pair is honoured now.

import { createClient } from '@supabase/supabase-js';
import type { ApiRequest, ApiResponse } from './_types.js';
import { setCorsHeaders, type CorsOptions } from './_helpers.js';

/** The one 401 body every admin surface returns. */
export const ADMIN_UNAUTHORIZED_ERROR = 'Admin authorization required.';

// ---------------------------------------------------------------------------
// Credential policy
// ---------------------------------------------------------------------------

/**
 * Every configured shared secret. One list, so a rotation that forgets a name is
 * a one-line change here instead of a six-file hunt.
 */
export function getSharedAdminSecrets(): string[] {
    const keys = ['ADMIN_API_TOKEN', 'ADMIN_PASSPHRASE'] as const;
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
 * Policy 'shared': the caller presented a configured shared secret.
 *
 * Fail-closed — with no secret configured, nobody is an admin.
 */
export function isSharedSecretAdmin(req: ApiRequest): boolean {
    const bearer = extractBearerToken(req);
    if (bearer.length === 0) return false;
    return getSharedAdminSecrets().some((secret) => secret === bearer);
}

/**
 * Policy 'union'/'supabase': the caller presented a Supabase session belonging
 * to an `admin_users` row.
 *
 * The SDK is imported at module top but every failure mode — no config, bad JWT,
 * query error, thrown exception — returns false rather than propagating, because
 * this runs on the auth path.
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

/** The credential sets a surface can accept. Stated at every call site. */
export type AdminPolicy = 'shared' | 'union' | 'supabase';

/**
 * Which policy would admit this caller. THE policy implementation — the wrapper
 * below is a thin gate over it, so there is one place the credential rules live.
 *
 * Exported for the two surfaces that need a CONDITIONAL rather than a gate, and
 * for nothing else:
 *
 *   send-email   — an anonymous caller may still reach the owner address, so it
 *                  asks whether the caller is an operator before allowing any
 *                  other recipient.
 *   ai-chat      — the public chat action enriches its prompt with admin-only
 *                  brain notes when the caller is a Supabase admin. That is an
 *                  enrichment, not access control: the action stays public.
 *
 * Neither of those is a gate. A new admin surface must use withAdminAuth, which
 * is asserted by tests/securityInfrastructureReadiness.test.ts.
 */
export function isAdminPolicy(req: ApiRequest, policy: AdminPolicy = 'shared'): boolean | Promise<boolean> {
    if (policy === 'shared') return isSharedSecretAdmin(req);

    const token = extractBearerToken(req);
    if (policy === 'supabase') return isSupabaseAdminUser(token);
    // 'union' — shared secret first: the operator's own token answers without a
    // network round trip, so the common admin call never waits on Supabase.
    return isSharedSecretAdmin(req) || isSupabaseAdminUser(token);
}

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * Logs the rejection once, here, rather than in each handler — the earlier
 * per-handler warnings were the only reason a blocked call was visible at all,
 * and git-operations' copy logged a caller-controlled action string.
 */
function rejectUnauthenticated(req: ApiRequest, res: ApiResponse): void {
    const path = typeof req?.url === 'string' ? req.url.split('?')[0] : '';
    const safePath = /^[\w\-./]{0,80}$/.test(path) && path ? path : '[non-conforming]';
    console.warn('[admin-auth] rejected unauthenticated request', { path: safePath });
    res.status(401).json({ error: ADMIN_UNAUTHORIZED_ERROR });
}

export interface WithAdminAuthOptions {
    cors?: CorsOptions;
    /** Which credentials this surface accepts. Defaults to the shared secret. */
    policy?: AdminPolicy;
}

/**
 * Wrap a handler so it cannot run without an admin credential:
 *
 *   1. CORS headers (so preflight AND the 401 both echo Origin/Methods/Headers).
 *   2. OPTIONS short-circuit (preflight never carries auth).
 *   3. The policy check for this surface, 401 on failure.
 *   4. Forward to the inner handler.
 *
 * Step 3 happening before step 4 is the structural guarantee that made
 * git-operations safe; a handler written this way cannot forget its own gate.
 * For a mixed handler with public actions, wrap the admin branch and let the
 * public branch dispatch around it — never inline the check.
 */
export function withAdminAuth(
    handler: (req: ApiRequest, res: ApiResponse) => Promise<unknown>,
    options: WithAdminAuthOptions = {},
): (req: ApiRequest, res: ApiResponse) => Promise<void> {
    const policy = options.policy ?? 'shared';
    return async (req, res) => {
        setCorsHeaders(req, res, options.cors);
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }
        if (!(await isAdminPolicy(req, policy))) {
            rejectUnauthenticated(req, res);
            return;
        }

        await handler(req, res);
    };
}
