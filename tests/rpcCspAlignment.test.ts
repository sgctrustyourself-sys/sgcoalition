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
