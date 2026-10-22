import { CONSENT_TEXT, CONSENT_CHECKBOX_TEXT } from '../constants.js';

// Cookie consent used to be delegated to Cookiebot, but no Cookiebot loader
// (and no domain group ID) was ever configured, so the banner never loaded and
// `window.Cookiebot.renew()` silently did nothing. Consent now lives in
// services/cookieConsent.ts as first-party code: same categories, same event
// hook, but no third-party script that can fail closed to "no banner".
export {
    getConsentRecord,
    getCookieConsent,
    hasConsented,
    onConsentChanged,
    showConsentDialog,
    acceptAllConsent,
    rejectNonEssentialConsent,
    saveConsent,
} from './cookieConsent.js';
export type {
    ConsentCategory,
    CookieConsentState,
    ConsentChoice,
} from './cookieConsent.js';

// ---------------------------------------------------------------------------
// Legacy consent capture (no-refunds checkbox verification)
// ---------------------------------------------------------------------------

export interface ConsentData {
    consentText: string;
    consentTimestamp: string;
    consentIp: string;
    consentUserAgent: string;
    consentUserId?: string;
}

/**
 * Capture consent data for the no-refunds acknowledgement.
 *
 * The IP is deliberately NOT fetched from api.ipify.org any more: that sent the
 * visitor's IP to a third party just to write it back to our own order record.
 * Server handlers already see the request, so they should fill this in; the
 * browser only records "unknown" when it has no trustworthy value.
 */
export async function captureConsent(userId?: string, ip = 'unknown'): Promise<ConsentData> {
    return {
        consentText: CONSENT_TEXT,
        consentTimestamp: new Date().toISOString(),
        consentIp: ip,
        consentUserAgent: navigator.userAgent,
        consentUserId: userId,
    };
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
