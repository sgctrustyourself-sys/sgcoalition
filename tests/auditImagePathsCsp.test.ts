// tests/auditImagePathsCsp.test.ts
//
// scripts/auditImagePaths.ts used to carry its own canonical-host regexes
// (i.imgur.com + the Supabase storage prefix). A policy change could leave the
// audit passing URLs the browser now blocks, or rejecting hosts the policy
// added. These tests pin the replacement: the audit's allowlist is parsed from
// vercel.json's img-src, so there is only one place to change.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
    classifyImageUrl,
    parsePolicyImageHosts,
} from '../scripts/auditImagePaths';

const read = (relativePath: string): string => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
const hosts = parsePolicyImageHosts(read('vercel.json'));

describe('auditImagePaths — image hosts come from the CSP', () => {
    it('derives the allowlist from vercel.json img-src', () => {
        expect([...hosts].sort()).toEqual([
            'gateway.pinata.cloud',
            'i.imgur.com',
            'tvacscfbzcmjlcekjcsn.supabase.co',
        ]);
    });

    it('has no second, hand-maintained host list', () => {
        const source = read('scripts/auditImagePaths.ts');
        expect(source).not.toContain('CANONICAL_PATTERNS');
        expect(source).not.toContain('i.imgur.com');
    });

    it('accepts every host the policy names', () => {
        for (const url of [
            'https://i.imgur.com/rJSCmHu.jpg',
            'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/x.jpg',
            // Host-only, exactly like the browser: any path on an allowed host passes.
            'https://tvacscfbzcmjlcekjcsn.supabase.co/anything/else.jpg',
            'https://gateway.pinata.cloud/ipfs/QmExample',
        ]) {
            expect(classifyImageUrl(url, hosts), url).toBeNull();
        }
    });

    it('flags a host the policy does not name', () => {
        expect(classifyImageUrl('https://images.example.com/x.jpg', hosts)).toBe('NON_CANONICAL_HOST');
    });

    it('keeps the existing reasons for relative, insecure and non-URL values', () => {
        expect(classifyImageUrl('/images/x.png', hosts)).toBe('LOCAL_RELATIVE_PATH');
        expect(classifyImageUrl('http://i.imgur.com/x.jpg', hosts)).toBe('INSECURE_HTTP');
        expect(classifyImageUrl('data:image/png;base64,AAAA', hosts)).toBe('OTHER');
    });

    it('matches a CSP wildcard subdomain, not the bare domain', () => {
        expect(classifyImageUrl('https://img.example.com/x.jpg', ['*.example.com'])).toBeNull();
        expect(classifyImageUrl('https://example.com/x.jpg', ['*.example.com'])).toBe('NON_CANONICAL_HOST');
    });

    it('refuses to audit a wildcard policy instead of passing everything', () => {
        expect(() => parsePolicyImageHosts('img-src \'self\' data: https:;')).toThrow(/every https host/);
        expect(() => parsePolicyImageHosts('img-src *;')).toThrow(/every https host/);
        expect(() => parsePolicyImageHosts('default-src \'self\';')).toThrow(/no img-src/);
    });
});
