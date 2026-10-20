// tests/downDomain.test.ts
//
// sgcoalition.xyz is DOWN. It is not a fallback, not a second storefront,
// not a legacy alias: it answers 402 DEPLOYMENT_DISABLED, and it has no MX
// records, so the address that used to live on it cannot receive mail
// either.
//
// The domain that replaced it is sgcoalition.shop. Every reference in the
// codebase has to point there, because a reference to the old domain is a
// customer-facing link to a host that returns 402 — a checkout that 402s,
// a canonical tag that points at nothing, a webhook that never arrives.
//
// This test is the thing that keeps it that way. The failure mode it
// guards against is quiet: nobody adds a "just in case" link to the old
// domain on purpose, but a copy-pasted URL or an old snippet in a
// template brings one back, and nothing else notices.
//
// The one legitimate exception is mail.sgcoalition.xyz — the domain Resend
// sends transactional email from. Its DKIM and DMARC records are intact
// and it is not a website, so it stays.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOWN_DOMAIN = 'sgcoalition.xyz';
const ALLOWED = ['mail.sgcoalition.xyz'];

/** Directories that hold no user-facing source. */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.vercel', '.next', 'coverage', '.githooks']);

/** Files whose content is history, not something that ships. */
const SKIP_FILES = /\.(md|log)$/i;

/** Dated measurement artifacts and build dumps — records of a past run. */
const SKIP_MEASUREMENTS = /^(lighthouse-.*\.json|bundle_analysis\.txt)$/i;

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|html|css|txt|xml|svg|sh|toml|yml|yaml)$/i;

function collect(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') && entry.name !== '.env.production.template') {
            if (SKIP_DIRS.has(entry.name)) continue;
        }
        if (SKIP_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collect(full, out);
        } else if (entry.isFile() && TEXT_EXT.test(entry.name) && !SKIP_FILES.test(entry.name)) {
            if (SKIP_MEASUREMENTS.test(entry.name)) continue;
            out.push(full);
        }
    }
    return out;
}

describe('the down domain stays down', () => {
    const files = collect(ROOT).filter(
        (f) =>
            !f.includes(`${path.sep}docs${path.sep}`) &&
            !f.includes(`${path.sep}tmp${path.sep}`) &&
            // This file names the domain on purpose — it is the thing that
            // checks for it.
            path.basename(f) !== 'downDomain.test.ts',
    );

    it('finds source files to scan', () => {
        // A scan that matched nothing would pass vacuously.
        expect(files.length).toBeGreaterThan(50);
    });

    it('no source file references sgcoalition.xyz', () => {
        const offenders: string[] = [];
        for (const file of files) {
            const rel = path.relative(ROOT, file);
            const content = fs.readFileSync(file, 'utf8');
            content.split(/\r?\n/).forEach((line, i) => {
                if (!line.includes(DOWN_DOMAIN)) return;
                // The Resend sending domain is not the down website.
                if (ALLOWED.some((allowed) => line.includes(allowed))) return;
                offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
            });
        }
        expect(
            offenders,
            `sgcoalition.xyz is down (402, no MX). These references point at a dead host — use sgcoalition.shop:\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('the canonical origin is sgcoalition.shop', () => {
        const seo = fs.readFileSync(path.join(ROOT, 'utils', 'seo.ts'), 'utf8');
        expect(seo).toContain("SITE_ORIGIN = 'https://sgcoalition.shop'");
    });
});
