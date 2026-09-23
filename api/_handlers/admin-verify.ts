// Admin login endpoint — the LOGIN side of the admin gate. Accepts EITHER a
// password OR a MetaMask signature over the wallet login message (owned by
// utils/adminWallets.ts) via POST and, on success, returns the shared secret
// the browser stores in sessionStorage and echoes as `Authorization: Bearer
// <token>`.
//
// This endpoint cannot itself be gated — it is how a caller obtains a credential
// — so it sits outside withAdminAuth by necessity. What it must not do is keep
// its own idea of the credential set: api/_adminAuth.ts owns that, and this
// handler asks it. Its inline CORS block was a second copy of setCorsHeaders and
// its inline JSON.parse a second copy of parseBody; both are gone.

import type { ApiRequest, ApiResponse } from '../_types.js';
import { getSharedAdminSecrets } from '../_adminAuth.js';
import { LOCAL_DEV_ORIGINS, parseBody, setCorsHeaders } from '../_helpers.js';
import { verifyMessage } from 'ethers';
import { isAdminWallet, isFreshLoginMessage, parseAdminWalletLoginMessage } from '../../utils/adminWallets.js';

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    setCorsHeaders(req, res, { originWhitelist: LOCAL_DEV_ORIGINS });

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    let body: Record<string, unknown>;
    try {
        body = parseBody(req);
    } catch {
        res.status(400).json({ error: 'Invalid JSON request body.' });
        return;
    }

    // Two login methods reach the same bearer: { password } (the shared-secret
    // passphrase) or { message, signature } (a wallet signature over the login
    // message owned by utils/adminWallets.ts).
    const password = String(body.password || '').trim();
    const message = String(body.message || '').trim();
    const signature = String(body.signature || '').trim();
    if (!password && !(message && signature)) {
        res.status(400).json({ error: 'Password or wallet signature is required.' });
        return;
    }

    // The credential set comes from its single owner, canonical entry first.
    const secrets = getSharedAdminSecrets();
    if (secrets.length === 0) {
        console.error('[admin-verify] No admin credential is configured. Admin login will always fail.');
        res.status(503).json({ error: 'Admin authentication is not configured on this server.' });
        return;
    }

    if (message && signature) {
        // ---- Wallet login ----
        // Proof of control of a founder key is the credential: recover the
        // signer from the login message, require it to match the address the
        // message claims, have signed recently, and be on the shared allowlist
        // (utils/adminWallets.ts). This is what makes an "admin wallet" mean
        // anything on the SERVER — the client-side ADMIN_WALLETS match only
        // ever gated UI state.
        const parsed = parseAdminWalletLoginMessage(message);
        if (!parsed) {
            res.status(400).json({ error: 'Malformed wallet login message.' });
            return;
        }
        let recovered = '';
        try {
            recovered = verifyMessage(message, signature);
        } catch {
            res.status(401).json({ error: 'Invalid wallet signature.' });
            return;
        }
        if (recovered.toLowerCase() !== parsed.address) {
            res.status(401).json({ error: 'Signature does not match the login message address.' });
            return;
        }
        if (!isFreshLoginMessage(parsed.issuedAt)) {
            console.warn('[admin-verify] Rejected stale wallet login message.');
            res.status(401).json({ error: 'Wallet login message expired.' });
            return;
        }
        if (!isAdminWallet(recovered)) {
            console.warn('[admin-verify] Rejected wallet login from non-admin address.');
            res.status(401).json({ error: 'Wallet is not authorized for admin access.' });
            return;
        }
        console.log('[admin-verify] Admin wallet login successful.');
        res.status(200).json({ token: secrets[0], success: true });
        return;
    }

    if (!secrets.some((secret) => secret === password)) {
        console.warn('[admin-verify] Failed admin login attempt.');
        res.status(401).json({ error: 'Invalid admin passphrase.' });
        return;
    }

    // Return the canonical secret (ADMIN_API_TOKEN when set, else
    // ADMIN_PASSPHRASE) rather than whichever the operator typed, so subsequent
    // admin calls echo the same bearer the gate prefers.
    const token = secrets[0];
    console.log('[admin-verify] Admin login successful.');
    res.status(200).json({ token, success: true });
}
