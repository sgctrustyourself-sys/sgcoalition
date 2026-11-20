// tests/brandStoryAbout.test.ts
//
// The /about page is the brand's founder-credibility surface. These assertions
// are source-level on purpose: the narrative must stay specific (Gerrod
// Greenwood, Decentraland, 10.22.26) and must not drift into manufactured
// urgency or the brand's forbidden words. Source-level guards run in a plain
// `npm test` without a build.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..');
const ABOUT = path.join(ROOT, 'pages/About.tsx');
const source = fs.readFileSync(ABOUT, 'utf8');

describe('/about brand story', () => {
    it('names the loss the brand is built from', () => {
        expect(source).toContain('Gerrod Greenwood');
        expect(source.toLowerCase()).toContain('gmoney');
    });

    it('keeps the origin chapters that make the story specific', () => {
        expect(source).toContain('Decentraland');
        expect(source).toContain('10.22.26');
        expect(source.toLowerCase()).toContain('the team fell');
    });

    it('keeps the soft email capture and the portfolio link', () => {
        expect(source).toContain('Newsletter');
        expect(source).toContain('source="about"');
        expect(source).toContain('MAIN_SHARING_LINK');
    });

    it('does not ship manufactured urgency or forbidden words', () => {
        const forbidden = [
            /\bsale\b/i,
            /\bdiscount\b/i,
            /\blimited time\b/i,
            /\bact now\b/i,
            /\bhurry\b/i,
            /\bexclusive\b/i,
            /\bflash sale\b/i,
        ];
        for (const pattern of forbidden) {
            expect(pattern.test(source), `pages/About.tsx must not contain ${pattern}`).toBe(false);
        }
    });

    it('closes with a soft email capture, not a hard sell', () => {
        expect(source).toContain('heading="Stay in touch."');
        expect(source).toContain('No manufactured urgency');
        expect(source).not.toContain('Join The Movement');
    });
});
