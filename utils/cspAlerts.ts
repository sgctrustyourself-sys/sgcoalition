// utils/cspAlerts.ts
//
// Pure classification for "this CSP violation blocked a Stripe request".
//
// The alert path must be conservative: only script-src, frame-src and
// connect-src can stop checkout, and only a blocked URI on stripe.com (or a
// subdomain) is ours to escalate. img-src/style-src violations are noisy and
// not revenue-critical, so they stay dashboard-only.
//
// A browser may report the directive as `script-src-elem` (or `-attr`); those
// are the element/attribute-specific forms of the same script-src policy and
// must alert as script-src. The blocked URI may arrive with a scheme, without
// one, with a path, a port, or a trailing dot depending on the browser.

export type StripeCspDirective = 'script-src' | 'frame-src' | 'connect-src';

export interface StripeCspAlert {
    /** Directive family: script-src-elem normalizes to script-src. */
    directive: StripeCspDirective;
    /** Lowercase hostname that was blocked, e.g. hooks.stripe.com. */
    host: string;
    /** Stable dedupe identity: one alert per directive family + host. */
    key: string;
}

const CHECKOUT_DIRECTIVES = new Set<StripeCspDirective>(['script-src', 'frame-src', 'connect-src']);

/** Normalize a CSP report directive to the family that can break checkout. */
export function normalizeCheckoutDirective(value: string | null | undefined): StripeCspDirective | null {
    const first = String(value || '').trim().toLowerCase().split(/\s+/)[0] || '';
    const family = first.replace(/-(?:elem|attr)$/, '');
    return CHECKOUT_DIRECTIVES.has(family as StripeCspDirective)
        ? (family as StripeCspDirective)
        : null;
}

/**
 * Hostname from a CSP `blocked-uri`, or null when it is not a Stripe host.
 * Handles `https://js.stripe.com/...`, `js.stripe.com/...`, `js.stripe.com:443`,
 * and the keyword values (`inline`, `eval`, `data`, `blob`) browsers use when
 * no URL was involved.
 */
export function stripeHostFromBlockedUri(blockedUri: string | null | undefined): string | null {
    const raw = String(blockedUri || '').trim().toLowerCase();
    if (!raw) return null;

    const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
    const hostPort = withoutScheme.split(/[/?#]/)[0] || '';
    const host = hostPort.replace(/^\*\./, '').split(':')[0].replace(/\.$/, '');
    if (!host) return null;

    return host === 'stripe.com' || host.endsWith('.stripe.com') ? host : null;
}

/**
 * Classify one report. Returns null unless the report is for a checkout
 * directive *and* the blocked resource is on stripe.com.
 */
export function classifyStripeCspAlert(input: {
    violatedDirective?: string | null;
    effectiveDirective?: string | null;
    blockedUri?: string | null;
}): StripeCspAlert | null {
    const directive = normalizeCheckoutDirective(input.effectiveDirective)
        || normalizeCheckoutDirective(input.violatedDirective);
    if (!directive) return null;

    const host = stripeHostFromBlockedUri(input.blockedUri);
    if (!host) return null;

    return { directive, host, key: `${directive}|${host}` };
}
