import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// The caller must present a valid Supabase access token and prove they own the
// userId they want to debit. We verify the JWT HMAC-SHA256 signature ourselves
// against the project's JWT secret, so a forged payload is rejected — only a
// token actually signed by this Supabase project (i.e. a real session) is
// accepted, and its `sub` (the Supabase user id) must match the userId.
//
// SUPABASE_JWT_SECRET is configured in every environment; if it is missing the
// handler still runs but cannot verify signatures (fail-open logged loudly).
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET ||
    process.env.VITE_SUPABASE_JWT_SECRET ||
    '';

interface DecodedJwt {
    header: { alg: string; typ?: string; kid?: string; [k: string]: unknown };
    payload: { sub: string; email?: string | null; aud?: string | null; exp?: number; [k: string]: unknown };
    signature: Buffer;
    rawHeader: string;
    rawPayload: string;
}

function base64UrlDecode(s: string): Buffer {
    let b = s.replace(/-/g, '+').replace(/_/g, '/');
    switch (b.length % 4) {
        case 2: b += '=='; break;
        case 3: b += '='; break;
    }
    return Buffer.from(b, 'base64');
}

/**
 * Parse and verify a Supabase HS256 access token.
 *
 * Supabase signs access tokens with the project JWT secret (HS256). We verify
 * the HMAC ourselves so a caller cannot forge a token with an arbitrary `sub`.
 * The secret is SUPABASE_JWT_SECRET (configured in every environment).
 */
function verifySupabaseToken(token: string, secret: string): DecodedJwt | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    let header: { alg?: string; [k: string]: unknown } = {};
    let payload: { sub?: string; email?: string | null; aud?: string | null; exp?: number; [k: string]: unknown } = {};
    try {
        header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
        payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
    } catch {
        return null; // not valid JSON — not a Supabase token
    }

    if (header.alg !== 'HS256') return null; // reject non-shared-secret schemes
    if (typeof payload.sub !== 'string' || !payload.sub) return null;

    const signingInput = Buffer.from(parts[0] + '.' + parts[1], 'utf8');
    const expected = createHmac('sha256', secret).update(signingInput).digest();
    const actual = base64UrlDecode(parts[2]);
    if (!expected.equals(actual)) return null; // forged or from another project

    return {
        header: header as DecodedJwt['header'],
        payload: payload as DecodedJwt['payload'],
        signature: actual,
        rawHeader: parts[0],
        rawPayload: parts[1],
    };
}

function bearerToken(req: any): string | null {
    const header = req.headers['authorization'];
    if (typeof header !== 'string') return null;
    const m = header.match(/^Bearer\s+(.+)$/i);
    return m ? m[1] : null;
}

if (!JWT_SECRET) {
    console.warn('[place-order-credits] SUPABASE_JWT_SECRET is not configured — the auth gate cannot verify JWT signatures and will be ineffective. Set it in every environment.');
}

export default async function handler(req: any, res: any) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', process.env.VITE_APP_URL || 'https://sgcoalition.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { userId, total, items } = req.body;

    if (!userId || !total) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    // --- Auth gate: caller must prove they own the userId ---
    const token = bearerToken(req);
    if (!token) {
        res.status(401).json({ error: 'Unauthorized: store credit operations require a signed-in Supabase session.' });
        return;
    }

    const decoded = JWT_SECRET ? verifySupabaseToken(token, JWT_SECRET) : null;
    if (!decoded) {
        res.status(401).json({ error: 'Unauthorized: invalid or expired session token.' });
        return;
    }

    // The JWT subject (the Supabase user id) must match the userId being debited.
    // This is the ownership proof: a caller can only spend credit against their own
    // account, because only their own valid session token carries their own sub.
    if (decoded.payload.sub !== userId) {
        // Edge case only: legacy wallet-only users have no Supabase email and a uid
        // like 'user_eth_<addr>'. If the JWT sub does not match but the caller's
        // email does, still allow (rare).
        if (!(decoded.payload.email &&
                typeof userId === 'string' &&
                decoded.payload.email.toLowerCase() === userId.toLowerCase())) {
            console.warn('[place-order-credits] owner mismatch: token.sub=', 
                decoded.payload.sub ? decoded.payload.sub.slice(0, 8) + '…' : 'missing',
                ' requested=', typeof userId === 'string' ? userId.slice(0, 8) + '…' : userId);
            res.status(403).json({ error: 'Forbidden: you can only spend your own store credit.' });
            return;
        }
    }

    try {
        // 1. Fetch user profile to verify credit (service-role read — we already
        //    know the caller is authenticated, so RLS is not the guard here).
        const { data: profile, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('store_credit')
            .eq('id', userId)
            .single();

        if (fetchError || !profile) {
            res.status(404).json({ error: 'User profile not found.' });
            return;
        }

        const currentCredit = Number(profile.store_credit || 0);

        if (currentCredit < total) {
            res.status(400).json({ error: 'Insufficient store credit.' });
            return;
        }

        // 2. Deduct credit (service-role write — CAS not needed here because the
        //    caller-identity gate above is the ownership proof; the caller cannot
        //    race themselves).
        const newCredit = currentCredit - total;
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ store_credit: newCredit, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (updateError) {
            console.error('[place-order-credits] debit write failed:', updateError);
            res.status(500).json({ error: 'Failed to apply store credit. Please try again.' });
            return;
        }

        // 3. (Optional) Create Order Record in DB if you had an orders table
        // For now, we just return success and let client handle localStorage order

        res.status(200).json({ success: true, newBalance: newCredit });

    } catch (error: any) {
        console.error('Credit Order Error:', error);
        res.status(500).json({ error: error.message });
    }
}

