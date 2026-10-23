// tests/blogSanitizer.test.ts
//
// Pins the ONLY sanitizer config in the app (utils/blogSanitize.ts), which
// pages/BlogPostView.tsx feeds straight into dangerouslySetInnerHTML.
//
// Why this test exists alongside the dependency upgrade: npm audit flagged
// dompurify 3.4.9 with three advisories (CUSTOM_ELEMENT_HANDLING bypass,
// permanent ALLOWED_ATTR pollution via setConfig, IN_PLACE hook removal that
// leaves a detached subtree executable). The upgrade to >=3.4.15 is only
// meaningful if the app's actual config still strips the things that matter,
// so this file asserts behavior rather than version numbers.
//
// Environment is jsdom (vitest.config.ts), so DOMPurify has a real DOM.

import { describe, it, expect } from 'vitest';
import {
    sanitizeBlogHtml,
    BLOG_ALLOWED_TAGS,
    BLOG_ALLOWED_ATTR,
} from '../utils/blogSanitize';

describe('sanitizeBlogHtml', () => {
    it('removes <script> entirely', () => {
        const out = sanitizeBlogHtml('<p>hi</p><script>alert(1)</script>');
        expect(out).toContain('<p>hi</p>');
        expect(out.toLowerCase()).not.toContain('script');
        expect(out).not.toContain('alert(1)');
    });

    it('strips event-handler attributes but keeps the element', () => {
        const out = sanitizeBlogHtml('<img src="https://cdn.example.test/a.png" onerror="alert(1)">');
        expect(out).toContain('src="https://cdn.example.test/a.png"');
        expect(out.toLowerCase()).not.toContain('onerror');
    });

    it('neutralises javascript: URLs in anchors', () => {
        const out = sanitizeBlogHtml('<a href="javascript:alert(1)">click</a>');
        expect(out).not.toContain('javascript:');
        expect(out).toContain('click');
    });

    it('drops inline event handlers from block elements', () => {
        const out = sanitizeBlogHtml('<p onclick="evil()">hi</p>');
        expect(out).toBe('<p>hi</p>');
    });

    it('removes <iframe> and <object>', () => {
        const out = sanitizeBlogHtml('<iframe src="https://evil.example.test"></iframe><object data="x"></object><p>ok</p>');
        expect(out.toLowerCase()).not.toContain('iframe');
        expect(out.toLowerCase()).not.toContain('object');
        expect(out).toContain('<p>ok</p>');
    });

    it('strips style attributes (not in the allow-list)', () => {
        const out = sanitizeBlogHtml('<p style="background:url(javascript:alert(1))">hi</p>');
        expect(out).not.toContain('style=');
        expect(out).toContain('<p>hi</p>');
    });

    it('keeps the formatting the post renderer relies on', () => {
        const html = [
            '<h2>Heading</h2>',
            '<p>A <strong>bold</strong> and <em>italic</em> and <code>code</code> and <a href="https://example.com" target="_blank" rel="noopener">link</a>.</p>',
            '<blockquote>quote</blockquote>',
            '<ul><li>one</li></ul>',
            '<hr>',
        ].join('');
        const out = sanitizeBlogHtml(html);

        for (const tag of ['<h2>', '<strong>', '<em>', '<code>', '<blockquote>', '<ul>', '<li>', '<a ']) {
            expect(out).toContain(tag);
        }
        expect(out).toContain('href="https://example.com"');
        expect(out).toContain('target="_blank"');
        expect(out).toContain('rel="noopener"');
    });

    it('never mutates the exported allow-lists (config-pollution CVE class)', () => {
        const tagsBefore = [...BLOG_ALLOWED_TAGS];
        const attrsBefore = [...BLOG_ALLOWED_ATTR];

        // A payload aimed at the CUSTOM_ELEMENT_HANDLING / attribute-pollution
        // advisories, then a normal post that must still sanitize as before.
        sanitizeBlogHtml('<my-widget data-x="1" onclick="evil()">x</my-widget>');
        const after = sanitizeBlogHtml('<p class="lead">still fine</p>');

        expect([...BLOG_ALLOWED_TAGS]).toEqual(tagsBefore);
        expect([...BLOG_ALLOWED_ATTR]).toEqual(attrsBefore);
        expect(after).toBe('<p class="lead">still fine</p>');
    });

    it('is idempotent for already-sanitized content', () => {
        const once = sanitizeBlogHtml('<p>hello <strong>world</strong></p>');
        expect(sanitizeBlogHtml(once)).toBe(once);
    });

    it('leaves plain text untouched', () => {
        expect(sanitizeBlogHtml('just words, no markup')).toBe('just words, no markup');
    });
});
