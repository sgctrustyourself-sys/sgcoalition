// /api/admin-csp-reports
//
// Admin-only GET: recent Content-Security-Policy violations, summarised for the
// Command Center card. Reads public.csp_reports with the service-role client.
//
// WHY THIS IS AN API ROUTE AND NOT A CLIENT QUERY
//   csp_reports has RLS enabled with no policies at all: it is written by
//   /api/csp-report and read only by operators. The admin session here is the
//   shared secret minted by /api/admin-verify, not a Supabase user, so a client
//   query would return zero rows and look like "no violations". Same reason
//   admin-point-claims and admin-sgcoin-grants exist.
//
// RESPONSE
//   200 { available: true, generatedAt, windows: { last24h, last7d, last30d },
//         topDirectives: [{ directive, count }], recent: [...] }
//   200 { available: false, reason } — table missing (migration not applied).
//       Deliberately 200: the dashboard card renders the instruction instead of
//       the whole panel failing, and the condition is a deploy step, not a bug.
//   503 — Supabase admin credentials missing.
//
// The counts are PostgREST `head` queries (count only, no rows), so the 24h/7d/
// 30d numbers stay cheap as the table grows. The directive tally reads at most
// the most recent 5,000 rows in 24h; a site generating more than that has a
// bigger problem than a truncated chart.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { withAdminAuth } from '../_adminAuth.js';
import type { ApiRequest, ApiResponse } from '../_types.js';

const RECENT_LIMIT = 20;
const TOP_WINDOW_ROWS = 5000;
const TOP_LIMIT = 5;

const WINDOWS = [
    ['last24h', 24],
    ['last7d', 24 * 7],
    ['last30d', 24 * 30],
] as const;

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

const since = (hours: number): string => new Date(Date.now() - hours * 3_600_000).toISOString();

/** PostgREST reports a missing table as a schema-cache miss or a 42P01 message. */
const isMissingTable = (message: string): boolean =>
    /does not exist|schema cache|42P01/i.test(message);

interface RecentRow {
    created_at: string;
    document_uri: string | null;
    violated_directive: string | null;
    effective_directive: string | null;
    blocked_uri: string | null;
    source_file: string | null;
    line_number: number | null;
    column_number: number | null;
}

export default withAdminAuth(async (req: ApiRequest, res: ApiResponse): Promise<void> => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
        res.status(503).json({ error: 'Supabase admin credentials not configured.' });
        return;
    }

    try {
        const counts = await Promise.all(
            WINDOWS.map(([, hours]) =>
                admin
                    .from('csp_reports')
                    .select('id', { count: 'exact', head: true })
                    .gte('created_at', since(hours)),
            ),
        );

        const countError = counts.find((result) => result.error)?.error;
        if (countError) {
            if (isMissingTable(countError.message)) {
                res.status(200).json({
                    available: false,
                    reason:
                        'public.csp_reports is missing — apply '
                        + 'supabase/migrations/20261114_create_csp_reports.sql, then reload.',
                });
                return;
            }
            throw new Error(countError.message);
        }

        const [topRows, recent] = await Promise.all([
            admin
                .from('csp_reports')
                .select('violated_directive')
                .gte('created_at', since(24))
                .limit(TOP_WINDOW_ROWS),
            admin
                .from('csp_reports')
                .select(
                    'created_at, document_uri, violated_directive, effective_directive, '
                    + 'blocked_uri, source_file, line_number, column_number',
                )
                .order('created_at', { ascending: false })
                .limit(RECENT_LIMIT),
        ]);

        if (topRows.error) throw new Error(topRows.error.message);
        if (recent.error) throw new Error(recent.error.message);

        const tally = new Map<string, number>();
        for (const row of (topRows.data || []) as Array<{ violated_directive: string | null }>) {
            const directive = (row.violated_directive || '').trim() || '(unknown)';
            tally.set(directive, (tally.get(directive) || 0) + 1);
        }
        const topDirectives = [...tally.entries()]
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, TOP_LIMIT)
            .map(([directive, count]) => ({ directive, count }));

        const [last24h, last7d, last30d] = counts.map((result) => result.count ?? 0);

        res.status(200).json({
            available: true,
            generatedAt: new Date().toISOString(),
            windows: { last24h, last7d, last30d },
            topDirectives,
            recent: ((recent.data || []) as unknown as RecentRow[]).map((row) => ({
                createdAt: row.created_at,
                documentUri: row.document_uri || '',
                directive: row.violated_directive || row.effective_directive || '(unknown)',
                blockedUri: row.blocked_uri,
                sourceFile: row.source_file,
                lineNumber: row.line_number,
                columnNumber: row.column_number,
            })),
        });
    } catch (error) {
        console.error('[admin-csp-reports]', error instanceof Error ? error.message : String(error));
        res.status(500).json({ error: 'Failed to load CSP reports.' });
    }
});
