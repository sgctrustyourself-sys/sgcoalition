// tests/sharingLink.test.ts
//
// The brand has TWO public URLs, and they are not interchangeable:
//
//   STOREFRONT ORIGIN  https://sgcoalition-five.vercel.app
//                      the site itself — canonical tags, the sitemap,
//                      transactional email links, the CORS echo, the
//                      webhook URLs.
//
//   MAIN SHARING LINK  https://linktr.ee/sgcoalition
//                      what the brand prints when it says "link in bio".
//                      The linktree carries the portfolio next to the
//                      shop, so one URL does both jobs.
//
// Both mistakes are silent, which is why they need a test rather than a
// memory. Point the storefront origin at the linktree and the canonical
// tags and the sitemap start advertising a linktree as if it were the
// shop; point the sharing link at the storefront and "link in bio" lands a
// customer on a bare home page with no portfolio and no path to anything
// they made. Neither raises an error — the page still loads.
//
// What is pinned here:
//   1. the sharing link IS the linktree, and is NOT the storefront origin
//   2. every drop poster, CTA slide and caption prints THAT link
//   3. the storefront itself carries the portfolio link next to the shop
//      (footer, about page, product page) — the customer is looking at a
//      product, and the portfolio is one click away
//   4. no source file grows a second linktree handle behind the owner's back

import { describe, it, expect, vi } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import fs from 'node:fs';
import path from 'node:path';

import { MAIN_SHARING_LINK, MAIN_SHARING_LABEL } from '../utils/sharingLinks';
import { SITE_ORIGIN } from '../utils/seo';
import { DROPS, listDropSlugs } from '../scripts/story-reveal-specs/drops';

// The Footer reads the admin flag from the app context. The mock has to sit
// above the component import — vitest hoists it there, and the component
// import below the block is the pattern every render test in this repo uses.
vi.mock('../context/AppContext', () => ({
    useApp: () => ({ isAdminMode: false }),
}));

import { MemoryRouter } from 'react-router-dom';
import Footer from '../components/Footer';

const ROOT = process.cwd();
const releases = Object.values(DROPS);

describe('the main sharing link', () => {
    it('is the linktree the portfolio is carried on', () => {
        expect(MAIN_SHARING_LINK).toBe('https://linktr.ee/sgcoalition');
        expect(MAIN_SHARING_LABEL).toBe('linktr.ee/sgcoalition');
    });

    it('prints without a scheme, and links with one', () => {
        // A scheme in a caption stops looking like a link; a caption with no
        // scheme stops working as a link. Both forms come from one place.
        expect(MAIN_SHARING_LABEL).not.toMatch(/^https?:/);
        expect(MAIN_SHARING_LINK).toBe(`https://${MAIN_SHARING_LABEL}`);
    });

    it('is not the storefront origin', () => {
        // The two are different jobs. Conflating them either points the
        // canonical origin at a linktree, or points "link in bio" at a bare
        // home page with no portfolio on it.
        expect(MAIN_SHARING_LINK).not.toBe(SITE_ORIGIN);
        expect(MAIN_SHARING_LINK).not.toContain(SITE_ORIGIN);
        expect(SITE_ORIGIN).not.toContain('linktr.ee');
    });
});

describe('every drop points at the same link', () => {
    it('prints the main sharing link on its CTA slide and spec', () => {
        for (const release of releases) {
            const { slug } = release.spec;
            expect(release.spec.shopUrl, `${slug} shopUrl`).toBe(MAIN_SHARING_LABEL);
            const cta = release.spec.slides.find((s) => s.layout === 'cta');
            expect(cta?.url, `${slug} CTA url`).toBe(MAIN_SHARING_LABEL);
        }
    });

    it('prints the same link in the caption copy it pastes into social', () => {
        // The link a customer reads in the caption and the link the app
        // links to are the same link; a caption that names a different one
        // is a customer typing a URL that goes nowhere.
        for (const release of releases) {
            const { slug } = release.spec;
            const { copy } = release;
            expect(copy.igCaptionLong, `${slug} IG long caption`).toContain(MAIN_SHARING_LABEL);
            expect(copy.xSingle, `${slug} X caption`).toContain(MAIN_SHARING_LABEL);
            expect(copy.xThread[0], `${slug} X thread`).toContain(MAIN_SHARING_LABEL);
            expect(copy.slackOneLiner, `${slug} Slack line`).toContain(MAIN_SHARING_LABEL);
        }
    });

    it('covers every slug in the registry', () => {
        // Anti-vacuity: a registry that lost its entries would make the two
        // assertions above pass without checking anything.
        expect(listDropSlugs().length).toBeGreaterThan(0);
        expect(releases.length).toBe(listDropSlugs().length);
    });
});

describe('the storefront carries the portfolio link', () => {
    it('links the portfolio from the footer, the about page and the product page', () => {
        // The customer is looking at a product; the portfolio is one click
        // away. These three surfaces use the shared constant rather than a
        // pasted URL, so a link change cannot leave one of them behind.
        for (const file of ['components/Footer.tsx', 'pages/About.tsx', 'pages/ProductDetails.tsx']) {
            const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
            expect(source, `${file} must use the shared constant`).toContain('MAIN_SHARING_LINK');
            expect(source, `${file} must not paste its own link`).not.toContain('linktr.ee');
        }
    });

    it('renders a portfolio link in the footer', async () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root: Root = createRoot(container);

        try {
            await act(async () => {
                root.render(createElement(MemoryRouter, null, createElement(Footer)));
            });
            const html = container.innerHTML;

            // The link itself, with the href a customer clicks.
            expect(html).toContain(`href="${MAIN_SHARING_LINK}"`);
            // It opens in a new tab (it is a different origin) and carries
            // the noopener guard.
            expect(html).toContain('target="_blank"');
            expect(html).toContain('rel="noopener noreferrer"');
            // And it is labelled, not an anonymous icon.
            expect(html).toContain('Portfolio &amp; Links');
        } finally {
            await act(async () => {
                root.unmount();
            });
            if (container.parentNode === document.body) document.body.removeChild(container);
        }
    });
});

describe('one linktree, one handle', () => {
    it('has no second linktree handle anywhere in the source', () => {
        // A typo'd handle is a link that 404s in front of a customer, and it
        // is invisible until someone clicks it. Every linktree mention in the
        // source must name the one handle.
        const offenders: string[] = [];
        const walk = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
                if (entry.name === 'docs' || entry.name === '.vercel') continue;
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/i.test(entry.name)) continue;
                // This file names the handles it is checking, so it cannot
                // check itself.
                if (path.basename(full) === 'sharingLink.test.ts') continue;
                const content = fs.readFileSync(full, 'utf8');
                for (const match of content.matchAll(/linktr\.ee\/([A-Za-z0-9._-]+)/g)) {
                    if (match[1] !== 'sgcoalition') {
                        offenders.push(`${path.relative(ROOT, full)}: linktr.ee/${match[1]}`);
                    }
                }
            }
        };
        walk(ROOT);

        expect(
            offenders,
            `Only one linktree handle exists: ${MAIN_SHARING_LABEL}. Other handles 404 in front of a customer:\n${offenders.join('\n')}`,
        ).toEqual([]);
    });
});
