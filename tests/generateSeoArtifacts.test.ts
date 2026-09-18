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

import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
    readStringField,
    readNumberField,
    buildSitemap,
    fetchPublishedPosts,
    getPostSeo,
    injectPrerenderedArticle,
    parseRegistryPosts,
    postArticleBlocks,
    postArticleHtml,
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

// A post's head was never the problem — its body was. The app renders a post from
// a network read, so the static page used to be a correct head over an empty
// #root, and a crawler or an AI reader got nothing. These tests pin that the text
// is in the served HTML, is built from the same row the page renders, and can
// never carry markup from the post body through to the page.
describe('SEO prerender — the post text is in the served HTML', () => {
    const post = (overrides: Record<string, unknown> = {}) => ({
        slug: 'coalition-pink-silver-crop-top',
        title: "Women's Leopard Print Crop T-Shirt",
        excerpt: 'Pink leopard print, 3D silver puff lettering, cut fitted.',
        content: '<p>Two prints on one piece.</p>',
        coverImage: '/images/pink-silver-crop-top-front.png',
        publishedAt: '2026-09-17T16:00:00.000Z',
        tags: ['drop'],
        category: 'drop',
        author: 'Founder',
        ...overrides,
    });

    const shell = '<html><head></head><body><div id="root"><div id="initial-loader"></div></div></body></html>';

    it('writes the article inside #root, ahead of the loader', () => {
        const page = injectPrerenderedArticle(shell, postArticleHtml(post()));
        expect(page).toContain('<article id="prerendered-post">');
        expect(page.indexOf('<article')).toBeGreaterThan(page.indexOf('<div id="root">'));
        // A reader that only takes the top of the page must see the post first,
        // not the "JavaScript is required" fallback that follows the loader.
        expect(page.indexOf('<article')).toBeLessThan(page.indexOf('initial-loader'));
    });

    it('fails loudly when there is no #root, rather than shipping a body-less page', () => {
        expect(() => injectPrerenderedArticle('<html><body></body></html>', '<article id="prerendered-post"></article>')).toThrow(
            /root/,
        );
    });

    it('leaves a page alone when there is no article to inject', () => {
        expect(injectPrerenderedArticle(shell, '')).toBe(shell);
    });

    it('ships the title, byline and body words', () => {
        const html = postArticleHtml(post());
        expect(html).toContain('<h1>Women\'s Leopard Print Crop T-Shirt</h1>');
        expect(html).toContain('<time datetime="2026-09-17T16:00:00.000Z">September 17, 2026</time>');
        expect(html).toContain('<p>Two prints on one piece.</p>');
    });

    it('falls back to the excerpt when a row carries no body', () => {
        expect(postArticleHtml(post({ content: '' }))).toContain('<p>Pink leopard print');
    });

    // The one rule that matters: nothing from the post body reaches the page as
    // markup. This builder writes every tag it emits, so the runtime allow-list in
    // utils/blogSanitize.ts stays the only sanitizer policy in the project.
    describe('no body markup survives', () => {
        it('drops embedded content entirely, attributes and all', () => {
            const html = postArticleHtml(
                post({
                    content: '<script>alert(1)</script><style>p{color:red}</style><p>Hello <strong>world</strong></p>'
                        + '<img src="https://i.imgur.com/x.png" onerror="alert(2)" alt="remote" style="width:100%">',
                }),
            );
            expect(html).not.toContain('alert(1)');
            expect(html).not.toContain('onerror');
            expect(html).not.toContain('style=');
            expect(html).not.toContain('color:red');
            expect(html).toContain('<p>Hello world</p>');
        });

        it('reduces links and inline markup to their words', () => {
            const html = postArticleHtml(
                post({ content: '<p>Read <a href="https://example.test/x" target="_blank">the notes</a> for <em>more</em>.</p>' }),
            );
            expect(html).toContain('<p>Read the notes for more.</p>');
        });

        it('decodes entities once and escapes what is left', () => {
            const html = postArticleHtml(
                post({ content: '<p>Tier 1 &mdash; 5% &amp; fees</p><p>A &lt; B and a raw < here</p>' }),
            );
            expect(html).toContain('<p>Tier 1 — 5% &amp; fees</p>');
            expect(html).toContain('<p>A &lt; B and a raw &lt; here</p>');
        });

        it('keeps only images whose src is already site-relative', () => {
            const html = postArticleHtml(
                post({
                    content: '<img src="/images/x.png" alt="a &quot;quoted&quot; caption">'
                        + '<img src="https://i.imgur.com/y.png" alt="remote">',
                }),
            );
            expect(html).toContain('<img src="/images/x.png" alt="a &quot;quoted&quot; caption" />');
            expect(html).not.toContain('i.imgur.com');
        });
    });

    describe('structure is preserved', () => {
        it('keeps headings, with the authored h1 demoted under the post title', () => {
            const html = postArticleHtml(post({ content: '<h1>One</h1><h2>Two</h2><h3>Three</h3>' }));
            expect(html).toContain('<h2>One</h2>');
            expect(html).toContain('<h2>Two</h2>');
            expect(html).toContain('<h3>Three</h3>');
            // Exactly one h1 on the page: the post's own title.
            expect(html.match(/<h1>/g)).toHaveLength(1);
            expect(html.match(/<h1>/g)![0]).toBeTruthy();
            expect(html.indexOf('<h1>')).toBeLessThan(html.indexOf('<h2>One</h2>'));
        });

        it('groups list items into one list and closes it before the next paragraph', () => {
            const html = postArticleHtml(post({ content: '<ul>\n<li>alpha</li>\n<li>beta</li>\n</ul>\n<p>after</p>' }));
            expect(html).toContain('<ul>\n    <li>alpha</li>\n    <li>beta</li>\n  </ul>\n  <p>after</p>');
            expect(html.match(/<ul>/g)).toHaveLength(1);
        });

        it('treats a blank line as a paragraph break, like the rendered page does', () => {
            const html = postArticleHtml(post({ content: 'one\n\ntwo' }));
            expect(html).toContain('<p>one</p>');
            expect(html).toContain('<p>two</p>');
        });
    });

    it('gets the body from the live row it was written from', async () => {
        const row = {
            slug: 'a-drop',
            title: 'A Drop',
            excerpt: '',
            content: '<h2>THE BUILD</h2>',
            cover_image: '/images/a.png',
            published_at: '2026-09-17T16:00:00.000Z',
            tags: [],
            category: 'drop',
            author: 'Founder',
        };
        const fetchMock = vi.fn(async () => new Response(JSON.stringify([row]), { status: 200 }));
        const originalFetch = globalThis.fetch;
        const previousUrl = process.env.VITE_SUPABASE_URL;
        const previousKey = process.env.VITE_SUPABASE_ANON_KEY;

        process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
        process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
        globalThis.fetch = fetchMock as unknown as typeof fetch;

        try {
            const rows = await fetchPublishedPosts();
            // Without `content` in the select the served article would be empty.
            expect(String(fetchMock.mock.calls[0][0])).toContain('content');
            expect(rows).toHaveLength(1);
            expect(rows[0].content).toBe('<h2>THE BUILD</h2>');
            expect(postArticleHtml(rows[0])).toContain('<h2>THE BUILD</h2>');
        } finally {
            globalThis.fetch = originalFetch;
            if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
            else process.env.VITE_SUPABASE_URL = previousUrl;
            if (previousKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
            else process.env.VITE_SUPABASE_ANON_KEY = previousKey;
        }
    });

    // The offline path has to carry the words too, or a build with no database
    // ships pages whose text exists only in the registry's template literals.
    it('gets the body from the drop registry, which authors it as a template literal', () => {
        const posts = parseRegistryPosts();
        const pink = posts.find((entry) => entry.slug === 'coalition-pink-silver-crop-top');
        expect(pink?.content).toContain('<h2>THE BUILD</h2>');
        expect(postArticleHtml(pink)).toContain('<h2>THE BUILD</h2>');
        expect(postArticleHtml(pink)).toContain('<li>Twelve pieces');

        for (const entry of posts) {
            expect(postArticleBlocks(entry.content).length, `${entry.slug} has no body text`).toBeGreaterThan(0);
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
