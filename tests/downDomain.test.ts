// tests/downDomain.test.ts
//
// Two storefront hosts are retired, and neither one serves this app any
// more:
//
//   sgcoalition.xyz  — answers 402 DEPLOYMENT_DISABLED, and has no MX
//                      records, so the address that used to live on it
//                      cannot receive mail either.
//   sgcoalition.shop — the Whop-hosted storefront was removed from the
//                      domain, so the apex now serves Whop's "Nothing here
//                      yet" 404 page. A link to it lands a customer on an
//                      empty page, not on the shop.
//
// The domain that replaced them is sgcoalition-five.vercel.app — the host
// this deployment actually serves. Every reference in the codebase has to
// point there, because a reference to a retired host is a customer-facing
// link to nothing — a checkout that 402s, a canonical tag that points at a
// 404, a webhook that never arrives.
//
// This test is the thing that keeps it that way. The failure mode it
// guards against is quiet: nobody adds a "just in case" link to an old
// domain on purpose, but a copy-pasted URL or an old snippet in a
// template brings one back, and nothing else notices.
//
// The one legitimate exception is mail.sgcoalition.xyz — the domain Resend
// sends transactional email from. Its DKIM and DMARC records are intact
// and it is not a website, so it stays.
//
// The MAIN SHARING LINK is a third thing and is deliberately not here:
// linktr.ee/sgcoalition is what the brand prints when it says "link in
// bio" — the linktree carries the portfolio next to the shop. It is not
// the storefront origin and no origin rule applies to it.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOWN_DOMAINS = ['sgcoalition.xyz', 'sgcoalition.shop'];
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

    it('no source file references a retired storefront host', () => {
        const offenders: string[] = [];
        for (const file of files) {
            const rel = path.relative(ROOT, file);
            const content = fs.readFileSync(file, 'utf8');
            content.split(/\r?\n/).forEach((line, i) => {
                if (!DOWN_DOMAINS.some((down) => line.includes(down))) return;
                // The Resend sending domain is not a down website.
                if (ALLOWED.some((allowed) => line.includes(allowed))) return;
                offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 120)}`);
            });
        }
        expect(
            offenders,
            `sgcoalition.xyz is down (402, no MX) and sgcoalition.shop serves Whop's empty 404 page. `
            + `These references point at a dead host — use sgcoalition-five.vercel.app:\n${offenders.join('\n')}`,
        ).toEqual([]);
    });

    it('the canonical origin is sgcoalition-five.vercel.app', () => {
        const seo = fs.readFileSync(path.join(ROOT, 'utils', 'seo.ts'), 'utf8');
        expect(seo).toContain("SITE_ORIGIN = 'https://sgcoalition-five.vercel.app'");
    });

    it('the main sharing link is the linktree, not the storefront', () => {
        // Two different URLs on purpose: the storefront origin and the
        // "link in bio" the brand prints. Conflating them either points
        // the linktree at a bare product page, or points the storefront
        // origin at a linktree.
        //
        // The sharing link is owned by utils/sharingLinks.ts, and the
        // canonical origin by utils/seo.ts. Neither file may hold the
        // other's URL.
        const seo = fs.readFileSync(path.join(ROOT, 'utils', 'seo.ts'), 'utf8');
        expect(seo).not.toContain('linktr.ee');

        const sharing = fs.readFileSync(path.join(ROOT, 'utils', 'sharingLinks.ts'), 'utf8');
        expect(sharing).toContain("MAIN_SHARING_LINK = 'https://linktr.ee/sgcoalition'");
        // The sharing module may not claim to be the origin: the origin has
        // exactly one home, utils/seo.ts.
        expect(sharing).not.toMatch(/SITE_ORIGIN\s*=/);
    });
});
