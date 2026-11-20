// utils/imagePlaceholder.ts
//
// Inline `data:` SVG used as the <img> fallback for product, gallery and wizard
// cards that have no image (or whose image 404s).
//
// It replaces the old `https://via.placeholder.com/...` URLs. Those rendered
// fine only while img-src allowed every https host; once the clause was narrowed
// to the catalog hosts, a remote placeholder would itself be a CSP violation and
// the fallback would show as a broken image. A data: URI is permitted by the
// policy's `data:` token, costs no request, and cannot go stale.
//
// No scripts, no external references: the SVG is a plain filled rect + label, so
// it is safe under `img-src` and cannot execute in an <img> context anyway.

const PLACEHOLDER_SVG = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">',
    '<rect width="400" height="400" fill="#111111"/>',
    '<text x="200" y="205" fill="#666666" font-family="Arial, sans-serif" font-size="18" text-anchor="middle">',
    'No image',
    '</text>',
    '</svg>',
].join('');

export const IMAGE_PLACEHOLDER = `data:image/svg+xml,${encodeURIComponent(PLACEHOLDER_SVG)}`;
