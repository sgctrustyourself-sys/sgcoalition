import DOMPurify from 'dompurify';

// Single source of truth for blog-post HTML sanitization.
//
// WHY THIS MODULE EXISTS: the allow-list used to be inline in
// pages/BlogPostView.tsx, which made the one XSS-critical config in the app
// untestable without rendering the whole route (router + Supabase + comments).
// Extracting it gives the sanitizer a direct test seam (tests/blogSanitizer.test.ts)
// while keeping the exact same tags/attrs the post renderer relies on.
//
// DOMPurify is kept at ^3.4.15 or newer: the 3.4.x line carried three
// advisories (CUSTOM_ELEMENT_HANDLING bypass, permanent ALLOWED_ATTR pollution
// via setConfig, IN_PLACE hook removal) that are all about config/hook
// handling rather than input parsing. Because this module hands DOMPurify a
// shared config object on every call, the config-pollution variant was the one
// most likely to matter here -- the test pins that the exported constants are
// never mutated by a sanitize call.

export const BLOG_ALLOWED_TAGS = [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br',
    'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'code', 'pre', 'img', 'span', 'div', 'hr',
] as const;

export const BLOG_ALLOWED_ATTR = [
    'href', 'target', 'rel', 'src', 'alt', 'class', 'id',
] as const;

/**
 * Sanitize blog HTML for dangerouslySetInnerHTML.
 *
 * A fresh array copy is passed every call so DOMPurify can never mutate the
 * exported constants (the 3.4.x ALLOWED_ATTR pollution class of bug).
 */
export function sanitizeBlogHtml(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [...BLOG_ALLOWED_TAGS],
        ALLOWED_ATTR: [...BLOG_ALLOWED_ATTR],
    });
}
