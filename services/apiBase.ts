const rawApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();

export const API_BASE_URL = rawApiBase.replace(/\/$/, '');

export function buildApiUrl(path: string) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${API_BASE_URL}${normalizedPath}`;
}

export function buildGitOperationsUrl(
    action: string,
    params: Record<string, string | number | boolean | undefined> = {}
) {
    const searchParams = new URLSearchParams({ action });

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        searchParams.set(key, String(value));
    });

    return `${buildApiUrl('/api/git-operations')}?${searchParams.toString()}`;
}

// ---------------------------------------------------------------------------
// Admin session auth (pinned by tests/gitOperationsGate.test.ts).
//
// /api/admin-verify mints a shared-secret token on login and the browser
// stashes it in sessionStorage. Every admin API call must echo it back as a
// Bearer token: api/_handlers/git-operations.ts (and send-email, admin-products,
// payment-settings, update-piece-metadata) return 401 for anonymous callers.
//
// `coalition_admin_mode` is the separate UI flag ProtectedRoute reads. A 401
// means the stashed token is stale -- usually because the server secret was
// rotated -- so BOTH keys must be cleared, otherwise the operator sits on an
// admin screen whose every action fails invisibly.
// ---------------------------------------------------------------------------
export const ADMIN_TOKEN_STORAGE_KEY = 'coalition_admin_token';
export const ADMIN_MODE_STORAGE_KEY = 'coalition_admin_mode';

/** Headers for an admin API call. Empty object when there is no session. */
export function getAdminAuthHeaders(): Record<string, string> {
    if (typeof sessionStorage === 'undefined') return {};
    const token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Drop a stale admin session so the login gate takes over. */
export function clearAdminSession(): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(ADMIN_MODE_STORAGE_KEY);
}
