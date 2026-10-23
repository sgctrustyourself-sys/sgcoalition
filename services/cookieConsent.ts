// services/cookieConsent.ts
//
// First-party cookie consent manager.
//
// Why not an external CMP: the site has no advertising pixels and no
// third-party analytics by default, so a full CMP account is unnecessary
// weight. What the law actually requires is still here:
//
//   - non-essential storage stays OFF until an affirmative choice
//   - accept / reject / granular choices, with reject as easy as accept
//   - the choice is recorded (timestamp + version) and can be withdrawn
//   - the record expires, so visitors are asked again
//
// Categories
//   necessary  - shop, cart, checkout, auth, security, consent record. No opt-in.
//   statistics - Vercel Analytics + Speed Insights. Off until accepted.
//   marketing  - reserved. No marketing scripts ship today. Off until accepted.
//
// Old records are versioned. Bumping CONSENT_VERSION invalidates every stored
// choice, which is what you want whenever the list of purposes changes.

export type ConsentCategory = 'necessary' | 'statistics' | 'marketing';

export interface CookieConsentState {
    necessary: true;
    statistics: boolean;
    marketing: boolean;
    hasResponded: boolean;
    /** ISO timestamp of the choice, or null before the visitor has chosen. */
    timestamp: string | null;
    version: number;
}

export interface ConsentChoice {
    statistics: boolean;
    marketing: boolean;
}

/** localStorage key holding the consent record. */
export const CONSENT_STORAGE_KEY = 'coalition_cookie_consent_v1';

/** Increment when the purposes or vendors change. Invalidates old choices. */
export const CONSENT_VERSION = 1;

/** Re-ask after six months, in line with EDPB/CNIL guidance. */
export const CONSENT_LIFETIME_DAYS = 182;

/** Fired on window whenever the visitor saves or withdraws a choice. */
export const CONSENT_CHANGED_EVENT = 'coalition:consent-changed';

/** Fired on window to reopen the preferences panel from anywhere. */
export const OPEN_CONSENT_EVENT = 'coalition:open-cookie-settings';

const hasWindow = (): boolean => typeof window !== 'undefined';

let memoryRecord: CookieConsentState | null = null;

function defaultState(): CookieConsentState {
    return {
        necessary: true,
        statistics: false,
        marketing: false,
        hasResponded: false,
        timestamp: null,
        version: CONSENT_VERSION,
    };
}

function clearStoredRecord(): void {
    memoryRecord = null;
    if (!hasWindow()) return;
    try {
        window.localStorage.removeItem(CONSENT_STORAGE_KEY);
    } catch {
        /* storage blocked (private mode / disabled) — memory record is enough */
    }
}

function emit(record: CookieConsentState): void {
    if (!hasWindow()) return;
    const event = typeof CustomEvent === 'function'
        ? new CustomEvent(CONSENT_CHANGED_EVENT, { detail: record })
        : new Event(CONSENT_CHANGED_EVENT);
    window.dispatchEvent(event);
}

/**
 * The current consent record.
 *
 * Always returns a usable state: before a choice it is "necessary only",
 * so callers never accidentally treat an unanswered visitor as opted in.
 */
export function getConsentRecord(): CookieConsentState {
    if (!hasWindow()) return memoryRecord ?? defaultState();

    let raw: string | null = null;
    try {
        raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    } catch {
        return memoryRecord ?? defaultState();
    }

    if (!raw) return memoryRecord ?? defaultState();

    try {
        const parsed = JSON.parse(raw) as Partial<CookieConsentState>;
        const timestamp = typeof parsed.timestamp === 'string' ? Date.parse(parsed.timestamp) : NaN;

        if (
            parsed.version !== CONSENT_VERSION ||
            !Number.isFinite(timestamp) ||
            timestamp > Date.now() + 24 * 60 * 60 * 1000 ||
            Date.now() - timestamp > CONSENT_LIFETIME_DAYS * 24 * 60 * 60 * 1000
        ) {
            clearStoredRecord();
            return defaultState();
        }

        return {
            necessary: true,
            statistics: parsed.statistics === true,
            marketing: parsed.marketing === true,
            hasResponded: true,
            timestamp: parsed.timestamp as string,
            version: CONSENT_VERSION,
        };
    } catch {
        clearStoredRecord();
        return defaultState();
    }
}

/**
 * Compatibility shape used by the rest of the app. Returns null until the
 * visitor has actually answered, which distinguishes "not asked" from
 * "declined everything".
 */
export function getCookieConsent(): CookieConsentState | null {
    const record = getConsentRecord();
    return record.hasResponded ? record : null;
}

/** Necessary storage is always allowed; optional categories need an opt-in. */
export function hasConsented(category: ConsentCategory): boolean {
    if (category === 'necessary') return true;
    return getConsentRecord()[category] === true;
}

/** Persist an explicit choice and notify listeners. */
export function saveConsent(choice: ConsentChoice): CookieConsentState {
    const record: CookieConsentState = {
        necessary: true,
        statistics: choice.statistics === true,
        marketing: choice.marketing === true,
        hasResponded: true,
        timestamp: new Date().toISOString(),
        version: CONSENT_VERSION,
    };

    memoryRecord = record;
    if (hasWindow()) {
        try {
            window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
        } catch {
            /* memory fallback: the choice still applies for this page load */
        }
    }

    emit(record);
    return record;
}

/** "Accept all" — grants every optional category that currently exists. */
export function acceptAllConsent(): CookieConsentState {
    return saveConsent({ statistics: true, marketing: true });
}

/** "Reject non-essential" — the default, and always one click away. */
export function rejectNonEssentialConsent(): CookieConsentState {
    return saveConsent({ statistics: false, marketing: false });
}

/** Reopen the preferences panel (the footer "Cookie Settings" link). */
export function showConsentDialog(): void {
    if (!hasWindow()) return;
    window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}

/** Subscribe to saved choices. Returns an unsubscribe function. */
export function onConsentChanged(callback: (state: CookieConsentState) => void): () => void {
    if (!hasWindow()) return () => undefined;
    const handler = () => callback(getConsentRecord());
    window.addEventListener(CONSENT_CHANGED_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
        window.removeEventListener(CONSENT_CHANGED_EVENT, handler);
        window.removeEventListener('storage', handler);
    };
}

/** Forget the record and ask again. Exposed for tests and "withdraw" flows. */
export function resetConsent(): void {
    clearStoredRecord();
    emit(defaultState());
}
