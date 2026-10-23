// api/_handlers/sgcoin-v2-rate.ts
//
// GET /api/sgcoin-v2-rate — the SGCOIN V2 → USD rate shown in the admin
// SGCoin Distribution tab.
//
// MOVED HERE, DELIBERATELY. This was api/admin/sgcoin-v2-rate.ts, where "admin
// auth" was `token.length !== 43 && !== 11` — a length check, not a credential
// compare — and the file sat outside api/[...slug].ts, so withRateLimit never
// saw it.
//
// That file also built a Supabase service-role client it never used, and threw
// at module scope when Supabase was unconfigured. The endpoint has no database
// dependency at all, so both are gone: an unconfigured Supabase can no longer
// take down a handler whose only input is an env-var rate.

import { type ApiRequest, type ApiResponse } from '../_types.js';
import { withAdminAuth } from '../_adminAuth.js';

const DEFAULT_V2_PER_USD = 100;

/**
 * V2 coins per 1 USD, from SGCOIN_V2_PER_USD.
 *
 * Read per request, and guarded: `Number('')` is 0, which makes the reciprocal
 * `Infinity`; JSON turns that into `null` and the admin UI calls `.toFixed()`
 * on it. A bad value falls back to the documented default instead of taking
 * the tab down.
 */
function v2PerUsd(): number {
    const configured = Number(process.env.SGCOIN_V2_PER_USD || String(DEFAULT_V2_PER_USD));
    if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_V2_PER_USD;
    return configured;
}

async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const rate = v2PerUsd();
    const usdPerV2 = 1 / rate;

    res.status(200).json({
        v2PerUsd: rate,
        usdPerV2,
        note: `1 V2 = $${usdPerV2.toFixed(2)} (rate: ${rate} V2 per $1)`,
    });
}

export default withAdminAuth(handler);
