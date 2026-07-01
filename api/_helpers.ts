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
