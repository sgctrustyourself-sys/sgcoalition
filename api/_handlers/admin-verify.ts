// Admin passphrase verification endpoint.
// Accepts a password via POST, compares it against ADMIN_API_TOKEN (the same
// static token that isAdminRequest in complete-order.ts already accepts), and
// returns the token on success so the frontend can store it in sessionStorage
// and use it for subsequent admin API calls.
//
// Environment variable: ADMIN_API_TOKEN — shared secret for all admin API auth.
// If ADMIN_PASSPHRASE is also set, the handler checks both (PASSPHRASE wins).
// This lets the operator have one value at the login prompt and a different
// value for the Authorization header, though in practice setting both to the
// same value is the standard setup.

export default async function handler(req: any, res: any) {
    // CORS
    const configuredOrigin = process.env.VITE_APP_URL || 'https://sgcoalition.xyz';
    const allowedOrigins = new Set([
        configuredOrigin,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
    ]);
    const requestOrigin = req.headers?.origin;
    const responseOrigin = requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : configuredOrigin;

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', responseOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // Parse the password from the request body
    let body: any;
    try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch {
        res.status(400).json({ error: 'Invalid JSON request body.' });
        return;
    }

    const password = String(body.password || '').trim();
    if (!password) {
        res.status(400).json({ error: 'Password is required.' });
        return;
    }

    // The password is compared against ADMIN_PASSPHRASE (the human-readable
    // login passphrase). On success, the handler returns ADMIN_API_TOKEN
    // (the shared secret used in Authorization headers) so the frontend can
    // store it and use it for subsequent admin API calls like order listing.
    // In production, set both env vars to the same value for simplicity.
    const adminPassphrase = (process.env.ADMIN_PASSPHRASE || '').trim();
    const adminApiToken = (process.env.ADMIN_API_TOKEN || '').trim();

    if (!adminPassphrase && !adminApiToken) {
        console.error('[admin-verify] Neither ADMIN_PASSPHRASE nor ADMIN_API_TOKEN is set. Admin login will always fail.');
        res.status(503).json({ error: 'Admin authentication is not configured on this server.' });
        return;
    }

    // Accept the passphrase or the API token as valid credentials
    const isValid = password === adminPassphrase || password === adminApiToken;
    if (!isValid) {
        console.warn('[admin-verify] Failed admin login attempt.');
        res.status(401).json({ error: 'Invalid admin passphrase.' });
        return;
    }

    // Return ADMIN_API_TOKEN so subsequent backend API calls (e.g. order
    // listing via complete-order.ts which checks `token === ADMIN_API_TOKEN`)
    // work correctly. If only ADMIN_PASSPHRASE was set, return that as the
    // token (the operator should set ADMIN_API_TOKEN to the same value in
    // production Vercel env vars for full backend auth coverage).
    const token = adminApiToken || adminPassphrase;
    console.log('[admin-verify] Admin login successful.');
    res.status(200).json({ token, success: true });
}
