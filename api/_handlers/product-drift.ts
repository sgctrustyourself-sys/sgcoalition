// api/_handlers/product-drift.ts
//
// Read-only report: how the deployed seed (constants/products.ts) and the live
// `products` table disagree. This is the same drift `npx tsx scripts/syncProducts.ts`
// prints, surfaced on the admin Products tab so an operator does not have to know a
// CLI exists to find out their fallback catalog and their live catalog have parted
// ways.
//
// It is NOT a second opinion about what drift is: scripts/productSeed.ts owns the
// rule, this handler calls it in preserve mode (no targeted ids) — the mode that
// reports differences instead of applying them — and returns whatever it says. A
// new "is this drift?" definition here would be the bug, not the fix.
//
// Why an endpoint rather than a diff in the browser: the seed is a repo module and
// the products table is service-role readable, so both inputs already live on the
// server. The panel renders what the owner reports and never needs to know what the
// fallback file contains.
//
// GET /api/product-drift — admin only (shared secret, like the rest of the operator
// tooling). Never writes anything; see tests/productDrift.test.ts for the guard that
// keeps it that way.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type ApiRequest, type ApiResponse } from '../_types.js';
import { createHttpError } from '../_helpers.js';
import { withAdminAuth } from '../_adminAuth.js';
import { INITIAL_PRODUCTS } from '../../constants/products.js';
import {
    mergeSeedProducts,
    summarizeValue,
    type ProductRow,
} from '../../scripts/productSeed.js';

/** One summarized difference, ready to render: values arrive pre-truncated. */
export interface ProductDriftEntry {
    id: string;
    field: string;
    seed: string;
    db: string;
}

export interface ProductDriftReport {
    checkedAt: string;
    /** Entries in the deployed seed. */
    seedEntries: number;
    /** Rows in the products table. */
    dbRows: number;
    /** Differences on entries the seed also has — reported, never applied. */
    drift: ProductDriftEntry[];
    /** Seed entries the table has never held. Kept by rule, so this is not a fault. */
    seedOnly: string[];
    /** Rows the seed has never seen. A sync would append these. */
    missingFromSeed: string[];
}

function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
        throw createHttpError(503, 'Supabase admin service is not configured.');
    }
    return createClient(supabaseUrl, serviceRoleKey);
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const supabase = getSupabaseAdmin();
        // Same order the sync reads in, so "appended in DB order" means the same
        // thing on screen as it would in the commit.
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw createHttpError(500, error.message || 'Product lookup failed.');

        const rows = (data || []) as ProductRow[];
        // Preserve mode: nothing targeted, so every difference is reported and no
        // row is rewritten. This is the same call the CLI makes with no --only.
        const { report } = mergeSeedProducts(INITIAL_PRODUCTS, rows, []);

        const body: ProductDriftReport = {
            checkedAt: new Date().toISOString(),
            seedEntries: INITIAL_PRODUCTS.length,
            dbRows: rows.length,
            drift: report.drift.map((difference) => ({
                id: difference.id,
                field: difference.field,
                // Summarized by the module that owns the wording, so a whole image
                // array never arrives twice in a UI line.
                seed: summarizeValue(difference.seed),
                db: summarizeValue(difference.db),
            })),
            seedOnly: report.seedOnly,
            missingFromSeed: report.added,
        };

        res.status(200).json(body);
    } catch (error: unknown) {
        const httpError = error as { status?: number; message?: string };
        const status = Number(httpError?.status || 500);
        console.error('[product-drift]', httpError?.message || error);
        res.status(status).json({ error: httpError?.message || 'Catalog drift check failed.' });
    }
}

export default withAdminAuth(handler);
