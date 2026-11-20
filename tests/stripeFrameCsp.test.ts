/**
 * Stripe's CSP requirements, pinned across every directive checkout uses.
 *
 * The hardened policy originally allowed only `frame-src https://js.stripe.com`.
 * The Card Element still mounted, which hid the gap: a card that triggers 3DS2
 * renders its challenge from `hooks.stripe.com`, and with that host absent the
 * iframe is blocked and checkout cannot complete. Stripe's guide lists
 * `*.js.stripe.com`, `js.stripe.com`, and `hooks.stripe.com` for Stripe.js, and
 * names `hooks.stripe.com` for redirect-capable payment methods explicitly.
 * `api.stripe.com` carries the PaymentIntent confirmation calls.
 *
 * This file now pins the Stripe subset of `script-src`, `frame-src` and
 * `connect-src` in both configs, and asserts no other stripe.com host slips in.
 * Adding a host is a deliberate act: update this file in the same commit.
 *
 * `form-action 'self'` is intentional and stays: the checkout form submits to
 * itself and Stripe.js redirects with a top-level navigation, not a form POST.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const configs = {
    vercel: read('vercel.json'),
    netlify: read('netlify.toml'),
} as const;

const directiveTokens = (config: string, directive: string): string[] => {
    const match = config.match(new RegExp(`${directive}([^;"\\\\]*)`));
    return match ? match[1].trim().split(/\s+/).filter(Boolean) : [];
};

const tokensFor = (name: keyof typeof configs, directive: string): string[] =>
    directiveTokens(configs[name], directive);

/** stripe.com-host tokens in a directive, deduped and sorted for stable comparison. */
const stripeHosts = (tokens: string[]): string[] =>
    [...new Set(tokens.filter((token) => token.includes('stripe.com')))].sort();

const EXPECTED_STRIPE_HOSTS: Record<'script-src' | 'frame-src' | 'connect-src', string[]> = {
    'script-src': ['https://*.js.stripe.com', 'https://js.stripe.com'],
    'frame-src': ['https://*.js.stripe.com', 'https://hooks.stripe.com', 'https://js.stripe.com'],
    // m.stripe.com is not in Stripe's minimal table but is already used for
    // fraud fingerprinting; keep it and pin it rather than silently dropping it.
    'connect-src': ['https://api.stripe.com', 'https://m.stripe.com'],
};

describe.each(Object.keys(configs) as Array<keyof typeof configs>)('Stripe CSP in %s', (name) => {
    it('pins the exact script-src Stripe hosts', () => {
        expect(stripeHosts(tokensFor(name, 'script-src'))).toEqual([
            ...EXPECTED_STRIPE_HOSTS['script-src'],
        ]);
    });

    it('pins the exact frame-src Stripe hosts, including the 3DS/redirect host', () => {
        expect(stripeHosts(tokensFor(name, 'frame-src'))).toEqual([
            ...EXPECTED_STRIPE_HOSTS['frame-src'],
        ]);
        // Named separately so a failure reads as the revenue bug, not just a diff.
        expect(tokensFor(name, 'frame-src')).toContain('https://hooks.stripe.com');
    });

    it('pins the exact connect-src Stripe hosts, including the API', () => {
        expect(stripeHosts(tokensFor(name, 'connect-src'))).toEqual([
            ...EXPECTED_STRIPE_HOSTS['connect-src'],
        ]);
        expect(tokensFor(name, 'connect-src')).toContain('https://api.stripe.com');
    });

    it('never falls back to a bare scheme wildcard', () => {
        for (const directive of ['script-src', 'frame-src', 'connect-src']) {
            const tokens = tokensFor(name, directive);
            expect(tokens, `${name} ${directive}`).not.toContain('https:');
            expect(tokens, `${name} ${directive}`).not.toContain('*');
        }
    });
});

describe('form-action', () => {
    it('keeps the deployed policy self-only', () => {
        expect(read('vercel.json')).toContain("form-action 'self'");

        // netlify.toml omits form-action; forms fall back to default-src 'self'.
        // Assert that fallback rather than requiring a directive netlify never had.
        const netlify = read('netlify.toml');
        const explicit = netlify.match(/form-action([^;"\\]*)/);
        if (explicit) expect(explicit[1].trim()).toBe("'self'");
        else expect(netlify).toContain("default-src 'self'");
    });
});
