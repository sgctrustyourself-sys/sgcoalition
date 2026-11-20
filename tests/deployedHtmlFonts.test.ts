// tests/deployedHtmlFonts.test.ts
//
// Deployed HTML must load brand fonts from our own origin, never Google.
//
// Scan only the surfaces that can reach a deployment:
//   - the Vite shell (index.html)
//   - HTML copied verbatim from public/
//   - generated pages in dist/ (when a build is present)
//
// docs/ is deliberately absent: it holds local operator/reviewer aids and is
// not copied into dist or published by either deploy target.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { buildRouteSeo, injectSeo, STATIC_ROUTES } from '../scripts/generateSeoArtifacts.mjs';

const ROOT = path.join(__dirname, '..');
const GOOGLE_FONTS = /fonts\.googleapis\.com|fonts\.gstatic\.com/i;
const SELF_HOSTED_FONTS = '/fonts/fonts.css';

const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const toRepoPath = (absolute: string) => path.relative(ROOT, absolute).replace(/\\/g, '/');

const htmlFilesIn = (relativeDirectory: string): string[] => {
    const start = path.join(ROOT, relativeDirectory);
    if (!fs.existsSync(start)) return [];

    const found: string[] = [];
    const walk = (directory: string) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                walk(absolute);
            } else if (entry.isFile() && entry.name.endsWith('.html')) {
                found.push(toRepoPath(absolute));
            }
        }
    };

    walk(start);
    return found.sort();
};

const publicHtml = htmlFilesIn('public');
const distHtml = htmlFilesIn('dist');

// Tests may run before `vite build` (the release gate does). Generate one route
// page through the same injector the postbuild step uses, so the built-page
// assertion still has real output even when dist/ is absent.
const generatedRoutePage = injectSeo(read('index.html'), buildRouteSeo(STATIC_ROUTES[0]));

describe('deployed HTML fonts', () => {
    it('never references Google Fonts from the shell, public HTML, or built pages', () => {
        expect(publicHtml.length).toBeGreaterThan(0);

        const deployedPages = [
            { name: 'index.html', html: read('index.html') },
            ...publicHtml.map((relative) => ({ name: relative, html: read(relative) })),
            ...distHtml.map((relative) => ({ name: relative, html: read(relative) })),
        ];

        for (const page of deployedPages) {
            expect(page.html, `${page.name} must not load Google Fonts`).not.toMatch(GOOGLE_FONTS);
        }

        expect(generatedRoutePage, 'generated route page must not load Google Fonts').not.toMatch(GOOGLE_FONTS);
    });

    it('keeps the self-hosted font stylesheet on the app shell and generated pages', () => {
        expect(read('index.html')).toContain(SELF_HOSTED_FONTS);
        expect(generatedRoutePage).toContain(SELF_HOSTED_FONTS);

        // nojs.html and the legacy message are standalone pages copied from
        // public/; they intentionally carry no shared shell. Every other dist
        // page is generated from index.html and must retain its font stylesheet.
        // Compare deploy-relative paths so public/blog/x.html matches dist/blog/x.html.
        const publicPages = new Set(publicHtml.map((relative) => relative.replace(/^public\//, '')));
        for (const relative of distHtml) {
            const deployPath = relative.replace(/^dist\//, '');
            if (publicPages.has(deployPath)) continue;
            expect(read(relative), `${relative} must keep ${SELF_HOSTED_FONTS}`).toContain(SELF_HOSTED_FONTS);
        }
    });
});
