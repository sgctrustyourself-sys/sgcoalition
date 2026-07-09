// /api/csp-report
// Stub endpoint for browser Content-Security-Policy violation
// reports. Browsers POST to this URL (declared in vercel.json's
// CSP report-uri) when a page violates the policy -- e.g. an
// inline script that the build injected, a third-party iframe
// that snuck past the allowed-origins list, etc.
//
// Today the handler just logs the report to the server console.
// A future pass will write to a dedicated csp_reports table in
// Supabase and surface a count in the Admin dashboard so the
// operator can see which pages are triggering violations in
// production. For now the contract is: the endpoint must exist
// and return 204 so the browser does not retry-flood the
// 404 case.

import type { ApiRequest, ApiResponse } from '../_types';
// NOTE: CORS is set globally by the catch-all in api/[...slug].ts
// before this handler is invoked, so this handler does NOT call
// setCorsHeaders itself. The catch-all's defaults are correct
// for /api/csp-report.

interface CspReportBody {
    'csp-report'?: {
        'document-uri'?: string;
        'violated-directive'?: string;
        'effective-directive'?: string;
        'original-policy'?: string;
        'blocked-uri'?: string;
        'source-file'?: string;
        'line-number'?: number;
        'column-number'?: number;
        'sample'?: string;
        'disposition'?: string;
    };
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

    let body: CspReportBody = {};
    if (typeof req.body === 'string') {
        try {
            body = JSON.parse(req.body) as CspReportBody;
        } catch {
            body = {};
        }
    } else if (req.body && typeof req.body === 'object') {
        body = req.body as CspReportBody;
    }

    const report = body['csp-report'];
    // 400 on garbage bodies. Deliberate deviation from the CSP
    // reporting spec (which says 2xx) -- a misbehaving client
    // spamming undefined bodies would otherwise flood the
    // server log. Browsers do not retry 4xx, so the report is
    // effectively dropped without a log line. The 30/min rate
    // limit (SLUG_LIMITS_PER_MINUTE in api/_helpers.ts) caps
    // the abuse surface further.
    if (!report || typeof report !== 'object') {
        res.status(400).json({ error: 'Invalid CSP report body.' });
        return;
    }
    // Server-side only. Do NOT echo the violation to the
    // response body; the browser does not need a payload and
    // echoing risks a small XSS surface if the source-file
    // contains a quote.
    // eslint-disable-next-line no-console
    console.warn('[csp-report]', {
        document: report['document-uri'],
        directive: report['violated-directive'] || report['effective-directive'],
        blocked: report['blocked-uri'],
        source: report['source-file'],
        line: report['line-number'],
        col: report['column-number'],
    });

    // 204 No Content: the report is acknowledged; no body needed.
    res.status(204).end();
}
