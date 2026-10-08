// /api/report-error
//
// Receives the checkout client's fire-and-forget error reports
// (pages/Checkout.tsx reportErrorToAdmin: POST { error, context, metadata })
// and forwards them to the operator email through the same alert owner as the
// webhook-reconcile alert — notifyAdminClientError in services/orderIntake.ts.
// Before this handler existed the client POSTed a 404 and every checkout
// failure vanished: an operator only heard about a broken checkout when a
// shopper emailed in.
//
// Public by classification (tests/securityInfrastructureReadiness.test.ts):
// anyone can POST, so the handler trusts nothing — it validates, clips and
// forwards, and the per-slug rate limit in api/_helpers.ts caps the abuse
// surface (each accepted report sends a real email).
//
// 204 on success so a browser never retries; the email is best-effort and
// must not fail the acknowledgment. Never echoes request content back.

import type { ApiRequest, ApiResponse } from '../_types.js';
import { notifyAdminClientError } from '../../services/orderIntake.js';

// CORS is set globally by the catch-all in api/[...slug].ts before this
// handler is invoked (same arrangement as csp-report.ts).

const MAX_FIELD = 500;
const MAX_METADATA_JSON = 2000;

function clip(v: unknown, max: number): string {
    return String(v ?? '').slice(0, max);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    let body: Record<string, unknown> = {};
    if (typeof req.body === 'string') {
        try {
            body = JSON.parse(req.body) as Record<string, unknown>;
        } catch {
            body = {};
        }
    } else if (req.body && typeof req.body === 'object') {
        body = req.body as Record<string, unknown>;
    }

    const error = clip(body.error, MAX_FIELD).trim();
    if (!error) {
        // Garbage bodies are a 400, not a silent drop-with-email — mirrors
        // csp-report.ts's reasoning: browsers do not retry 4xx, so the report
        // is dropped without an email flood.
        res.status(400).json({ error: 'Missing error description.' });
        return;
    }

    // Fire-and-forget: the alert owner swallows its own errors, so this can
    // never reject or change the response. Acknowledge immediately — the
    // client is mid-checkout and this POST must not add latency or failure.
    void notifyAdminClientError({
        error,
        context: clip(body.context, MAX_FIELD).trim() || 'unknown',
        metadata: (body.metadata && typeof body.metadata === 'object'
            ? body.metadata
            : {}) as Record<string, unknown>,
        userAgent: clip(req.headers?.['user-agent'], MAX_FIELD) || undefined,
        path: clip(req.headers?.referer, MAX_FIELD) || undefined,
    });

    // 204 No Content: acknowledged; no body, no browser retry.
    res.status(204).end();
}
