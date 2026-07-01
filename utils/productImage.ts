/**
 * Helpers for serving product images through Supabase Storage's on-the-fly
 * image transformation endpoint and reading them by storefront role.
 *
 * Why this exists:
 *   - Product photos currently serve at their original (often multi-MB) size
 *     to every device. LCP on /shop and /home is dominated by those full-size
 *     images. Supabase can resize + re-encode them on the fly.
 *   - The transform endpoint is /storage/v1/render/image/public/<bucket>/<path>
 *     and accepts ?width= / ?quality= / ?format=webp query params.
 *   - Non-Supabase URLs (local /images/... from Vite, i.imgur.com, third-party
 *     placeholders) are passed through unchanged; transforms only work on
 *     Supabase Storage objects.
 *
 * Image role maps (primary / hover / gallery) are stored as URL strings —
 * NOT indices — so admin reorders and deletes don't silently corrupt the
 * role assignment. getProductRoles() falls back to position-based defaults
 * for products created before imageRoles existed.
 *
 * Rollback safety for transform errors:
 *   - getProductImage always returns *some* URL, even for non-transformable
 *     sources. Consumer components wrap <img onError={...}> so if the
 *     Supabase transform ever 404s (e.g. project still on free plan, transforms
 *     disabled for the bucket), the browser swaps back to the raw URL and the
 *     page still renders correctly.
 */

export const PRODUCT_IMAGE_PRESETS = {
    thumb: { width: 400, quality: 60 },
    card: { width: 800, quality: 70 },
    gallery: { width: 1200, quality: 78 },
    full: { width: 1600, quality: 82 },
    hero: { width: 1600, quality: 82 },
} as const;

export type ProductImageSize = keyof typeof PRODUCT_IMAGE_PRESETS;

// `sizes` attribute strings per layout context. These let the browser pick the
// right srcSet candidate without us having to ship per-breakpoint sources.
// - card:    shop/home/favorites/wishlist grid (1 / 2 / 3 / 4 cols responsive)
// - gallery: PDP hero image (~50-60vw on desktop, full-width on mobile)
// - hero:    featured-section full-width banner + PDP hero (1:1 square)
// - thumb:   ~96-120px fixed-width chips
export const PRODUCT_IMAGE_SIZES = {
    // Worst-case-shrunk: Pick the SMALLEST expected slot size when the
    // breakpoint matches so the browser fetches a smaller variant for the
    // common 3-col grid (33vw) instead of the 4-col worst case (25vw). The
    // 4-col grids only kick in at xl, where we override to 25vw.
    card: '(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
    gallery: '(min-width: 1024px) 60vw, 100vw',
    hero: '100vw',
    thumb: '(min-width: 1024px) 120px, 96px',
} as const;

export type ProductImageContext = keyof typeof PRODUCT_IMAGE_SIZES;

const SUPABASE_OBJECT_URL_PATTERN = /https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//i;

/**
 * Returns true only for Supabase Storage public-object URLs.
 * Local /images/... paths (served by Vite/Vercel) and i.imgur.com URLs return
 * false — Supabase transforms only work on objects in your own buckets.
 */
export function isTransformableImageUrl(url?: string | null): boolean {
    if (!url) return false;
    return SUPABASE_OBJECT_URL_PATTERN.test(url);
}

/**
 * Parses the existing query string off a URL into a URLSearchParams so we can
 * merge transform params in without clobbering unknowns (e.g. a future
 * cache-buster or signed token). Returns base + a fresh URLSearchParams.
 */
function splitUrl(url: string): { base: string; params: URLSearchParams } {
    const queryIndex = url.indexOf('?');
    if (queryIndex < 0) {
        return { base: url, params: new URLSearchParams() };
    }
    const base = url.slice(0, queryIndex);
    const search = url.slice(queryIndex + 1);
    return { base, params: new URLSearchParams(search) };
}

/**
 * Convert a Supabase public-object URL into a /render/image/public/ variant
 * annotated with the requested width/quality/format. Falls back to the
 * original URL for everything else so callers don't have to branch.
 *
 * Existing query parameters on the source URL are preserved; Supabase ignores
 * unknown params, so passing through a future cache-buster or signature is safe.
 */
export function getProductImage(url?: string | null, size: ProductImageSize = 'card'): string {
    if (!url) return '';
    if (!isTransformableImageUrl(url)) return url;

    const renderUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
    const { base, params } = splitUrl(renderUrl);

    const preset = PRODUCT_IMAGE_PRESETS[size];
    params.set('width', String(preset.width));
    params.set('quality', String(preset.quality));
    if (!params.has('format')) params.set('format', 'webp');

    return base + '?' + params.toString();
}

/**
 * Build a srcSet string covering thumb / card / gallery / full breakpoints.
 * Returns an empty string for non-transformable URLs so callers can plumb
 * the value straight to <img srcSet={srcSet}> without branching on undefined.
 */
export function getProductImageSrcSet(url?: string | null): string {
    if (!url || !isTransformableImageUrl(url)) return '';
    return (Object.keys(PRODUCT_IMAGE_PRESETS) as ProductImageSize[])
        .map((size) => getProductImage(url, size) + ' ' + PRODUCT_IMAGE_PRESETS[size].width + 'w')
        .join(', ');
}

// ============================================================
// Image-role mapping (primary / hover / gallery)
// ============================================================

import type { Product, ImageRoles } from '../types';

export type { ImageRoles };

/**
 * Resolve the canonical role-aware URL set for a product. Returns a
 * (possibly empty) primaryUrl, an optional hoverUrl, and a non-overlapping
 * galleryUrls list. Always falls back to position-based defaults so old
 * products without imageRoles still get a valid mapping.
 *
 * URL strings are used (NOT indices) so admin reorders/deletes don't silently
 * corrupt the assignment. If a saved role URL no longer exists in the
 * `images` array, it is transparently replaced with the position-based fallback.
 */
export function getProductRoles(product: Product | undefined | null): {
    primaryUrl: string;
    hoverUrl: string | null;
    galleryUrls: string[];
} {
    const images = product?.images ?? [];
    const roles = product?.imageRoles ?? {};

    const imageSet = new Set(images);
    const firstMissing = (candidates: Array<string | null | undefined>): string | null => {
        for (const candidate of candidates) {
            if (candidate && imageSet.has(candidate)) return candidate;
        }
        return null;
    };

    // Primary: explicit primaryUrl, else images[0]. Must be non-empty.
    const primaryUrl = firstMissing([roles.primaryUrl, images[0]]) ?? '';

    // Hover: explicit hoverUrl (including explicit null = "no hover"), else
    // images[1] if available AND not equal to the primary.
    let hoverUrl: string | null;
    if (roles.hasOwnProperty('hoverUrl')) {
        // Operator explicitly set hover — honour their intent (null = none).
        hoverUrl = roles.hoverUrl ? (imageSet.has(roles.hoverUrl) ? roles.hoverUrl : null) : null;
    } else {
        const candidate = images.length > 1 ? images[1] : null;
        hoverUrl = candidate && candidate !== primaryUrl ? candidate : null;
    }

    // Gallery: everything in `images` that isn't primary or hover, in the
    // original order the operator set up. We never trust the persisted
    // galleryUrls as a canonical ordering — derive it from `images` so the
    // PDP carousel preserves the operator's deliberate sort.
    const excludeSet = new Set<string>();
    if (primaryUrl) excludeSet.add(primaryUrl);
    if (hoverUrl) excludeSet.add(hoverUrl);

    const galleryUrls: string[] = [];
    for (const url of images) {
        if (excludeSet.has(url)) continue;
        if (!galleryUrls.includes(url)) galleryUrls.push(url);
    }

    return { primaryUrl, hoverUrl, galleryUrls };
}

/**
 * Convenience accessor for the URL associated with a single role.
 * Returns null if the role doesn't apply (e.g. hover=null on single-image
 * products). Falls back via getProductRoles so an admin without
 * imageRoles metadata still gets image[0]/image[1].
 */
export function getProductRoleImage(
    product: Product | undefined | null,
    role: 'primary' | 'hover'
): string | null {
    const roles = getProductRoles(product);
    if (role === 'primary') return roles.primaryUrl || null;
    return roles.hoverUrl;
}

/**
 * Build the canonical primary/hover/gallery URL list for a product, trimming
 * out anything that no longer exists in the `images` array. Used by admin
 * forms after a reorder or delete so the saved roles stay consistent with
 * the saved images.
 */
export function reconcileImageRoles(
    images: string[],
    roles: ImageRoles | undefined
): ImageRoles {
    const imageSet = new Set(images);
    const primaryUrl = roles?.primaryUrl && imageSet.has(roles.primaryUrl) ? roles.primaryUrl : (images[0]);
    let hoverUrl: string | null;
    if (roles?.hasOwnProperty('hoverUrl')) {
        hoverUrl = roles.hoverUrl && imageSet.has(roles.hoverUrl) ? roles.hoverUrl : null;
    } else {
        hoverUrl = images.length > 1 && images[1] !== primaryUrl ? images[1] : null;
    }
    // Forward namedSlot mappings whose URLs still resolve in the trimmed
    // images[] array. Slots whose URL has been deleted elsewhere drop here
    // so a stale namedSlots entry never points at a stub. Empty result
    // is omitted so missing fields stay undefined downstream.
    const namedSlots: Record<string, string> | undefined = roles?.namedSlots
        ? Object.fromEntries(
            Object.entries(roles.namedSlots).filter(
                ([slotName, url]) => typeof url === 'string' && imageSet.has(url)
            )
        )
        : undefined;
    const namedSlotsOut = namedSlots && Object.keys(namedSlots).length > 0 ? namedSlots : undefined;
    return { primaryUrl, hoverUrl, namedSlots: namedSlotsOut };
}
