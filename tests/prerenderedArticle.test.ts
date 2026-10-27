// tests/prerenderedArticle.test.ts
//
// The injected-article contract, held by one owner: utils/prerenderedArticle.mjs.
//
// The generator (scripts/generateSeoArtifacts.mjs) writes the node inside #root so
// a crawler reads a post's text without JavaScript; the app's boot (index.tsx)
// removes that copy, because it renders the same post itself. Those two sides used
// to spell the node's id out independently, so a rename on one side would ship the
// served copy twice on every load with every existing check still green — the
// loader-fade check drives "/", which carries no article at all.
//
// The DOM half below is exercised against the generator's real output instead of a
// hand-written fixture, so both sides of the contract meet here. The other half —
// a real bundle on a real page that carries the node — is
// scripts/verify-prerendered-article.mjs, which CI runs.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { injectPrerenderedArticle, postArticleHtml } from '../scripts/generateSeoArtifacts.mjs';
import {
    PRERENDERED_ARTICLE_CLOSE,
    PRERENDERED_ARTICLE_ID,
    PRERENDERED_ARTICLE_OPEN,
    PRERENDERED_ARTICLE_TAG,
    removePrerenderedArticle,
} from '../utils/prerenderedArticle.mjs';

const post = (overrides: Record<string, unknown> = {}) => ({
    slug: 'coalition-pink-silver-crop-top',
    title: "Women's Leopard Print Crop T-Shirt",
    excerpt: 'Pink leopard print, 3D silver puff lettering, cut fitted.',
    content: '<p>Two prints on one piece.</p>',
    coverImage: '',
    publishedAt: '2026-09-17T16:00:00.000Z',
    tags: ['drop'],
    category: 'drop',
    author: 'Founder',
    ...overrides,
});

const shell = '<html><head></head><body><div id="root"><div id="initial-loader"></div></div></body></html>';

const parsePage = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('the injected-article node has one owner', () => {
    // The published contract. This id is in every served post page and in the CSS
    // that lifts the no-JS curtain, so renaming it is a decision someone makes
    // deliberately — not something a refactor does quietly on one side only.
    it('publishes the node as prerendered-post, an article', () => {
        expect(PRERENDERED_ARTICLE_ID).toBe('prerendered-post');
        expect(PRERENDERED_ARTICLE_TAG).toBe('article');
        expect(PRERENDERED_ARTICLE_OPEN).toBe(`<${PRERENDERED_ARTICLE_TAG} id="${PRERENDERED_ARTICLE_ID}">`);
        expect(PRERENDERED_ARTICLE_CLOSE).toBe(`</${PRERENDERED_ARTICLE_TAG}>`);
    });

    it('writes the node from that owner, with no literal of its own', () => {
        const html = postArticleHtml(post());
        expect(html.startsWith(PRERENDERED_ARTICLE_OPEN)).toBe(true);
        expect(html.endsWith(PRERENDERED_ARTICLE_CLOSE)).toBe(true);
        // The no-JS rules address the node too: a rename that missed them would
        // serve the article behind the curtain it was meant to lift.
        const page = injectPrerenderedArticle(shell, html);
        expect(page).toContain(`#${PRERENDERED_ARTICLE_ID} { max-width:`);
    });

    it('places it inside #root, ahead of the loader', () => {
        const doc = parsePage(injectPrerenderedArticle(shell, postArticleHtml(post())));
        const root = doc.getElementById('root');
        expect(root?.firstElementChild?.id).toBe(PRERENDERED_ARTICLE_ID);
        expect(doc.getElementById('root')?.querySelectorAll(PRERENDERED_ARTICLE_TAG)).toHaveLength(1);
    });
});

describe("the app's boot removes the generator's node", () => {
    it('removes it from the page the generator actually produced', () => {
        const doc = parsePage(injectPrerenderedArticle(shell, postArticleHtml(post())));

        // Anti-vacuity: without the node on the page, the removal is untested and
        // this whole file would pass while proving nothing.
        expect(doc.getElementById(PRERENDERED_ARTICLE_ID)).not.toBeNull();

        expect(removePrerenderedArticle(doc)).toBe(true);
        expect(doc.getElementById(PRERENDERED_ARTICLE_ID)).toBeNull();
    });

    it('takes the prerendered copy and nothing else', () => {
        const doc = parsePage(injectPrerenderedArticle(shell, postArticleHtml(post())));
        // Stands in for what React renders into #root on a post page: an article of
        // its own, which the removal has no business touching.
        doc.getElementById('root')?.insertAdjacentHTML(
            'beforeend',
            '<div id="app"><article class="prose">Live copy</article></div>',
        );

        removePrerenderedArticle(doc);

        const articles = doc.querySelectorAll(PRERENDERED_ARTICLE_TAG);
        expect(articles).toHaveLength(1);
        expect(articles[0]?.getAttribute('class')).toBe('prose');
        expect(doc.getElementById('app')).not.toBeNull();
    });

    it('is a no-op on a route with no prerendered article', () => {
        expect(removePrerenderedArticle(parsePage(shell))).toBe(false);
    });

    // The browser half of this is scripts/verify-prerendered-article.mjs; this is
    // the fast guard for the same deletion, and it fails for the same reason: the
    // boot stops calling the removal and the served copy stays in the DOM.
    it('is called by the boot, not merely imported by it', () => {
        const source = fs
            .readFileSync(path.join(__dirname, '..', 'index.tsx'), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');

        expect(source).toMatch(
            /import\s*\{[^}]*\bremovePrerenderedArticle\b[^}]*\}\s*from\s*'\.\/utils\/prerenderedArticle\.mjs'/,
        );
        expect(source).toMatch(/\bremovePrerenderedArticle\s*\(\s*\)/);
    });
});
