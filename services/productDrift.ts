/**
 * services/productDrift.ts
 *
 * Client for GET /api/product-drift — the read-only report of how the deployed
 * seed (constants/products.ts) and the live `products` table disagree.
 *
 * The panel renders this verbatim: which differences exist, and how many products
 * live only in the seed. WHAT counts as drift is decided server-side by
 * scripts/productSeed.ts, so nothing here re-derives it.
 */

import { buildApiUrl } from './apiBase.js';
import { ADMIN_SESSION_EXPIRED_ERROR, getAdminAuthHeaders, handleAdminAuthFailure } from './adminSession.js';

export interface ProductDriftEntry {
    id: string;
    field: string;
    /** Already summarized by the server (an image array arrives as "[5 items]"). */
    seed: string;
    db: string;
}

export interface ProductDriftReport {
    checkedAt: string;
    seedEntries: number;
    dbRows: number;
    /** Differences on entries the seed also has. Reported, never applied. */
    drift: ProductDriftEntry[];
    /** Seed entries the products table has never held — kept by rule. */
    seedOnly: string[];
    /** Rows the seed has never seen; a sync would append them. */
    missingFromSeed: string[];
}

/** Throws with a readable message so the panel can say the check failed. */
export async function fetchProductDrift(): Promise<ProductDriftReport> {
    // buildApiUrl only prepends the configured base; the path is the caller's
    // (same convention as services/aiChat.ts). Missing the '/api' prefix makes this
    // fetch the SPA instead, which the Vercel rewrite answers with HTML and a 200.
    const response = await fetch(buildApiUrl('/api/product-drift'), {
        headers: { ...getAdminAuthHeaders() },
    });

    if (!response.ok) {
        if (handleAdminAuthFailure(response.status)) {
            throw new Error(ADMIN_SESSION_EXPIRED_ERROR);
        }
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Catalog drift check failed (HTTP ${response.status})`);
    }

    return await response.json();
}
