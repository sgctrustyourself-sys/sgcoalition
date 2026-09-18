// tests/generateSeoArtifacts.test.ts
//
// Regression test for scripts/generateSeoArtifacts.mjs.
//
// History: the parser originally expected unquoted object keys (`id: "..."`).
// When constants.ts was reformatted to use quoted keys (`"id": "..."`), the
// regex silently stopped matching every field, dropping the sitemap from 18
// product URLs to 0. The fix uses `String.raw` template literals so that
// `\b` and `\s` stay as proper regex escapes (not ASCII backspace / bare `s`).
//
// These tests lock in the fix so a future refactor can't reintroduce the bug.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    readStringField,
    readNumberField,
    buildSitemap,
    getPostSeo,
    parseRegistryPosts,
    STATIC_ROUTES,
} from '../scripts/generateSeoArtifacts.mjs';

describe('SEO parser — field extractors', () => {
    // REGRESSION CATCH: this is the exact failure mode that dropped the
    // sitemap to 0 product URLs. If readStringField ever stops matching
    // quoted keys again, this test fails immediately.
    describe('readStringField with quoted keys', () => {
        it('extracts a string field whose key is double-quoted', () => {
            const block = `{
    "id": "prod_test_item",
    "name": "Test Item",
    "description": "A test product",
    "category": "tees",
}`;
            expect(readStringField(block, 'id')).toBe('prod_test_item');
            expect(readStringField(block, 'name')).toBe('Test Item');
            expect(readStringField(block, 'description')).toBe('A test product');
            expect(readStringField(block, 'category')).toBe('tees');
        });

        it('extracts a string field whose key is single-quoted', () => {
            const block = `{
    'id': 'prod_test_item',
    'name': 'Test Item',
}`;
            expect(readStringField(block, 'id')).toBe('prod_test_item');
            expect(readStringField(block, 'name')).toBe('Test Item');
        });
    });

    // Backward compatibility: the old (unquoted) form must still work.
    describe('readStringField with unquoted keys', () => {
        it('extracts a string field whose key is unquoted', () => {
            const block = `{
    id: "prod_legacy_item",
    name: "Legacy Item",
}`;
            expect(readStringField(block, 'id')).toBe('prod_legacy_item');
            expect(readStringField(block, 'name')).toBe('Legacy Item');
        });
    });

    // The \b word boundary must prevent `id` from matching inside `tokenId`.
    describe('readStringField word-boundary safety', () => {
        it('does not match `id` inside `tokenId`', () => {
            const block = `{
    "tokenId": "tok_should_not_match",
    "id": "prod_should_match",
}`;
            expect(readStringField(block, 'id')).toBe('prod_should_match');
        });

        it('does not match `name` inside `displayName`', () => {
            const block = `{
    "displayName": "Display Name",
    "name": "Real Name",
}`;
            expect(readStringField(block, 'name')).toBe('Real Name');
        });

        it('does not match `archived` inside `archivedAt`', () => {
            const block = `{
    "archivedAt": "2024-01-01",
    "archived": "should-not-pick-this-up",
}`;
            // The \b boundary ensures we match `archived:` not `archivedAt:`.
            expect(readStringField(block, 'archived')).toBe('should-not-pick-this-up');
        });
    });

    // REGRESSION CATCH: price must extract as a number, not a string.
    describe('readNumberField', () => {
        it('extracts price from a quoted-key block as a number', () => {
            const block = `{
    "id": "prod_test_item",
    "name": "Test Item",
    "price": 99.99,
}`;
            expect(readNumberField(block, 'price')).toBe(99.99);
            expect(typeof readNumberField(block, 'price')).toBe('number');
        });

        it('extracts price from an unquoted-key block as a number', () => {
            const block = `{
    id: "prod_legacy",
    name: "Legacy",
    price: 49,
}`;
            expect(readNumberField(block, 'price')).toBe(49);
        });

        it('returns 0 for a missing field', () => {
            const block = `{
    "id": "prod_test",
    "name": "Test",
}`;
            expect(readNumberField(block, 'price')).toBe(0);
        });
    });
});

describe('SEO parser — full block regression', () => {
    // End-to-end shape check: this is the exact scenario that broke in
    // production. A block shaped like a real constants.ts entry (quoted
    // keys) must yield the correct id, name, and price through the
    // readStringField / readNumberField helpers.
    it('extracts id, name, and price from a realistic quoted-key block', () => {
        const block = `{
        "id": "prod_womens_coalition_halo_contrast_tee",
        "name": "Women's Coalition Halo Contrast Tee",
        "description": "Premium streetwear tee with contrast halo detail.",
        "category": "tees",
        "price": 65,
        "images": ["/img/tee-front.png", "/img/tee-back.png"],
        "archived": false,
        "isLimitedEdition": true,
    }`;    expect(readStringField(block, 'id')).toBe('prod_womens_coalition_halo_contrast_tee');
    expect(readStringField(block, 'name')).toBe("Women's Coalition Halo Contrast Tee");
    expect(readNumberField(block, 'price')).toBe(65);
    });
});

// REGRESSION CATCH: the buildSitemap helper pins the priority +
// changefreq assignment so a future refactor cannot silently roll back the
// limited-edition exception. Background: the prior rule demoted any product
// with archived=true OR soldAt=... to monthly/0.6, which made every numbered
// limited wallet (Coalition 'Racing Team' 1/4 → 4/4, etc.) drop out of the
// high-value cluster the moment it sold. The operator's directive on
// 2026-07-14 was "archive limited editions stay at weekly/0.8 because
// they keep drawing long-tail queries" — this test is the lock that future
// refactors can't revert that intent.
describe('SEO sitemap priorities', () => {
    const ACTIVE_STANDARD = 'prod_active_standard';
    const ARCHIVED_STANDARD = 'prod_archived_standard';
    const ARCHIVED_LIMITED = 'prod_archived_limited';

    // The helper's full Product type has more fields than the synthetic
    // fixtures supply here. Cast through Parameters<typeof buildSitemap>[0]
    // once at the helper boundary so each assertion stays clean — and so a
    // future refactor that loosens the helper's parameter type doesn't
    // break the test through a stale `@ts-expect-error`.
    const sitemapFor = (
        products: Array<{ id: string; archived: boolean; soldAt?: string | null; isLimitedEdition?: boolean }>,
    ) => buildSitemap(products as Parameters<typeof buildSitemap>[0]);

    const rowRegex = (id: string, changefreq: 'weekly' | 'monthly', priority: '0.8' | '0.6') =>
        new RegExp(
            `<loc>${`https://sgcoalition.xyz/product/${id}`}<\\/loc>\\s*` +
                `<lastmod>[\\d-]+<\\/lastmod>\\s*` +
                `<changefreq>${changefreq}<\\/changefreq>\\s*` +
                `<priority>${priority}<\\/priority>`,
        );

    it('keeps active non-limited products at 0.8/weekly', () => {
        const xml = sitemapFor([
            { id: ACTIVE_STANDARD, archived: false, soldAt: null, isLimitedEdition: false },
        ]);
        expect(xml).toMatch(rowRegex(ACTIVE_STANDARD, 'weekly', '0.8'));
    });

    it('demotes standard archived products to 0.6/monthly', () => {
        const xml = sitemapFor([
            { id: ARCHIVED_STANDARD, archived: true, soldAt: '2024-01-01T00:00:00Z', isLimitedEdition: false },
        ]);
        expect(xml).toMatch(rowRegex(ARCHIVED_STANDARD, 'monthly', '0.6'));
    });

    it('keeps limited-edition archived products at 0.8/weekly', () => {
        const xml = sitemapFor([
            { id: ARCHIVED_LIMITED, archived: true, soldAt: '2024-01-01T00:00:00Z', isLimitedEdition: true },
        ]);
        expect(xml).toMatch(rowRegex(ARCHIVED_LIMITED, 'weekly', '0.8'));
    });

    it('mixes active + archived standard + archived limited correctly', () => {
        const xml = sitemapFor([
            { id: ACTIVE_STANDARD, archived: false, soldAt: null, isLimitedEdition: false },
            { id: ARCHIVED_STANDARD, archived: true, soldAt: '2024-01-01T00:00:00Z', isLimitedEdition: false },
            { id: ARCHIVED_LIMITED, archived: true, soldAt: '2024-01-01T00:00:00Z', isLimitedEdition: true },
        ]);
        expect(xml).toMatch(rowRegex(ACTIVE_STANDARD, 'weekly', '0.8'));
        expect(xml).toMatch(rowRegex(ARCHIVED_STANDARD, 'monthly', '0.6'));
        expect(xml).toMatch(rowRegex(ARCHIVED_LIMITED, 'weekly', '0.8'));
    });

    it('demotes soldAt-only products (no archived flag) to 0.6/monthly when not a limited edition', () => {
        // Coalition_x_True_Religion_S1-style row: archived=false but soldAt
        // is set by the archive override. The rule still applies the demotion
        // because the predicate is (archived || soldAt) && !isLimitedEdition.
        const soldNoArchive = 'prod_sold_no_archive';
        const xml = sitemapFor([
            { id: soldNoArchive, archived: false, soldAt: '2026-03-06T00:00:00+00:00', isLimitedEdition: false },
        ]);
        expect(xml).toMatch(rowRegex(soldNoArchive, 'monthly', '0.6'));
    });

    it('keeps soldAt-only products (no archived flag) at 0.8/weekly when they are a limited edition', () => {
        // Symmetric to the previous test: same shape (soldAt set, archived
        // not yet flipped), but isLimitedEdition=true keeps the row in the
        // active-product cluster. Locks the limited branch of the rule and
        // prevents the previous test's name from being misleading.
        const soldNoArchiveLimited = 'prod_sold_no_archive_limited';
        const xml = sitemapFor([
            { id: soldNoArchiveLimited, archived: false, soldAt: '2026-03-06T00:00:00+00:00', isLimitedEdition: true },
        ]);
        expect(xml).toMatch(rowRegex(soldNoArchiveLimited, 'weekly', '0.8'));
    });
});

// A route advertised in sitemap.xml but missing from STATIC_ROUTES would ship
// no prerendered page, so its URL would serve the generic SPA shell whose
// canonical is "/" — every sitemap route silently claiming to be the homepage.
// That is precisely how /membership, /about, /wallets, /sgcoin, /help,
// /live-orders and /community were broken, so pin the two lists together.
describe('SEO sitemap and prerendered routes agree', () => {
    const staticLocs = (buildSitemap([]) as string)
        .match(/<loc>[^<]*/g)!
        .map((loc) => loc.replace('<loc>', '').replace('https://sgcoalition.xyz', ''))
        .filter((loc) => !loc.startsWith('/product/'));

    // Hardcoded on purpose. Because the sitemap is now DERIVED from
    // STATIC_ROUTES, asserting the two agree is tautological — deleting a
    // route would remove it from both and still pass. Pinning the expected set
    // means dropping a route (which silently deletes its prerendered page and
    // its sitemap entry, an invisible SEO regression) has to be deliberate.
    it('covers exactly the static routes the site ships', () => {
        expect(STATIC_ROUTES.map((route) => route.path).sort()).toEqual(
            [
                '/about',
                '/archive',
                '/blog',
                '/community',
                '/help',
                '/live-orders',
                '/membership',
                '/sgcoin',
                '/shop',
                '/wallets',
            ].sort(),
        );
    });

    it('keeps the sitemap derived from that same list (no second route list)', () => {
        // Guards the original bug's shape: a route advertised in sitemap.xml
        // with no prerendered page behind it.
        const prerendered = STATIC_ROUTES.map((route) => route.path);
        // '/' is the only exception: dist/index.html is already its page.
        expect([...staticLocs].sort()).toEqual(['/', ...prerendered].sort());
    });

    it('gives every prerendered route the meta crawlers need', () => {
        for (const route of STATIC_ROUTES) {
            expect(route.title, `${route.path} title`).toBeTruthy();
            expect(route.description, `${route.path} description`).toBeTruthy();
            expect(route.priority, `${route.path} priority`).toBeTruthy();
            expect(route.changefreq, `${route.path} changefreq`).toBeTruthy();
        }
    });
});

// A blog post is the third kind of page the generator writes (after static
// routes and products). It is not a STATIC_ROUTES entry on purpose: a static
// route must own a generated share card, while a post's share image is its own
// cover photo. What must hold is the same rule as everywhere else — anything in
// sitemap.xml has a prerendered page behind it, so a post URL can never serve
// the shell whose canonical is "/".
describe('SEO sitemap — blog posts', () => {
    const post = (overrides: Record<string, unknown> = {}) => ({
        slug: 'coalition-pink-silver-crop-top',
        title: "Women's Leopard Print Crop T-Shirt",
        excerpt: 'Pink leopard print, 3D silver puff lettering, cut fitted.',
        coverImage: '/images/pink-silver-crop-top-front.png',
        publishedAt: '2026-09-17T16:00:00.000Z',
        tags: ['drop', 'limited'],
        category: 'drop',
        ...overrides,
    });

    const locsOf = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    it('advertises every post it can build a page for', () => {
        const xml = buildSitemap([], [post()]);
        expect(locsOf(xml)).toContain('https://sgcoalition.xyz/blog/coalition-pink-silver-crop-top');
        expect(getPostSeo(post()).path).toBe('/blog/coalition-pink-silver-crop-top');
    });

    // The build date every other entry carries says nothing about a post; the
    // publication date is the signal a crawler actually uses to decide what is new.
    it('dates a post row by its publication date, not the build date', () => {
        const xml = buildSitemap([], [post()]);
        expect(xml).toMatch(
            /<loc>https:\/\/sgcoalition\.xyz\/blog\/coalition-pink-silver-crop-top<\/loc>\s*<lastmod>2026-09-17<\/lastmod>/,
        );
    });

    it('falls back to the build date when a post has no usable date', () => {
        const today = new Date().toISOString().slice(0, 10);
        const xml = buildSitemap([], [post({ publishedAt: 'not a date' })]);
        expect(xml).toContain(`<lastmod>${today}</lastmod>`);
    });

    it('keeps posts out of the sitemap when there are none (no stray /blog/ entries)', () => {
        const xml = buildSitemap([]);
        expect(locsOf(xml).filter((loc) => loc.includes('/blog/'))).toEqual([]);
    });

    it('ships a non-empty description and a working image rule', () => {
        const withCover = getPostSeo(post());
        // A cover photo is announced as itself, with NO declared size: a 1200x630
        // declaration on a photo of another shape makes scrapers crop it.
        expect(withCover.image).toBe('https://sgcoalition.xyz/images/pink-silver-crop-top-front.png');
        expect([withCover.imageWidth, withCover.imageHeight]).toEqual([undefined, undefined]);
        expect(withCover.type).toBe('article');
        expect(withCover.description.length).toBeGreaterThan(20);

        const withoutCover = getPostSeo(post({ coverImage: '' }));
        expect(withoutCover.image).toBe('https://sgcoalition.xyz/og/card.jpg');
        expect([withoutCover.imageWidth, withoutCover.imageHeight]).toEqual([1200, 630]);
    });

    // The offline path: `posts` lives in Supabase, and a build must not depend on
    // a network read, so the registry is parsed instead. This pins that the
    // fallback yields real pages rather than an empty list that silently ships
    // every post as the generic shell.
    it('parses the drop registry into post rows when the table is unreachable', () => {
        const posts = parseRegistryPosts();
        expect(posts.length).toBeGreaterThan(0);

        const pink = posts.find((row) => row.slug === 'coalition-pink-silver-crop-top');
        expect(pink, 'the published drop is missing from the registry fallback').toBeTruthy();
        expect(pink.title).toContain('Leopard Print Crop T-Shirt');
        expect(pink.excerpt).toBeTruthy();
        // The spec's render path is ../../public/images/<name>.png; a post row
        // needs the served path, or the cover resolves to a broken URL.
        expect(pink.coverImage).toBe('/images/pink-silver-crop-top-front.png');
        expect(pink.publishedAt).toBe('2026-09-17T16:00:00.000Z');
        expect(pink.tags).toContain('pink-silver');

        // Every fallback post must also be sitemap-advertisable and page-buildable.
        for (const row of posts) {
            expect(getPostSeo(row).description, `${row.slug} description`).toBeTruthy();
            expect(getPostSeo(row).title).toContain(row.title);
        }
        const xml = buildSitemap([], posts);
        for (const row of posts) {
            expect(locsOf(xml)).toContain(`https://sgcoalition.xyz${getPostSeo(row).path}`);
        }
    });
});

// The prerendered pages only exist if the generator runs AFTER `vite build`.
// Before that was wired, main() ran only in prebuild, always bailed at the
// `dist/index.html` existence check, and silently emitted nothing — which is
// how the hand-maintained no-JS mirrors in public/ came to exist. Dropping the
// postbuild hook would delete /shop, /archive and all 30 product pages again
// without failing any build, so pin the wiring rather than the output.
describe('SEO generator — build wiring (two-phase contract)', () => {
    const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
    const pkg = JSON.parse(read('package.json'));

    it('runs the generator after the bundle exists (postbuild)', () => {
        expect(pkg.scripts.postbuild).toContain('generateSeoArtifacts.mjs');
    });

    it('still runs the generator before the bundle (prebuild) for sitemap + robots', () => {
        expect(pkg.scripts.prebuild).toContain('generateSeoArtifacts.mjs');
    });

    it('keeps the Vercel build command going through npm, so both hooks fire', () => {
        // Vercel runs buildCommand verbatim; switching it to `vite build`
        // would skip the npm pre/post lifecycle and silently drop every
        // prerendered page from the deployment.
        const vercel = JSON.parse(read('vercel.json'));
        expect(vercel.buildCommand).toBe('npm run build');
    });
});
