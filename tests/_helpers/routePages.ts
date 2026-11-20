// tests/_helpers/routePages.ts
//
// The prerendered route → the page file that renders it.
//
// Both meta suites need this map for source-level guards that cannot be written
// against the built output (they must fail in a plain `npm test`, without a
// build): "this page mounts <Seo>, so it must feed it the structured-data graph"
// and "this page must NOT override the share image, because its card is derived
// from the route". Kept in one place so adding a route is one edit.
//
// It is deliberately a hand-maintained list, and tests assert it covers exactly
// STATIC_ROUTES — a route that ships a prerendered page but is missing here would
// otherwise be exempt from every one of those guards.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');

export const ROUTE_PAGES: Record<string, string> = {
    '/shop': 'pages/Shop.tsx',
    '/wallets': 'pages/Wallets.tsx',
    '/archive': 'pages/Archive.tsx',
    '/about': 'pages/About.tsx',
    '/membership': 'pages/Membership.tsx',
    '/sgcoin': 'pages/BuySGCoin.tsx',
    '/help': 'pages/Help.tsx',
    '/live-orders': 'pages/LiveOrdersMap.tsx',
    '/community': 'pages/Community.tsx',
    '/blog': 'pages/Blog.tsx',
};

/** The one page that legitimately supplies its own share image (a product photo). */
export const PRODUCT_PAGE = 'pages/ProductDetails.tsx';

/**
 * The second page that supplies its own share image — and, unlike a product, it
 * is reached through a dynamic route (/blog/:slug), so it is not in ROUTE_PAGES.
 * Each post's image is its own cover photo; a post with no cover falls back to
 * the route's generic card, which is what the prerendered head advertises too.
 */
export const BLOG_POST_PAGE = 'pages/BlogPostView.tsx';

export const pageExists = (file: string) => fs.existsSync(path.join(ROOT, file));

export const readPage = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
