/**
 * Image Optimization Utilities
 * Supabase Storage supports on-the-fly image transformation via query parameters:
 * - format=webp|avif|jpg|png
 * - quality=1-100
 * - width=px
 * - height=px
 * - resize=cover|contain|fill
 */

const SUPABASE_STORAGE_HOST = 'tvacscfbzcmjlcekjcsn.supabase.co';
const IMGUR_HOST = 'i.imgur.com';

/**
 * Check if URL is from Supabase Storage
 */
export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes(SUPABASE_STORAGE_HOST) && url.includes('/storage/v1/object/public/');
}

/**
 * Check if URL is from Imgur
 */
export function isImgurUrl(url: string): boolean {
  return url.includes(IMGUR_HOST);
}

/**
 * Get optimized Supabase Storage URL with WebP/AVIF format
 */
export function getOptimizedSupabaseUrl(
  url: string,
  options: {
    format?: 'webp' | 'avif' | 'jpg' | 'png';
    quality?: number;
    width?: number;
    height?: number;
    resize?: 'cover' | 'contain' | 'fill';
  } = {}
): string {
  if (!isSupabaseStorageUrl(url)) return url;

  const { format = 'webp', quality = 80, width, height, resize = 'cover' } = options;
  const params = new URLSearchParams();

  params.set('format', format);
  params.set('quality', quality.toString());
  if (width) params.set('width', width.toString());
  if (height) params.set('height', height.toString());
  params.set('resize', resize);

  // Avoid double-encoding if URL already has params
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${params.toString()}`;
}

/**
 * Get optimized Imgur URL (Imgur supports .webp extension)
 */
export function getOptimizedImgurUrl(url: string): string {
  if (!isImgurUrl(url)) return url;

  // Imgur: replace .jpg/.jpeg/.png with .webp
  return url.replace(/\.(jpe?g|png)$/i, '.webp');
}

/**
 * Get optimized URL for any supported host
 */
export function getOptimizedImageUrl(
  url: string,
  options: {
    format?: 'webp' | 'avif' | 'jpg' | 'png';
    quality?: number;
    width?: number;
    height?: number;
    resize?: 'cover' | 'contain' | 'fill';
  } = {}
): string {
  if (isSupabaseStorageUrl(url)) {
    return getOptimizedSupabaseUrl(url, options);
  }
  if (isImgurUrl(url)) {
    return getOptimizedImgurUrl(url);
  }
  return url;
}

/**
 * Generate responsive srcSet for Supabase images
 */
export function getSupabaseSrcSet(
  url: string,
  widths: number[] = [400, 800, 1200, 1600],
  format: 'webp' | 'avif' = 'webp'
): string {
  if (!isSupabaseStorageUrl(url)) return '';

  return widths
    .map(w => `${getOptimizedSupabaseUrl(url, { format, width: w })} ${w}w`)
    .join(', ');
}

/**
 * Generate blur placeholder (tiny base64 WebP)
 * 1x1 pixel transparent WebP
 */
export const BLUR_PLACEHOLDER = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

/**
 * Generate low-quality image placeholder (LQIP) - 20px wide base64
 * For a more visible placeholder, use a very small version of the actual image
 */
export function getLqipUrl(url: string): string {
  if (isSupabaseStorageUrl(url)) {
    return getOptimizedSupabaseUrl(url, { format: 'webp', quality: 10, width: 20 });
  }
  return BLUR_PLACEHOLDER;
}

/**
 * Preload hint for critical images
 */
export function getPreloadLinks(urls: string[]): Array<{ href: string; as: string; type?: string }> {
  return urls.map(url => ({
    href: getOptimizedImageUrl(url, { format: 'webp', quality: 80, width: 800 }),
    as: 'image',
    type: 'image/webp',
  }));
}

/**
 * Product card specific optimization - returns optimized URLs for primary and hover images
 */
export function getProductCardImages(images: string[] = []) {
  const primary = images[0] || '/images/logo.png';
  const hover = images[1] || primary;

  return {
    primary: getOptimizedImageUrl(primary, { format: 'webp', quality: 80, width: 400 }),
    hover: getOptimizedImageUrl(hover, { format: 'webp', quality: 80, width: 400 }),
    primaryAvif: getOptimizedImageUrl(primary, { format: 'avif', quality: 60, width: 400 }),
    hoverAvif: getOptimizedImageUrl(hover, { format: 'avif', quality: 60, width: 400 }),
    lqip: getLqipUrl(primary),
  };
}

/**
 * Product detail page optimization - larger images
 */
export function getProductDetailImages(images: string[] = []) {
  return images.map((img, index) => ({
    src: getOptimizedImageUrl(img, { format: 'webp', quality: 85, width: 1200 }),
    srcAvif: getOptimizedImageUrl(img, { format: 'avif', quality: 65, width: 1200 }),
    srcSet: getSupabaseSrcSet(img, [600, 1200, 1600, 2400], 'webp'),
    srcSetAvif: getSupabaseSrcSet(img, [600, 1200, 1600, 2400], 'avif'),
    lqip: getLqipUrl(img),
    isPrimary: index === 0,
  }));
}