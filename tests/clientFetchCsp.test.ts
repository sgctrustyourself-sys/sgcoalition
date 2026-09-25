// tests/clientFetchCsp.test.ts
//
// Guard for a bug class that has now shipped three times: a client-side request
// to a host the Content-Security-Policy does not allow. The browser refuses such
// a request before it is sent, and because it fails exactly like an empty
// dataset, nothing surfaces it — the feature just quietly does nothing.
//
//   - the Polygon RPCs      (utils/sgcoinApi.ts)      — chain reads all failed
//   - cdn.jsdelivr.net      (components/LiveMap.tsx)  — the US map drew nothing
//   - api.etherscan.io      (utils/polygonScanApi.ts) — latent, blocked on use
//
// The CSP lives in vercel.json while the URLs live in component source, so
// nothing connected them. This test connects them: every https host that client
// code hands to a page-level network sink must be permitted by connect-src.
//
// It deliberately does NOT police non-fetch URLs. Image hosts (img-src), social
// links, explorer links and JSON-LD vocabulary all appear as https literals in
// the same files and are governed by other directives or none at all.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');

// Client-side source only. `api/` runs on Node (no CSP) and .cjs helpers such as
// services/githubSync.cjs are server-side too — nothing in them is subject to
// the browser policy.
const CLIENT_DIRS = ['components', 'pages', 'utils', 'hooks', 'services', 'context', 'constants'];
const CLIENT_ROOT_FILES = ['App.tsx', 'index.tsx'];
const SKIP_EXTENSIONS = ['.cjs'];

/** Positions where the browser, not the wallet or the server, makes the request. */
const SINKS = [
    /\bfetch\s*\(/g,
    /\bsendBeacon\s*\(/g,
    /\bnew\s+EventSource\s*\(/g,
    /\bnew\s+WebSocket\s*\(/g,
    /\bJsonRpcProvider\s*\(/g,
    /\bgeography\s*=\s*\{/g, // react-simple-maps fetches the TopoJSON it is given
];

const URL_PATTERN = /\b(?:https|wss):\/\/[^\s'"`)<>]+/g;

const readCsp = () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(projectRoot, 'vercel.json'), 'utf8'));
    const header = vercel.headers
        .flatMap((h: { headers: { key: string; value: string }[] }) => h.headers)
        .find((h: { key: string }) => h.key === 'Content-Security-Policy');
    expect(header, 'no Content-Security-Policy in vercel.json').toBeTruthy();
    const directive = header.value
        .split(';')
        .map((part: string) => part.trim())
        .find((part: string) => part.startsWith('connect-src'));
    expect(directive, 'connect-src missing from the CSP').toBeTruthy();
    return directive.split(/\s+/).slice(1);
};

/**
 * CSP source-expression matching, limited to what this policy actually uses:
 * 'self', exact hosts, host wildcards, optional path scoping, and wss.
 */
const isAllowed = (rawUrl: string, sources: string[]) => {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        return true; // not an absolute URL (e.g. a relative /api path)
    }

    return sources.some((source) => {
        if (source === "'self'") return url.host === 'sgcoalition.xyz';
        const match = source.match(/^([a-z]+):\/\/([^/]+)(\/.*)?$/);
        if (!match) return false;
        const [, scheme, hostPattern, pathPrefix] = match;
        if (scheme !== url.protocol.replace(':', '')) return false;
        if (pathPrefix && !url.pathname.startsWith(pathPrefix)) return false;

        if (hostPattern.startsWith('*.')) {
            const suffix = hostPattern.slice(1); // '.supabase.co'
            return url.host.endsWith(suffix);
        }
        return url.host === hostPattern;
    });
};

const clientFiles = () => {
    const files: string[] = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
                files.push(full);
            }
        }
    };
    for (const dir of CLIENT_DIRS) {
        const full = path.join(projectRoot, dir);
        if (fs.existsSync(full)) walk(full);
    }
    for (const file of CLIENT_ROOT_FILES) {
        const full = path.join(projectRoot, file);
        if (fs.existsSync(full)) files.push(full);
    }
    return files.filter((f) => !SKIP_EXTENSIONS.some((ext) => f.endsWith(ext)));
};

/**
 * Maps local identifier names to every URL they can yield, following one level
 * of aliasing (`const URL = BASE + '/x'`). Without this the guard would miss the
 * very shapes that failed before — the atlas URL is handed to <Geographies> via
 * a const, and the earnings API is built from one.
 */
const buildSymbolUrls = (text: string) => {
    const raw = new Map<string, string[]>();
    for (const decl of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]{0,400})/g)) {
        const [, name, expr] = decl;
        const urls = [...expr.matchAll(URL_PATTERN)].map((m) => m[0]);
        const refs = [...expr.matchAll(/\b[A-Za-z_$][\w$]*\b/g)].map((m) => m[0]);
        raw.set(name, [...new Set([...urls, ...refs.map((r) => `\u0000${r}`)])]);
    }

    const resolve = (name: string, seen = new Set<string>()): string[] => {
        if (seen.has(name)) return [];
        seen.add(name);
        const entries = raw.get(name);
        if (!entries) return [];
        return entries.flatMap((entry) =>
            entry.startsWith('\u0000') ? resolve(entry.slice(1), seen) : [entry],
        );
    };

    const resolved = new Map<string, string[]>();
    for (const name of raw.keys()) resolved.set(name, [...new Set(resolve(name))]);
    return resolved;
};

/**
 * Hosts the CSP blocks that are not worth allowing, because the endpoint itself
 * is gone — permitting them would only hide the breakage behind a green test.
 * Every entry must still be fetched by the code; if that stops, the entry has to
 * be deleted (asserted below), so this list cannot quietly rot.
 */
const KNOWN_BROKEN: Record<string, string> = {};

// Shared constants (POLYGON_RPC_URLS and friends) are declared in constants.ts
// and imported everywhere, so resolve against them as well as the local file.
const sharedSymbols = buildSymbolUrls(fs.readFileSync(path.join(projectRoot, 'constants.ts'), 'utf8'));

/** Every absolute URL this file hands to a page-level sink, with its line. */
const findFetchUrls = (file: string, text: string) => {
    const symbols = buildSymbolUrls(text);
    const lookup = (name: string) => symbols.get(name) ?? sharedSymbols.get(name) ?? [];
    const found: { url: string; line: number }[] = [];

    for (const sink of SINKS) {
        sink.lastIndex = 0;
        for (const match of text.matchAll(sink)) {
            const start = match.index ?? 0;
            const window = text.slice(start, start + 300).split(';')[0];
            const urls = [...window.matchAll(URL_PATTERN)].map((m) => m[0]);
            for (const identifier of window.matchAll(/\b[A-Za-z_$][\w$]*\b/g)) {
                urls.push(...lookup(identifier[0]));
            }
            const line = text.slice(0, start).split('\n').length;
            for (const url of new Set(urls)) found.push({ url, line });
        }
    }
    return found.map((hit) => ({ ...hit, file: path.relative(projectRoot, file) }));
};

const allHits = clientFiles().flatMap((file) => findFetchUrls(file, fs.readFileSync(file, 'utf8')));

describe('client fetch hosts are permitted by the CSP connect-src', () => {
    it('finds the fetches it is meant to police (guards against a vacuous scan)', () => {
        // If a refactor renames a sink, or moves a URL out of reach of the naive
        // resolution, this fails — rather than the suite passing because the
        // scan matched nothing. These three are the shapes that previously
        // slipped past review: a const handed to a JSX prop, a URL assembled
        // from a const, and an RPC provider built from a shared constant.
        const urls = allHits.map((hit) => hit.url);
        expect(urls.some((u) => u.includes('cdn.jsdelivr.net'))).toBe(true);
        expect(urls.some((u) => u.includes('api.etherscan.io'))).toBe(true);
        expect(urls.some((u) => /publicnode|drpc|ankr/.test(u))).toBe(true);
        expect(allHits.length).toBeGreaterThan(5);
    });

    it('permits every host the client fetches', () => {
        const sources = readCsp();
        const blocked = allHits.filter((hit) => !isAllowed(hit.url, sources));
        const unexplained = blocked.filter(
            (hit) => !Object.keys(KNOWN_BROKEN).some((host) => hit.url.includes(host)),
        );
        const report = unexplained
            .map((hit) => `  ${hit.file}:${hit.line}  ${hit.url}`)
            .join('\n');

        expect(
            unexplained,
            `These client-side requests are refused by the CSP before they are sent,\n` +
                `which fails silently in the UI. Add the host to connect-src in vercel.json:\n${report}`,
        ).toEqual([]);
    });

    it('still needs every known-broken exception', () => {
        // Keeps the exception list honest: once the fetch is repaired or removed,
        // this fails so the stale entry gets deleted.
        for (const [host, reason] of Object.entries(KNOWN_BROKEN)) {
            expect(
                allHits.some((hit) => hit.url.includes(host)),
                `${host} is no longer fetched — delete it from KNOWN_BROKEN (${reason})`,
            ).toBe(true);
        }
    });
});
