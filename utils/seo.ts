import { BlogPost, Product } from '../types.js';

export const SITE_ORIGIN = 'https://sgcoalition.xyz';
export const SITE_NAME = 'Coalition';
// Social share cards, rendered by scripts/generateOgCard.mjs and committed.
// Scrapers only give a link a full-width preview when the image is at least
// 1200x630; the previous share image was a 1024x1024 JPEG named .png, so X,
// Facebook, LinkedIn and Slack all fell back to a small square thumbnail.
export const SHARE_CARD_DIRECTORY = '/og';
export const DEFAULT_SEO_IMAGE = `${SHARE_CARD_DIRECTORY}/card.jpg`;
export const DEFAULT_SEO_IMAGE_WIDTH = 1200;
export const DEFAULT_SEO_IMAGE_HEIGHT = 630;
export const DEFAULT_SEO_IMAGE_ALT = 'Coalition wordmark beside the Coalition hero artwork — crafted in Baltimore';
export const SEO_LOCALE = 'en_US';

// Routes with a card of their own (public/og/<route>.jpg, generated from the
// route's `cardTitle` in scripts/generateSeoArtifacts.mjs). Kept as an explicit
// list because the browser cannot import the build script — it is plain Node and
// pulls in node:fs. tests/seoMeta.test.ts pins this list against STATIC_ROUTES,
// so a route that gains a card here without one there fails rather than serving
// a 404 as its share image.
export const SHARE_CARD_ROUTES: readonly string[] = [
    '/shop',
    '/wallets',
    '/archive',
    '/about',
    '/membership',
    '/sgcoin',
    '/help',
    '/live-orders',
    '/community',
    '/blog',
];

const normalizeRoutePath = (routePath: string) => {
    const trimmed = (routePath || '/').split('?')[0].split('#')[0];
    return trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : '/';
};

/** The share card for a route: its own when one was generated, else the generic
 *  brand card — never a path that does not exist, which is what a shares-time
 *  404 looks like. */
export const shareCardImage = (routePath: string) => {
    const normalized = normalizeRoutePath(routePath);
    return SHARE_CARD_ROUTES.includes(normalized) ? `${SHARE_CARD_DIRECTORY}${normalized}.jpg` : DEFAULT_SEO_IMAGE;
};

/** Every generated card is 1200x630, so a declared size is only honest when the
 *  image actually is one of them (a product page's own photo is not). */
export const isShareCardImage = (image: string) =>
    image.startsWith(`${SHARE_CARD_DIRECTORY}/`);
export const DEFAULT_SEO_DESCRIPTION =
    'Coalition — handcrafted streetwear from Baltimore. Shop limited-edition wallets, custom tees, 1/1 denim, and archive drops. Live order map & SGCoin rewards.';

export const absoluteUrl = (pathOrUrl?: string) => {
    const value = (pathOrUrl || DEFAULT_SEO_IMAGE).trim();
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('//')) return `https:${value}`;
    return `${SITE_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
};

export const productPath = (productId: string) => `/product/${encodeURIComponent(productId)}`;

const cleanText = (value = '') =>
    value
        .replace(/\s+/g, ' ')
        .replace(/<[^>]+>/g, '')
        // Catalog copy carries JS-escape remnants ("3D puff \ $50") that render
        // verbatim in a SERP snippet. Drop a backslash that escapes nothing.
        .replace(/\\(?=\s|$)/g, '')
        .trim();

export const truncateSeoText = (value: string, maxLength = 155) => {
    const cleaned = cleanText(value);
    if (cleaned.length <= maxLength) return cleaned;
    return `${cleaned.slice(0, maxLength - 1).trimEnd()}...`;
};

export const getProductStock = (product: Product) =>
    Object.values(product.sizeInventory || {}).reduce((sum, count) => sum + Number(count || 0), 0);

export const getProductAvailability = (product: Product) => {
    if (product.archived || product.soldAt || getProductStock(product) <= 0) {
        return 'https://schema.org/SoldOut';
    }

    return 'https://schema.org/InStock';
};

// Search results truncate a title at roughly 60 characters, and what falls off
// the end is the " | Coalition" suffix — so a long product name arrives cut in
// half AND loses the brand anyway. Past this length the name keeps the whole
// budget; the site name still shows in the result as the domain.
export const PRODUCT_TITLE_SUFFIX_MAX_NAME = 45;

// A description under this length leaves too thin a snippet (one catalog row
// reads "Available now. $85."), so it is replaced rather than padded.
export const PRODUCT_DESCRIPTION_MIN_LENGTH = 45;

export const buildProductTitle = (name: string) =>
    name.length > PRODUCT_TITLE_SUFFIX_MAX_NAME ? name : `${name} | ${SITE_NAME}`;

// The snippet body: the product's own copy when there is enough of it, else a
// sentence built only from fields the catalog actually asserts (name, category,
// limited-edition flag). No invented edition claims — a "2/4" piece is not a
// one-of-one, and only isLimitedEdition decides that wording.
export const buildProductBlurb = (product: Product) => {
    const copy = cleanText(product.description || '');
    if (copy.length >= PRODUCT_DESCRIPTION_MIN_LENGTH) return copy;

    const kind = product.isLimitedEdition ? 'limited-edition ' : '';
    return `${product.name} — a ${kind}Coalition ${product.category || 'piece'}, handcrafted in Baltimore.`;
};

export const getProductSeo = (product: Product) => {
    const stock = getProductStock(product);
    const isSold = product.archived || Boolean(product.soldAt) || stock <= 0;
    const status = isSold ? 'Sold archive piece' : product.isLimitedEdition ? 'Limited drop available' : 'Available now';
    const title = buildProductTitle(product.name);
    const description = truncateSeoText(`${status}. ${buildProductBlurb(product)} ${product.price ? `$${product.price}.` : ''}`);
    const image = absoluteUrl(product.images[0]);
    const url = absoluteUrl(productPath(product.id));

    return {
        title,
        description,
        image,
        imageAlt: `${product.name}${isSold ? ' — sold' : ''} by Coalition`,
        url,
        path: productPath(product.id),
        status,
    };
};

export const buildProductJsonLd = (product: Product) => {
    const seo = getProductSeo(product);

    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: seo.description,
        image: product.images.map(absoluteUrl),
        sku: product.id,
        brand: {
            '@type': 'Brand',
            name: SITE_NAME,
        },
        category: product.category,
        url: seo.url,
        offers: {
            '@type': 'Offer',
            priceCurrency: 'USD',
            price: Number(product.price || 0).toFixed(2),
            availability: getProductAvailability(product),
            url: seo.url,
            itemCondition: 'https://schema.org/NewCondition',
        },
    };
};

// ── Blog posts ───────────────────────────────────────────────────────────────
// A post's head and structured data. Mirrored by getPostSeo / postJsonLd in
// scripts/generateSeoArtifacts.mjs, which is plain Node and cannot import this
// module — the two are duplicated deliberately and compared by
// tests/seoMeta.test.ts, exactly like getProductSeo above.

/** The post page's own URL. One owner: the prerenderer, the sitemap and the
 *  page's canonical all resolve the slug through this. */
export const blogPostPath = (slug: string) => `/blog/${encodeURIComponent(slug)}`;

/** Mirrors components/Seo.tsx's prefix rule: a title that already names the
 *  brand keeps its own word order and everything else is prefixed. */
export const buildBrandedTitle = (title: string) =>
    title.includes(SITE_NAME) ? title : `${SITE_NAME} | ${title}`;

// The authored excerpt when there is one, else the body as plain text, else a
// sentence built only from what the post actually asserts — never an empty
// description, which reads as "this page has nothing to say" in a result.
export const buildBlogPostDescription = (post: Pick<BlogPost, 'title' | 'excerpt' | 'content'>) =>
    truncateSeoText(
        post.excerpt
        || cleanText(post.content || '')
        || `${post.title} — a Coalition drop, written when it shipped.`
    );

export const getBlogPostSeo = (post: BlogPost) => {
    const title = buildBrandedTitle(post.title);
    const path = blogPostPath(post.slug);

    return {
        title,
        description: buildBlogPostDescription(post),
        // A cover photo is announced as itself with no declared size (a 1200x630
        // declaration on a photo of another shape makes scrapers crop it); a post
        // without one keeps the generic card, which is 1200x630.
        image: absoluteUrl(post.coverImage || DEFAULT_SEO_IMAGE),
        imageAlt: post.coverImage ? `${title} — drop photograph` : DEFAULT_SEO_IMAGE_ALT,
        imageWidth: post.coverImage ? undefined : DEFAULT_SEO_IMAGE_WIDTH,
        imageHeight: post.coverImage ? undefined : DEFAULT_SEO_IMAGE_HEIGHT,
        url: absoluteUrl(path),
        path,
        type: 'article' as const,
    };
};

export const buildBlogPostJsonLd = (post: BlogPost) => {
    const seo = getBlogPostSeo(post);
    const keywords = (post.tags || []).join(', ');
    const published = new Date(post.publishedAt || post.createdAt || '');

    return {
        '@context': 'https://schema.org',
        '@id': `${seo.url}#article`,
        '@type': 'BlogPosting',
        headline: post.title,
        description: seo.description,
        image: [seo.image],
        ...(Number.isNaN(published.getTime()) ? {} : { datePublished: published.toISOString() }),
        author: { '@type': 'Organization', name: SITE_NAME },
        publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            logo: { '@type': 'ImageObject', url: absoluteUrl('/images/logo.png') },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': seo.url },
        url: seo.url,
        articleSection: post.category || 'drop',
        ...(keywords ? { keywords } : {}),
        inLanguage: 'en-US',
    };
};

export const buildItemListJsonLd = (products: Product[], name: string, path: string) => ({
    '@context': 'https://schema.org',
    // Entity identity, like every other node in the graph: the CollectionPage for
    // a path is one node no matter how many ItemLists reference it.
    '@id': `${absoluteUrl(path)}#collection`,
    '@type': 'CollectionPage',
    name,
    url: absoluteUrl(path),
    mainEntity: {
        '@type': 'ItemList',
        itemListElement: products.map((product, index) => {
            const seo = getProductSeo(product);

            return {
                '@type': 'ListItem',
                position: index + 1,
                url: seo.url,
                name: product.name,
            };
        }),
    },
});
