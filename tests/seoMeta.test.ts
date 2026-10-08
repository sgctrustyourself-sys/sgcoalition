// tests/seoMeta.test.ts
//
// Pins how a route presents in search results and in social shares.
//
// Two failure classes this covers:
//   1. Drift between the prerendered head (scripts/generateSeoArtifacts.mjs) and
//      the hydrated head (components/Seo.tsx + utils/seo.ts). Scrapers read the
//      prerendered copy and people see the hydrated one, so a rule that lives in
//      only one of the two ships two different descriptions of the same page.
//   2. An incomplete share block — no declared image size, no alt text. X,
//      Facebook, LinkedIn and Slack pick between a small thumbnail and a
//      full-width card from og:image:width/height, so a missing size quietly
//      demotes every share of the site.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';    import {
        buildRouteSeo,
        getPostSeo as getPrerenderedPostSeo,
        getProductSeo as getPrerenderedProductSeo,
        injectSeo,
        postJsonLd as prerenderedPostJsonLd,
        productJsonLd as prerenderedProductJsonLd,
        shareCardPath,
        STATIC_ROUTES,
    } from '../scripts/generateSeoArtifacts.mjs';
import { BLOG_POST_PAGE, PRODUCT_PAGE, ROUTE_PAGES, readPage } from './_helpers/routePages';
import {
    DEFAULT_SEO_IMAGE,
    DEFAULT_SEO_IMAGE_ALT,
    DEFAULT_SEO_IMAGE_HEIGHT,
    DEFAULT_SEO_IMAGE_WIDTH,
    SHARE_CARD_ROUTES,
    absoluteUrl,
    buildBlogPostJsonLd,
    buildProductTitle,
    getBlogPostSeo,
    getProductSeo,
    buildProductJsonLd,
    PRODUCT_TITLE_SUFFIX_MAX_NAME,
    shareCardImage,
} from '../utils/seo';
import type { BlogPost } from '../types';

const ROOT = path.join(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

// The runtime reads inventory from sizeInventory; the prerenderer sums the same
// numbers into `stock` because it cannot import getProductStock. Fixtures carry
// both so a divergence in how either side decides "sold out" fails here.
const productFixture = (overrides: Record<string, unknown> = {}) => ({
    id: 'prod_fixture',
    name: 'Coalition Test Wallet 1/1',
    description: 'A hand-cut wallet with a test description long enough to be used verbatim in the snippet.',
    category: 'wallet',
    price: 85,
    images: ['/images/grey-wave-wallet-1-2-front.png'],
    archived: false,
    soldAt: '',
    isLimitedEdition: false,
    sizeInventory: { 'One Size': 1 },
    stock: 1,
    ...overrides,
}) as never;

const imageSizeOf = (file: string) => {
    const buffer = fs.readFileSync(file);
    if (buffer.slice(1, 4).toString() === 'PNG') {
        return { format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        let offset = 2;
        while (offset < buffer.length) {
            if (buffer[offset] !== 0xff) { offset += 1; continue; }
            const marker = buffer[offset + 1];
            const length = buffer.readUInt16BE(offset + 2);
            if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                return { format: 'jpeg', height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
            }
            offset += 2 + length;
        }
    }
    return { format: 'unknown' };
};

describe('share cards — the committed assets match the meta that advertises them', () => {
    it('is a real 1200x630 image at the path every route shares', () => {
        expect(DEFAULT_SEO_IMAGE).toBe('/og/card.jpg');
        const file = path.join(ROOT, 'public', DEFAULT_SEO_IMAGE.replace(/^\//, ''));
        expect(fs.existsSync(file), `${DEFAULT_SEO_IMAGE} is missing`).toBe(true);

        const size = imageSizeOf(file);
        expect(size.format, 'share card is not a real PNG/JPEG').not.toBe('unknown');
        // The extension must match the bytes: the previous share image was a JPEG
        // named .png and was served as image/png.
        expect(path.extname(file).replace('.', '')).toBe(size.format === 'jpeg' ? 'jpg' : size.format);
        expect([size.width, size.height]).toEqual([DEFAULT_SEO_IMAGE_WIDTH, DEFAULT_SEO_IMAGE_HEIGHT]);
        // Scrapers need at least 1200x630 for a full-width preview.
        expect(size.width).toBeGreaterThanOrEqual(1200);
        expect(size.height).toBeGreaterThanOrEqual(630);
    });

    // A route with no card of its own unfurls as the generic brand card — which
    // is fine, but a route that DECLARES a card headline must have the file, or the
    // share is a broken image on every platform at once.
    it('has a committed card for every route that declares a headline', () => {
        for (const route of STATIC_ROUTES) {
            expect(route.cardTitle, `${route.path} has no cardTitle`).toBeTruthy();
            expect(route.cardTitle.length, `${route.path} cardTitle is too long to set`).toBeLessThanOrEqual(24);

            const cardPath = shareCardImage(route.path);
            const file = path.join(ROOT, 'public', cardPath.replace(/^\//, ''));
            expect(fs.existsSync(file), `${route.path} → ${cardPath} is missing`).toBe(true);

            const size = imageSizeOf(file);
            expect(size.format, `${cardPath} is not a JPEG`).toBe('jpeg');
            expect([size.width, size.height], `${cardPath} size`).toEqual([
                DEFAULT_SEO_IMAGE_WIDTH,
                DEFAULT_SEO_IMAGE_HEIGHT,
            ]);
            expect(fs.statSync(file).size, `${cardPath} is too heavy to unfurl quickly`).toBeLessThan(400 * 1024);
        }
    });

    it('keeps the carded-route list, the generator and each headline in step', () => {
        const declared = STATIC_ROUTES.filter((route) => route.cardTitle).map((route) => route.path);
        expect(declared.sort()).toEqual([...SHARE_CARD_ROUTES].sort());

        const headlines = STATIC_ROUTES.map((route) => route.cardTitle);
        expect(new Set(headlines).size, 'two routes share a card headline').toBe(headlines.length);
    });

    it('keeps the runtime and prerenderer path rules identical', () => {
        for (const route of STATIC_ROUTES) {
            expect(shareCardPath(route.path)).toBe(shareCardImage(route.path));
        }
        for (const routePath of ['/', '', '/custom-wallets', '/blog']) {
            expect(shareCardPath(routePath)).toBe(shareCardImage(routePath));
        }
    });

    it('resolves a route to its own card, and anything else to the generic one', () => {
        expect(shareCardImage('/shop')).toBe('/og/shop.jpg');
        expect(shareCardImage('/live-orders')).toBe('/og/live-orders.jpg');
        expect(shareCardImage('/blog')).toBe('/og/blog.jpg');
        // Trailing slash, query and hash all resolve to the same card.
        expect(shareCardImage('/membership/')).toBe('/og/membership.jpg');
        expect(shareCardImage('/shop?sort=new')).toBe('/og/shop.jpg');
        expect(shareCardImage('/shop#drops')).toBe('/og/shop.jpg');
        // No card was generated for these, so they must not point at a 404. A blog
        // POST is in this group on purpose: its image is its own cover photo, and
        // a post with no cover falls back to the generic card.
        for (const routePath of ['/', '', '/custom-wallets', '/blog/a-post-slug', '/profile', '/admin']) {
            expect(shareCardImage(routePath), routePath).toBe(DEFAULT_SEO_IMAGE);
        }
    });

    it('prerenders exactly what the runtime resolves, per route', () => {
        for (const route of STATIC_ROUTES) {
            const seo = buildRouteSeo(route);
            expect(seo.image, `${route.path} share image`).toBe(absoluteUrl(shareCardImage(route.path)));
            expect([seo.imageWidth, seo.imageHeight]).toEqual([DEFAULT_SEO_IMAGE_WIDTH, DEFAULT_SEO_IMAGE_HEIGHT]);
            // components/Seo.tsx builds the same string from the same title.
            expect(seo.imageAlt).toBe(`${route.title} share card`);
            expect(seo.imageAlt).not.toBe(DEFAULT_SEO_IMAGE_ALT);
        }
    });
});

// A blog post's head has the same two owners as a product's: the prerenderer
// writes the served copy and <Seo> writes the hydrated copy, from a pair of
// builders that cannot import each other (the generator is plain Node). Nothing
// here is allowed to drift, because a scraper reads one and a visitor gets the
// other.
describe('blog post search copy — prerendered and runtime agree', () => {
    const postFixture = (overrides: Record<string, unknown> = {}): BlogPost => ({
        id: 'post_fixture',
        title: "Women's Leopard Print Crop T-Shirt",
        slug: 'coalition-pink-silver-crop-top',
        content: '<p>Pink leopard print, 3D silver puff lettering, cut fitted.</p>',
        excerpt: 'Pink leopard print, 3D silver puff lettering, cut fitted. A 12-piece run, finished in-house.',
        author: 'Coalition',
        category: 'drop',
        coverImage: '/images/pink-silver-crop-top-front.png',
        tags: ['drop', 'limited', 'pink-silver'],
        isPublished: true,
        upvotePower: 0,
        downvotePower: 0,
        score: 0,
        publishedAt: '2026-09-17T16:00:00.000Z',
        createdAt: '2026-09-17T16:00:00.000Z',
        updatedAt: '2026-09-17T16:00:00.000Z',
        ...overrides,
    }) as BlogPost;

    const cases: Array<[string, Record<string, unknown>]> = [
        ['a post with a cover photo', {}],
        ['a post with no cover photo', { coverImage: undefined }],
        ['a post with no excerpt (description from the body)', { excerpt: '' }],
        ['a title that already names the brand', { title: 'Coalition Fleece Hoodie' }],
        ['an excerpt long enough to truncate', { excerpt: 'Pink leopard print, 3D silver puff lettering, cut fitted, and a run of twelve pieces that is finished in-house in Baltimore by hand, sized S through XL, with no reprints and no restocks once it sells out for good.' }],
        ['an external cover image (a hosted photo)', { coverImage: 'https://i.imgur.com/iYBlwm8.png' }],
        ['a post whose date is unusable', { publishedAt: 'not a date', createdAt: 'also not a date' }],
        ['a post with no tags', { tags: [] }],
    ];

    for (const [label, overrides] of cases) {
        it(`writes the same head for ${label}`, () => {
            const post = postFixture(overrides);
            const runtime = getBlogPostSeo(post);
            const prerendered = getPrerenderedPostSeo(post);

            expect(prerendered.title).toBe(runtime.title);
            expect(prerendered.description).toBe(runtime.description);
            expect(prerendered.image).toBe(runtime.image);
            expect(prerendered.imageAlt).toBe(runtime.imageAlt);
            expect(prerendered.imageWidth).toBe(runtime.imageWidth);
            expect(prerendered.imageHeight).toBe(runtime.imageHeight);
            expect(prerendered.url).toBe(runtime.url);
            expect(prerendered.path).toBe(runtime.path);
            expect(prerendered.type).toBe(runtime.type);
        });

        it(`writes the same structured data for ${label}`, () => {
            const post = postFixture(overrides);
            expect(prerenderedPostJsonLd(post)).toEqual(buildBlogPostJsonLd(post));
        });
    }

    it('never leaves a post with an empty or generic description', () => {
        const bare = postFixture({ excerpt: '', content: '' });
        const seo = getBlogPostSeo(bare);

        expect(seo.description.length).toBeGreaterThan(20);
        expect(seo.description).toContain('Leopard Print Crop T-Shirt');
        expect(getPrerenderedPostSeo(bare).description).toBe(seo.description);
    });

    it('announces a cover photo as an article, never as the site default', () => {
        const seo = getBlogPostSeo(postFixture());
        expect(seo.imageAlt).not.toBe(DEFAULT_SEO_IMAGE_ALT);
        expect(seo.image).not.toBe(absoluteUrl(DEFAULT_SEO_IMAGE));
        expect([seo.imageWidth, seo.imageHeight]).toEqual([undefined, undefined]);
    });

    // Same rule as the product page: the one page allowed to override the route's
    // share image must also supply the alt text, or hydration replaces the served
    // alt with a different string for the same image.
    it('feeds the post page its cover image and the matching alt text', () => {
        const source = readPage(BLOG_POST_PAGE);
        expect(source).toContain('image={post.coverImage ? postSeo.image : undefined}');
        expect(source).toContain('imageAlt={post.coverImage ? postSeo.imageAlt : undefined}');
        expect(source).toContain('canonicalPath={postSeo.path}');
    });
});

describe('product search copy — prerendered and runtime agree', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
        ['a plain available product', {}],
        ['a long product name', { name: "WOMEN'S COALITION ABOVE AS BELOW CREWNECK CROP TANK" }],
        ['a name at the suffix boundary', { name: 'x'.repeat(PRODUCT_TITLE_SUFFIX_MAX_NAME) }],
        ['a name just over the boundary', { name: 'x'.repeat(PRODUCT_TITLE_SUFFIX_MAX_NAME + 1) }],
        ['an empty description', { description: '' }],
        ['a one-word description', { description: 'Nice.' }],
        ['an archived piece', { archived: true, soldAt: '2026-06-25T02:40:12.191+00:00' }],
        ['a stock-out piece that is not archived', { sizeInventory: { S: 0, M: 0 }, stock: 0 }],
        ['a limited edition', { isLimitedEdition: true }],
        ['a description with escape remnants and a price', { description: 'Custom trucker hat with 3D puff \\ lettering.' }],
    ];

    for (const [label, overrides] of cases) {
        it(`writes the same title, description and image alt for ${label}`, () => {
            const product = productFixture(overrides);
            const runtime = getProductSeo(product);
            const prerendered = getPrerenderedProductSeo(product);

            expect(prerendered.title).toBe(runtime.title);
            expect(prerendered.description).toBe(runtime.description);
            expect(prerendered.imageAlt).toBe(runtime.imageAlt);
            expect(prerendered.url).toBe(runtime.url);
        });

        it(`agrees on availability for ${label}`, () => {
            const product = productFixture(overrides);
            expect(prerenderedProductJsonLd(product).offers.availability).toBe(
                buildProductJsonLd(product).offers.availability,
            );
        });
    }

    it('drops the brand suffix only when the name would overflow a result', () => {
        expect(buildProductTitle('Coalition Test Wallet')).toBe('Coalition Test Wallet | Coalition');
        expect(buildProductTitle('x'.repeat(PRODUCT_TITLE_SUFFIX_MAX_NAME))).toContain('| Coalition');
        expect(buildProductTitle('x'.repeat(PRODUCT_TITLE_SUFFIX_MAX_NAME + 1))).not.toContain('| Coalition');
        expect(getProductSeo(productFixture({ name: 'x'.repeat(63) })).title.length).toBeLessThanOrEqual(63);
    });

    it('replaces a thin description instead of shipping a 19-character snippet', () => {
        const seo = getProductSeo(productFixture({ description: '', price: 85 }));
        expect(seo.description.startsWith('Available now.')).toBe(true);
        expect(seo.description).toContain('Coalition Test Wallet 1/1');
        expect(seo.description).toContain('handcrafted in Baltimore');
        expect(seo.description).toContain('$85');
        expect(seo.description.length).toBeGreaterThan(45);
    });

    it('does not call a numbered piece a one-of-one', () => {
        const seo = getProductSeo(productFixture({ name: 'COALITION ABOVE AS BELOW 2/4 WALLET', description: '' }));
        expect(seo.description).not.toMatch(/one-of-one/i);
        expect(seo.description).toContain('a Coalition wallet');
    });

    it('strips escape remnants so snippets read cleanly', () => {
        const seo = getProductSeo(
            productFixture({ description: 'A one-of-one custom trucker hat featuring 3D puff \\ lettering on the front panel.' }),
        );
        expect(seo.description).not.toContain('\\');
    });
});

// <Seo> resolves a route's share card from the route itself when the page passes
// no image. That only holds while the pages leave the prop alone — a page that
// passed its own image would silently unfurl as a product-style card while the
// prerendered head (and its /og/<route>.jpg file) still advertise the route card.
describe('share cards — the pages leave the choice to the route', () => {
    it('never overrides the share image from a prerendered route page', () => {
        for (const [routePath, file] of Object.entries(ROUTE_PAGES)) {
            const source = readPage(file);
            if (!source.includes('<Seo')) continue;

            expect(source, `${routePath} (${file}) passes its own share image`).not.toContain('image={');
        }
    });

    // The product page is the one legitimate override, and its alt text has to
    // come from getProductSeo — hydration replaces the served alt otherwise.
    it('announces a product photo with the product alt text', () => {
        expect(readPage(PRODUCT_PAGE)).toContain('imageAlt={productSeo.imageAlt}');
    });
});

describe('share metadata block — complete, and free of inherited tags', () => {
    const head = (html: string) => html.slice(0, html.indexOf('</head>'));

    const baseHtml = `<!DOCTYPE html><html><head>
  <title>Coalition | Crafted in Baltimore</title>
  <meta name="description" content="homepage description" />
  <meta property="og:image" content="https://sgcoalition.xyz/og-card.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="homepage alt" />
  <link rel="canonical" href="https://sgcoalition.xyz/" />
</head><body><div id="root"></div></body></html>`;

    const routeSeo = {
        title: 'Coalition | Help Center',
        description: 'Answers on orders, shipping, returns, membership and SGCOIN.',
        image: 'https://sgcoalition.xyz/og-card.jpg',
        imageAlt: 'Coalition wordmark beside the Coalition hero artwork — crafted in Baltimore',
        imageWidth: 1200,
        imageHeight: 630,
        url: 'https://sgcoalition.xyz/help',
        type: 'website',
    };

    it('writes every tag a scraper reads', () => {
        const output = injectSeo(baseHtml, routeSeo, undefined);
        const tags = head(output);

        for (const needle of [
            '<title>Coalition | Help Center</title>',
            'name="description" content="Answers on orders, shipping, returns, membership and SGCOIN."',
            'name="robots" content="index,follow"',
            'property="og:title" content="Coalition | Help Center"',
            'property="og:image" content="https://sgcoalition.xyz/og-card.jpg"',
            'property="og:image:width" content="1200"',
            'property="og:image:height" content="630"',
            'property="og:image:alt"',
            'property="og:locale" content="en_US"',
            'property="og:url" content="https://sgcoalition.xyz/help"',
            'property="og:type" content="website"',
            'name="twitter:card" content="summary_large_image"',
            'name="twitter:image" content="https://sgcoalition.xyz/og-card.jpg"',
            'name="twitter:image:alt"',
            'rel="canonical" href="https://sgcoalition.xyz/help"',
        ]) {
            expect(tags, `missing ${needle}`).toContain(needle);
        }
    });

    it('drops the share card size for a page with its own image', () => {
        const productSeo = {
            title: 'Coalition Test Wallet 1/1',
            description: 'A hand-cut wallet.',
            image: 'https://example.supabase.co/storage/v1/object/public/products/images/wallet.jpg',
            imageAlt: 'Coalition Test Wallet 1/1 by Coalition',
            url: 'https://sgcoalition.xyz/product/prod_fixture',
            type: 'product',
        };

        const tags = head(injectSeo(baseHtml, productSeo, undefined));
        expect(tags).not.toContain('og:image:width');
        expect(tags).not.toContain('og:image:height');
        expect(tags).toContain('property="og:image:alt" content="Coalition Test Wallet 1/1 by Coalition"');
        expect(tags).not.toContain('homepage alt');
        expect(tags).not.toContain('homepage description');
    });

    it('treats "$" in copy as text, not as a substitution pattern', () => {
        const output = injectSeo(baseHtml, { ...routeSeo, description: 'Available now. $85 and $& together.' }, undefined);
        expect(head(output)).toContain('content="Available now. $85 and $&amp; together."');
        expect(head(output)).not.toContain('$1');
    });

    it('keeps the homepage shell complete for the tags scraper bots read', () => {
        const html = read('index.html');
        for (const needle of [
            'property="og:image"',
            'https://sgcoalition.xyz/og/card.jpg',
            'property="og:image:width" content="1200"',
            'property="og:image:height" content="630"',
            'property="og:image:alt"',
            'name="twitter:image:alt"',
            'property="og:locale" content="en_US"',
        ]) {
            expect(html, `index.html is missing ${needle}`).toContain(needle);
        }
        expect(html).not.toContain('/hero-cinematic.png" />\n  <meta property="og:site_name"');
    });
});
