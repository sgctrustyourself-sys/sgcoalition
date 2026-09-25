// services/adminSession.ts
//
// THE SINGLE OWNER OF THE ADMIN SESSION.
//
// The admin session is a bare shared secret: /api/admin-verify mints
// ADMIN_API_TOKEN on login and the browser stashes it in sessionStorage, where
// every admin API call echoes it as `Authorization: Bearer <token>`.
//
// WHY THIS MODULE EXISTS: the key was read in six places with three different
// guard styles (try/catch, typeof check, no guard at all), the "expired
// session" policy was copy-pasted three times, and ownership of the sibling
// `coalition_admin_mode` flag was split between a service and useAuth's
// updateAdminMode — so renaming either key in the login flow would silently
// disconnect the readers. Now: useAuth writes, this module names the keys and
// exposes the accessors, and callers ask about a session instead of touching
// storage.
//
// A 401 means the stashed token is stale — usually a server-side rotation — so
// BOTH keys clear together. Clearing only the token leaves the operator on an
// admin screen whose every action fails.

/** sessionStorage key holding the bearer token minted by /api/admin-verify. */
export const ADMIN_TOKEN_KEY = 'coalition_admin_token';

/** sessionStorage key holding the "admin UI is unlocked" flag ProtectedRoute reads. */
export const ADMIN_MODE_KEY = 'coalition_admin_mode';

/** One message for every expired-session surface. */
export const ADMIN_SESSION_EXPIRED_ERROR = 'Admin session expired — sign in again.';

function storage(): Storage | null {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}

/** The stashed admin token, or null when there is no admin session. */
export function getAdminToken(): string | null {
    return storage()?.getItem(ADMIN_TOKEN_KEY) ?? null;
}

/** Authorization header for an admin call. Empty object when there is no session. */
export function getAdminAuthHeaders(): Record<string, string> {
    const token = getAdminToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Drop a stale admin session so the login gate takes over. */
export function clearAdminSession(): void {
    const store = storage();
    if (!store) return;
    store.removeItem(ADMIN_TOKEN_KEY);
    store.removeItem(ADMIN_MODE_KEY);
}

/**
 * The one place that decides what a 401 MEANS. Returns true (after clearing the
 * session) when the response was an auth failure, so a call site can stop and
 * report; false means "some other error, handle it normally".
 *
 * React state is deliberately NOT touched here — a component that needs to drop
 * admin mode calls its own logoutAdmin() after this returns true. Keeping the
 * storage policy out of React is what makes this reusable from plain services.
 */
export function handleAdminAuthFailure(status: number): boolean {
    if (status !== 401) return false;
    clearAdminSession();
    return true;
}
