import { useEffect, useState } from 'react';
import {
    getConsentRecord,
    onConsentChanged,
    type CookieConsentState,
} from '../services/cookieConsent';

/**
 * Subscribe a component to the visitor's cookie choice.
 *
 * The manager is intentionally plain (localStorage + events) so it can be read
 * from non-React code too; this hook is just the React binding.
 */
export function useCookieConsent(): CookieConsentState {
    const [state, setState] = useState<CookieConsentState>(() => getConsentRecord());

    useEffect(() => onConsentChanged(setState), []);

    return state;
}
