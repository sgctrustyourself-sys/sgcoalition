/**
 * The RPC list and the CSP are two halves of one capability: the app may only
 * read from Polygon through hosts that `connect-src` permits. When they drift,
 * the browser refuses the request before it leaves the page and the whole
 * on-chain path collapses silently — which is what happened in production
 * (found by playtest 2026-09-15: `connect-src` allowed only a host whose
 * tenant was disabled, so every read failed and the UI fell back to
 * placeholder prices).
 *
 * If you add or remove an RPC, update the other side in the same commit.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { POLYGON_RPC_URLS } from '../constants';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vercelConfig = fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8');

/** The `connect-src` value of the Content-Security-Policy header. */
const connectSrcDirective = (): string => {
    const policy = vercelConfig.split('Content-Security-Policy')[1] ?? '';
    const match = policy.match(/connect-src([^;"\\]*)/);
    return match ? match[1] : '';
};

describe('Polygon RPC list vs Content-Security-Policy', () => {
    it('every RPC the app attempts is permitted by connect-src', () => {
        const directive = connectSrcDirective();
        expect(directive).not.toBe('');
        for (const rpc of POLYGON_RPC_URLS) {
            expect(directive).toContain(new URL(rpc).origin);
        }
    });

    it('the fallback chain is https-only and non-empty', () => {
        expect(POLYGON_RPC_URLS.length).toBeGreaterThan(0);
        for (const rpc of POLYGON_RPC_URLS) {
            expect(new URL(rpc).protocol).toBe('https:');
        }
    });

    it('has no CSP-allowed Polygon host the app no longer calls', () => {
        // A stale host here is a live hole: the app would be permitted to call
        // an endpoint nobody maintains. Every Polygon host in the directive
        // must be one the app actually uses.
        const origins = POLYGON_RPC_URLS.map((rpc) => new URL(rpc).origin);
        const allowedPolygonHosts = connectSrcDirective()
            .split(/\s+/)
            .filter((token) => /polygon|ankr|drpc|matic/i.test(token))
            // A CSP token may carry a path (https://rpc.ankr.com/polygon); the
            // thing that has to match the RPC list is the origin.
            .map((token) => new URL(token).origin);
        for (const host of allowedPolygonHosts) {
            expect(origins).toContain(host);
        }
    });
});

/**
 * The policy string is a security contract, and it drifted once already: the
 * header shipped 'unsafe-eval' while the docs described a strict policy, and
 * `report-uri` was missing entirely, so /api/csp-report could never fire. These
 * assertions pin exactly the three things that drifted. They read vercel.json
 * the way a browser does — as the shipped policy — so a well-meant "cleanup"
 * that widens it fails here instead of in production.
 */
const policyValue = (): string => {
    const afterKey = vercelConfig.split('Content-Security-Policy')[1] ?? '';
    const match = afterKey.match(/"value"\s*:\s*"([^"]*)"/);
    return match ? match[1] : '';
};

describe('Content-Security-Policy header contract', () => {
    it('ships a policy at all', () => {
        expect(policyValue()).toContain("default-src 'self'");
    });

    it('reports violations to /api/csp-report so the handler can fire', () => {
        // The handler, its route and its docs all predate this directive; for
        // months the endpoint was wired up and unreachable. Keep it reachable.
        expect(policyValue()).toContain('report-uri /api/csp-report');
    });

    it("denies framing with frame-ancestors 'none'", () => {
        // Pairs with X-Frame-Options: DENY, which this header block also sets.
        expect(policyValue()).toContain("frame-ancestors 'none'");
    });

    it("never re-adds 'unsafe-eval'", () => {
        // The production bundle contains zero eval() and zero new Function()
        // calls, and dist/ boots under this policy with no
        // securitypolicyviolation events. Re-adding 'unsafe-eval' silently
        // undoes that; if something genuinely needs it, prove it with a build.
        expect(policyValue()).not.toContain("'unsafe-eval'");
    });
});
