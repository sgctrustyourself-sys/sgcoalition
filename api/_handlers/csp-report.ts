// /api/csp-report
//
// Browser Content-Security-Policy violation reports land here: vercel.json's CSP
// declares `report-uri /api/csp-report`, so a page that violates the policy POSTs
// the violation to this URL.
//
// WHAT CHANGED
//   The handler used to console.warn() every report, which nobody reads — the
//   endpoint was wired up and the data went nowhere. Reports are now inserted
//   into public.csp_reports (supabase/migrations/20261114_create_csp_reports.sql)
//   and /api/admin-csp-reports summarises them for the Admin Command Center.
//
// THE CONTRACT, UNCHANGED
//   204 No Content — the report is acknowledged; no body needed.
//   400 — the body carries no `csp-report` object. A deliberate deviation from
//         the reporting spec's 2xx: browsers do not retry 4xx, so a client
//         spamming undefined bodies is dropped without writing a row. The 30/min
//         budget (SLUG_LIMITS_PER_MINUTE in api/_helpers.ts) caps the rest.
//
// A PERSISTENCE FAILURE IS NOT THE BROWSER'S PROBLEM. The insert is best-effort:
// a database outage or a missing migration logs once and the response stays 204,
// because a retry storm from every open tab is worse than a lost row. This is why
// the admin card reports "table missing — apply the migration" rather than the
// endpoint starting to fail.
//
// NOTE: CORS is set globally by the catch-all in api/[...slug].ts before this
// handler is invoked, so this handler does NOT call setCorsHeaders itself.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ApiRequest, ApiResponse } from '../_types.js';

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

/** Bounds for browser-authored text. Long enough to be useful, short enough that
 *  one hostile tab cannot write megabytes per request. Matches the migration's
 *  TEXT columns, which carry no length themselves. */
const MAX_URI = 2048;
const MAX_DIRECTIVE = 256;
const MAX_SAMPLE = 500;
const MAX_DISPOSITION = 32;

let cachedClient: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient | null {
    if (cachedClient) return cachedClient;

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) return null;

    cachedClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return cachedClient;
}

const asText = (value: unknown, max: number): string =>
    typeof value === 'string' ? value.slice(0, max) : '';

const asInt = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};

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
    if (!report || typeof report !== 'object') {
        res.status(400).json({ error: 'Invalid CSP report body.' });
        return;
    }

    // Server-side only. Do NOT echo the violation to the response body; the
    // browser does not need a payload and echoing risks a small XSS surface if
    // the source-file contains a quote.
    const effective = asText(report['effective-directive'], MAX_DIRECTIVE);
    const violated = asText(report['violated-directive'], MAX_DIRECTIVE) || effective;

    const supabase = getSupabaseAdmin();
    if (!supabase) {
        // No credentials is a configuration state, not a report problem: log once
        // per request so the operator can see the endpoint is not persisting, and
        // still acknowledge the browser.
        console.warn('[csp-report] Supabase admin credentials missing — report not persisted.');
        res.status(204).end();
        return;
    }

    try {
        const { error } = await supabase.from('csp_reports').insert({
            document_uri: asText(report['document-uri'], MAX_URI),
            violated_directive: violated,
            effective_directive: effective || null,
            blocked_uri: asText(report['blocked-uri'], MAX_URI) || null,
            source_file: asText(report['source-file'], MAX_URI) || null,
            line_number: asInt(report['line-number']),
            column_number: asInt(report['column-number']),
            sample: asText(report['sample'], MAX_SAMPLE) || null,
            disposition: asText(report['disposition'], MAX_DISPOSITION) || null,
        });

        if (error) {
            // Includes "relation does not exist": the migration is pending. The
            // admin card surfaces that state; the browser still gets 204.
            console.error('[csp-report] persist failed:', error.message);
        }
    } catch (error) {
        console.error('[csp-report] persist threw:', error instanceof Error ? error.message : String(error));
    }

    // 204 No Content: the report is acknowledged; no body needed.
    res.status(204).end();
}
