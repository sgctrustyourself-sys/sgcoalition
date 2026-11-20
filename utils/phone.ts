// utils/phone.ts
//
// Phone normalisation for the one place a phone number is captured by hand:
// the member signup form. The marketing layer stores phones as E.164
// (`+14433775592`) because that is the only shape that is unambiguous across
// countries and the only shape the SMS sender accepts.
//
// Nothing else in the app needs this: every other phone on the system is
// already E.164 (Stripe, Shippo, Twilio all take E.164 or a local format
// they normalise themselves).

/**
 * Normalise a human-typed phone number to E.164, or return null when the
 * input cannot be read as a number.
 *
 * Rules, in order:
 *   • already E.164 (`+` then 7-15 digits) -> kept as-is
 *   • 11 digits starting with 1 (US country code) -> +1XXXXXXXXXX
 *   • 10 digits (North America) -> +1XXXXXXXXXX
 *   • anything else -> null
 *
 * `defaultCountry` only exists so the intent is readable at the call site; the
 * default country code is always +1 (US) because that is where the store
 * ships.
 */
export function toE164(raw: string | null | undefined): string | null {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return null;

    // Already international: keep it, but only if it is a plausible number.
    if (trimmed.startsWith('+')) {
        const digits = trimmed.slice(1).replace(/\D/g, '');
        return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
    }

    // Everything else: strip to digits. Extensions ("x12") and punctuation
    // are dropped, which is what a human means by them here.
    const digits = trimmed.replace(/\D/g, '');

    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    return null;
}

/** A readable US rendering of an E.164 number, for the admin contact view. */
export function formatPhoneForDisplay(e164: string | null | undefined): string {
    const s = String(e164 || '').trim();
    if (!s) return '';
    const digits = s.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return s;
}
