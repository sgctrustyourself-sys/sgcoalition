import { CONSENT_TEXT, CONSENT_CHECKBOX_TEXT } from '../constants';

export interface ConsentData {
    consentText: string;
    consentTimestamp: string;
    consentIp: string;
    consentUserAgent: string;
    consentUserId?: string;
}

// ---------------------------------------------------------------------------
// Cookiebot CMP integration helpers
// ---------------------------------------------------------------------------

/** The global Cookiebot API, injected by the uc.js script in index.html. */
declare global {
    interface Window {
        Cookiebot?: {
            consent: {
                necessary: boolean;
                preferences: boolean;
                statistics: boolean;
                marketing: boolean;
            };
            hasResponse: boolean;
            show: () => void;
            hide: () => void;
            renew: () => void;
            withdraw: () => void;
            submitCustomConsent: (
                necessary: boolean,
                preferences: boolean,
                statistics: boolean,
                marketing: boolean
            ) => void;
        };
        // NOTE: addEventListener and removeEventListener already exist on
        // Window from lib.dom.d.ts — they are NOT redeclared here to avoid
        // a required-vs-optional merge conflict with the DOM types.
    }
}

/** Cookie categories as reported by Cookiebot. */
export interface CookieConsentState {
    necessary: boolean;
    preferences: boolean;
    statistics: boolean;
    marketing: boolean;
    hasResponded: boolean;
}

/**
 * Read the current cookie consent state from Cookiebot.
 * Returns null if Cookiebot hasn't loaded yet.
 */
export function getCookieConsent(): CookieConsentState | null {
    if (!window.Cookiebot) return null;
    return {
        necessary: window.Cookiebot.consent.necessary,
        preferences: window.Cookiebot.consent.preferences,
        statistics: window.Cookiebot.consent.statistics,
        marketing: window.Cookiebot.consent.marketing,
        hasResponded: window.Cookiebot.hasResponse,
    };
}

/**
 * Check if a specific cookie category has been consented to.
 * Necessary cookies are always granted and return true even before consent.
 */
export function hasConsented(category: 'necessary' | 'preferences' | 'statistics' | 'marketing'): boolean {
    const state = getCookieConsent();
    if (!state) return category === 'necessary'; // fail-safe: necessary only
    if (category === 'necessary') return true;
    return state[category] === true;
}

/**
 * Check if preferences consent has been given (required for PayPal SDK).
 */
export function hasPaypalConsent(): boolean {
    return hasConsented('preferences');
}

/**
 * Listen for Cookiebot consent changes. The callback fires when the
 * visitor accepts, declines, or changes their cookie preferences.
 * Returns an unsubscribe function.
 */
export function onConsentChanged(callback: (state: CookieConsentState) => void): () => void {
    const handler = () => {
        const state = getCookieConsent();
        if (state) callback(state);
    };

    window.addEventListener?.('CookiebotOnAccept', handler);
    window.addEventListener?.('CookiebotOnDecline', handler);
    window.addEventListener?.('CookiebotOnLoad', handler);

    return () => {
        window.removeEventListener?.('CookiebotOnAccept', handler);
        window.removeEventListener?.('CookiebotOnDecline', handler);
        window.removeEventListener?.('CookiebotOnLoad', handler);
    };
}

/**
 * Reopen the Cookiebot consent dialog so the visitor can change preferences.
 */
export function showConsentDialog(): void {
    if (window.Cookiebot) {
        window.Cookiebot.renew();
    }
}

// ---------------------------------------------------------------------------
// Legacy consent capture (checkout checkbox verification)
// ---------------------------------------------------------------------------

/**
 * Capture consent data from the current session
 */
export async function captureConsent(userId?: string): Promise<ConsentData> {
    const timestamp = new Date().toISOString();
    const userAgent = navigator.userAgent;

    // Get client IP (this will need to be done server-side in production)
    const ip = await getClientIP();

    return {
        consentText: CONSENT_TEXT,
        consentTimestamp: timestamp,
        consentIp: ip,
        consentUserAgent: userAgent,
        consentUserId: userId
    };
}

/**
 * Get client IP address
 * Note: In production, this should be done server-side
 */
async function getClientIP(): Promise<string> {
    try {
        // In production, this would be captured server-side from the request headers
        // For now, we'll use a placeholder or a third-party service
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || 'unknown';
    } catch (error) {
        console.error('Failed to get client IP:', error);
        return 'unknown';
    }
}

/**
 * Validate consent data
 */
export function validateConsent(consent: Partial<ConsentData>): boolean {
    return !!(
        consent.consentText &&
        consent.consentTimestamp &&
        consent.consentIp &&
        consent.consentUserAgent
    );
}

/**
 * Format consent data for display
 */
export function formatConsentData(consent: ConsentData): string {
    const date = new Date(consent.consentTimestamp);
    return `
Consent Given: ${date.toLocaleString()}
IP Address: ${consent.consentIp}
User Agent: ${consent.consentUserAgent}
Consent Text: "${consent.consentText}"
    `.trim();
}

/**
 * Check if consent checkbox text matches expected text
 */
export function verifyConsentText(providedText: string): boolean {
    return providedText === CONSENT_CHECKBOX_TEXT;
}
