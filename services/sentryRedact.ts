// services/sentryRedact.ts
//
// Pure redaction for outgoing error events: no SDK state, no DSN, no side
// effects — which is why it lives apart from services/sentryInit.ts. Error
// events leave the browser for a third party, so this is the privacy boundary,
// and it is the one part of the Sentry wiring that is worth reading on its own.
//
// WHAT IS SCRUBBED: customer emails, bearer tokens, Stripe keys (sk/pk/rk,
// whsec_), Resend keys (re_), cookie jars, auth headers, and any value under a
// key named token/secret/password/card/cvc/authorization.
//
// WHAT IS DELIBERATELY KEPT: order ids, Stripe payment-intent ids, and status
// codes. An incident you cannot correlate to an order is not worth reporting.
//
// NOT covered on purpose: a bare "token <x>" inside a free-text message. The
// pattern would match React's extremely common "Unexpected token <" error and
// mangle the message, so payload *keys* named token are handled by scrubDeep
// instead.

import type { ErrorEvent } from '@sentry/react';

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const BEARER_RE = /\b(bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi;
const KEY_PREFIX_RE = /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{6,}/g;
const WEBHOOK_RE = /\bwhsec_[A-Za-z0-9]{6,}/g;
const RESEND_RE = /\bre_[A-Za-z0-9]{8,}/g;

const SENSITIVE_KEY_RE = /token|secret|password|passphrase|authorization|cookie|card|cvc|api[_-]?key/i;

/** Redact secrets and customer identifiers from a free-text string. */
export function scrubText(value: string): string {
    return value
        .replace(EMAIL_RE, '[email]')
        .replace(BEARER_RE, '$1[redacted]')
        .replace(KEY_PREFIX_RE, '$1_$2_[redacted]')
        .replace(WEBHOOK_RE, 'whsec_[redacted]')
        .replace(RESEND_RE, 're_[redacted]');
}

/** Recursively redact sensitive keys and values in a payload. */
export function scrubDeep(value: unknown, depth = 0): unknown {
    if (depth > 5) return '[truncated]';
    if (typeof value === 'string') return scrubText(value);
    if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1));
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
            out[key] = SENSITIVE_KEY_RE.test(key) ? '[redacted]' : scrubDeep(inner, depth + 1);
        }
        return out;
    }
    return value;
}

/** Sentry `beforeSend`: the last gate before an event leaves the browser. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
    if (typeof event.message === 'string') event.message = scrubText(event.message);

    const values = event.exception?.values;
    if (values) {
        for (const v of values) {
            if (typeof v.value === 'string') v.value = scrubText(v.value);
        }
    }

    if (event.request) {
        if (typeof event.request.url === 'string') event.request.url = scrubText(event.request.url);
        if (event.request.data !== undefined) event.request.data = scrubDeep(event.request.data);
        // Never ship cookie jars or auth headers.
        delete event.request.cookies;
        const headers = event.request.headers;
        if (headers && typeof headers === 'object') {
            for (const key of Object.keys(headers)) {
                if (SENSITIVE_KEY_RE.test(key)) headers[key] = '[redacted]';
            }
        }
    }

    if (event.breadcrumbs) {
        for (const b of event.breadcrumbs) {
            if (typeof b.message === 'string') b.message = scrubText(b.message);
            if (b.data !== undefined) b.data = scrubDeep(b.data) as Record<string, any>;
        }
    }

    if (event.extra) event.extra = scrubDeep(event.extra) as Record<string, any>;

    return event;
}
