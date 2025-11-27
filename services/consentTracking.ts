import { CONSENT_TEXT, CONSENT_CHECKBOX_TEXT } from '../constants';

export interface ConsentData {
    consentText: string;
    consentTimestamp: string;
    consentIp: string;
    consentUserAgent: string;
    consentUserId?: string;
}

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
