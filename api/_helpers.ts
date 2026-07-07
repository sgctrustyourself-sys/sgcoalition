// Shared helpers for /api/_handlers/* — extracted during a post-typed-migration
// refactor so every handler reads from one place. 14 handler modules used to
// carry their own copies of these; behavior parity is preserved through the
// CorsOptions field bag and the LOCAL_DEV_ORIGINS / EXTENDED_CORS_HEADERS
// constants below.

import type { ApiRequest, ApiResponse } from './_types';

export interface HttpError extends Error {
    status?: number;
}

export function createHttpError(status: number, message: string): HttpError {
    const error = new Error(message) as HttpError;
    error.status = status;
    return error;
}

export function parseBody(req: ApiRequest): Record<string, unknown> {
    if (!req.body) return {};
    if (typeof req.body === 'string') {
        try {
            const parsed: unknown = JSON.parse(req.body);
            return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
        } catch {
            throw createHttpError(400, 'Invalid JSON request body.');
        }
    }
    return typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};
}

// Admin auth gate. Wraps a mutating handler so only callers presenting a
// matching admin Bearer token can reach the inner body. Mirrors the
// prior-inline admin pattern from marketing-send.ts + marketing-stats.ts
// + api/admin/update-piece-metadata.ts so the env contract is the same
// across the surface area: ADMIN_SESSION_TOKEN (primary canonical) with
// FULL_AI_PASSWORD and AI_SESSION_SECRET run in parallel -- they're
// actively in use by the marketing-* endpoints (which use the same env
// contract in their inline bearer checks), so a future operator rotating
// only ADMIN_SESSION_TOKEN would quietly break the marketing gates
// while the wrapped handlers here still pass. Rotate all three on a
// coordinated cadence, OR migrate the marketing-* handlers to the
// wrapper first. If no admin env is set the gate returns 401 --
// fail-closed is the right default for a write surface.
//
// Usage:
//   export default withAdminAuth(async (req, res) => {
//     try { res.status(200).json(await innerLogic(req)); }
//     catch (err: any) { ... }
//   }, { cors: { methods: 'POST,OPTIONS', allowedHeaders: EXTENDED_CORS_HEADERS } });
//
// Order of operations inside the returned wrapper:
//   1. CORS headers (so the preflight + 401 response both echo Origin/Methods/Headers).
//   2. OPTIONS short-circuit (preflight never carries auth).
//   3. Admin Bearer check (returns 401 on mismatch, missing header, or empty env).
//   4. Forward to the inner handler.
export interface WithAdminAuthOptions {
    cors?: CorsOptions;
}

export function withAdminAuth(
    handler: (req: ApiRequest, res: ApiResponse) => Promise<unknown>,
    options: WithAdminAuthOptions = {}
): (req: ApiRequest, res: ApiResponse) => Promise<void> {
    return async (req, res) => {
        setCorsHeaders(req, res, options.cors);
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        const expected = process.env.ADMIN_SESSION_TOKEN
            || process.env.FULL_AI_PASSWORD
            || process.env.AI_SESSION_SECRET
            || '';
        const headerRaw = req.headers?.authorization ?? req.headers?.Authorization;
        const authHeader = typeof headerRaw === 'string' ? headerRaw : '';
        const bearer = authHeader.toLowerCase().startsWith('bearer ')
            ? authHeader.slice(7).trim()
            : authHeader.trim();
        if (!expected || !bearer || bearer !== expected) {
            res.status(401).json({ error: 'Admin authorization required.' });
            return;
        }

        await handler(req, res);
    };
}

export interface CorsOptions {
    /**
     * When set and non-empty, the request's `Origin` header is echoed back
     * verbatim only when it appears in this list. Otherwise we fall back to
     * the configured single origin. Use this for handlers that need to serve
     * Vite dev (3000/3001 + 127.0.0.1) on top of the production host.
     */
    originWhitelist?: readonly string[];
    methods?: string;
    allowedHeaders?: string;
}

const DEFAULT_PUBLIC_ORIGIN = 'https://sgcoalition.xyz';

export const LOCAL_DEV_ORIGINS: readonly string[] = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
];

export const EXTENDED_CORS_HEADERS =
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version';

const DEFAULT_METHODS = 'GET,OPTIONS,PATCH,POST';
const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization';

export function setCorsHeaders(req: ApiRequest, res: ApiResponse, options: CorsOptions = {}): void {
    const configuredOrigin = process.env.VITE_APP_URL || DEFAULT_PUBLIC_ORIGIN;
    let responseOrigin = configuredOrigin;

    if (options.originWhitelist && options.originWhitelist.length > 0) {
        const headerOrigin = req.headers?.origin;
        const requestOrigin = typeof headerOrigin === 'string' ? headerOrigin : undefined;
        if (requestOrigin && options.originWhitelist.includes(requestOrigin)) {
            responseOrigin = requestOrigin;
        }
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Access-Control-Allow-Methods', options.methods || DEFAULT_METHODS);
    res.setHeader('Access-Control-Allow-Headers', options.allowedHeaders || DEFAULT_ALLOWED_HEADERS);
}

export function resolvePublicOrigin(req: ApiRequest): string {
    let origin = process.env.VITE_APP_URL?.trim();

    if (!origin && process.env.VERCEL_URL) {
        origin = `https://${process.env.VERCEL_URL}`;
    }

    if (!origin) {
        const host = req.headers?.host;
        if (host) {
            const protocolRaw = req.headers?.['x-forwarded-proto'];
            const protocol = typeof protocolRaw === 'string' && protocolRaw ? protocolRaw : 'http';
            origin = `${protocol}://${host}`;
        }
    }

    if (!origin) {
        origin = DEFAULT_PUBLIC_ORIGIN;
    }

    origin = origin.replace(/\/$/, '');
    if (!origin.startsWith('http://') && !origin.startsWith('https://')) {
        origin = `https://${origin}`;
    }
    return origin;
}
