/**
 * The Vercel and Netlify CSPs are two hand-maintained copies of one policy.
 * They must now be token-for-token identical: any host added, removed, or
 * reordered on one side fails here. Both must also report to /api/csp-report,
 * asserted separately so removing it from both targets cannot pass silently.
 *
 * Focused tests still own the security detail: imgSrcCsp (images),
 * rpcCspAlignment (connect-src and unsafe-eval), stripeFrameCsp (Stripe), and
 * cookieConsent (Cookiebot). This file's job is parity, not completeness.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string): string =>
    fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const cspValue = (source: string, pattern: RegExp): string =>
    source.match(pattern)?.[1] ?? '';

const directiveMap = (policy: string): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const part of policy.split(';')) {
        const tokens = part.trim().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) continue;
        const [name, ...values] = tokens;
        // A duplicated directive would silently overwrite the first one here
        // (and browsers use the first), hiding drift instead of failing.
        if (map.has(name)) throw new Error(`duplicate CSP directive: ${name}`);
        map.set(name, values);
    }
    return map;
};

const vercel = directiveMap(cspValue(
    read('vercel.json'),
    // vercel.json stores the header as a key/value pair; read the value that
    // follows the CSP key, not the key itself.
    /Content-Security-Policy"[\s\S]*?"value"\s*:\s*"([^"]*)"/,
));
const netlify = directiveMap(cspValue(
    read('netlify.toml'),
    /Content-Security-Policy\s*=\s*"([^"]*)"/,
));

describe('Vercel ↔ Netlify CSP parity', () => {
    it('parses a policy from both targets', () => {
        // Anti-vacuity: a regex miss must not make the equality below trivial.
        expect(vercel.size).toBeGreaterThan(5);
        expect(netlify.size).toBeGreaterThan(5);
    });

    it('has identical directives and token lists', () => {
        expect(Object.fromEntries(netlify)).toEqual(Object.fromEntries(vercel));
    });

    it('sends violations to /api/csp-report from both targets', () => {
        expect(vercel.get('report-uri')).toEqual(['/api/csp-report']);
        expect(netlify.get('report-uri')).toEqual(['/api/csp-report']);
    });
});
