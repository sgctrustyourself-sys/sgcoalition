// tests/verifyAppUrl.test.ts
//
// scripts/verify-app-url.mjs asserts the live deployment's VITE_APP_URL
// equals a default baked into that script — because the post-deploy gate
// runs without `npm ci`, the script cannot import utils/seo.ts. A baked-in
// default is a mirror, and mirrors drift: the day the canonical origin moves
// again, someone updates SITE_ORIGIN and the gate keeps guarding the old
// host, green and wrong.
//
// So this pins the mirror to its owner. The gate check stays meaningful only
// while its default IS the canonical origin.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { SITE_ORIGIN } from '../utils/seo';

const ROOT = process.cwd();

describe('the app-url gate check mirrors the canonical origin', () => {
    it('defaults to SITE_ORIGIN, not a stale host', () => {
        const script = fs.readFileSync(path.join(ROOT, 'scripts', 'verify-app-url.mjs'), 'utf8');
        const match = script.match(/DEFAULT_EXPECTED_ORIGIN\s*=\s*'([^']+)'/);
        expect(match, 'the check script must name its expected-origin default').not.toBeNull();
        expect(match![1]).toBe(SITE_ORIGIN);
    });

    it('names the owner, so the next move updates one place', () => {
        // If the default ever stops pointing at the owner comment, the
        // equality above still guards the value — but the next person moving
        // the origin deserves the pointer.
        const script = fs.readFileSync(path.join(ROOT, 'scripts', 'verify-app-url.mjs'), 'utf8');
        expect(script).toContain('utils/seo.ts');
    });
});
