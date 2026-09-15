// Admin passphrase verification endpoint — the LOGIN side of the admin gate.
// Accepts a password via POST and, on success, returns the shared secret the
// browser stores in sessionStorage and echoes as `Authorization: Bearer <token>`.
//
// This endpoint cannot itself be gated — it is how a caller obtains a credential
// — so it sits outside withAdminAuth by necessity. What it must not do is keep
// its own idea of the credential set: api/_adminAuth.ts owns that, and this
// handler asks it. Its inline CORS block was a second copy of setCorsHeaders and
// its inline JSON.parse a second copy of parseBody; both are gone.

import type { ApiRequest, ApiResponse } from '../_types.js';
import { getSharedAdminSecrets } from '../_adminAuth.js';
import { LOCAL_DEV_ORIGINS, parseBody, setCorsHeaders } from '../_helpers.js';

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

    const password = String(body.password || '').trim();
    if (!password) {
        res.status(400).json({ error: 'Password is required.' });
        return;
    }

    // The credential set comes from its single owner, canonical entry first.
    const secrets = getSharedAdminSecrets();
    if (secrets.length === 0) {
        console.error('[admin-verify] No admin credential is configured. Admin login will always fail.');
        res.status(503).json({ error: 'Admin authentication is not configured on this server.' });
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
