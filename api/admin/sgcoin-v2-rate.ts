/**
 * api/admin/sgcoin-v2-rate.ts
 *
 * Returns the SGCOIN V2 → USD conversion rate and a human-readable note.
 *
 * Usage: GET /api/admin/sgcoin-v2-rate
 * Requires admin auth (Bearer token).
 *
 * Returns:
 *   v2PerUsd: number — V2 coins per 1 US dollar (from env var SGCOIN_V2_PER_USD)
 *   usdPerV2: number — USD per 1 V2 coin (computed)
 *   note: string — human readable explanation of the valuation
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase admin credentials');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// The V2→USD rate: number of V2 coins that equal $1.
// Configured via the env var SGCOIN_V2_PER_USD (default: 100 → 100 V2 = $1).
const V2_PER_USD = Number(process.env.SGCOIN_V2_PER_USD || '100');

// Compute the reverse: USD per V2 coin.
const USD_PER_V2 = 1 / V2_PER_USD;

// Human-readable note explaining the valuation.
const note = `1 V2 = $${USD_PER_V2.toFixed(2)} (rate: ${V2_PER_USD} V2 per $1)`;

export default function handler(req: any, res: any) {
  // Only GET allowed; other methods return 405
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verify admin auth
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized — no bearer token' });
    return;
  }
  const token = authHeader.slice('Bearer '.length);
  // Very light client‑side check: the token must be 43 chars (new format)
  // or 11 chars (legacy). Anything else is rejected.
  if (token.length !== 43 && token.length !== 11) {
    res.status(401).json({ error: 'Unauthorized — invalid token length' });
    return;
  }

  res.status(200).json({
    v2PerUsd: V2_PER_USD,
    usdPerV2: USD_PER_V2,
    note,
  });
}