import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getScarcityCopy } from '../utils/pdpScarcity';

const baseProduct = {
    archived: false,
    soldAt: undefined,
    pricingTiers: undefined,
    editionSize: undefined,
    editionSoldCount: undefined,
} as const;

describe('getScarcityCopy', () => {
    it('returns quiet severity with no narrative AND no founder note when total stock is healthy', () => {
        const copy = getScarcityCopy({ ...baseProduct }, 50);
        expect(copy.severity).toBe('quiet');
        expect(copy.narrative).toBeNull();
        expect(copy.founderNote).toBeNull();
        expect(copy.label).toBe('Available');
    });

    it('flips to notice with a narrative AND the verbatim founder limit note when only 3 left', () => {
        const copy = getScarcityCopy({ ...baseProduct }, 3);
        expect(copy.severity).toBe('notice');
        expect(copy.label).toBe('Only 3 left');
        expect(copy.narrative).toMatch(/Only 3 left/);
        expect(copy.founderNote).toMatch(/I want to keep items limited for now/);
        expect(copy.founderNote).toMatch(/get my hands on each piece directly/);
    });

    it('flips to notice with a milder line AND the verbatim founder limit note when stock is between 4 and 10', () => {
        const copy = getScarcityCopy({ ...baseProduct }, 7);
        expect(copy.severity).toBe('notice');
        expect(copy.label).toBe('Selling fast');
        expect(copy.founderNote).toMatch(/I want to keep items limited for now/);
    });

    it('returns sold severity when total stock is 0 (no founder note - the drop is already done)', () => {
        const copy = getScarcityCopy({ ...baseProduct }, 0);
        expect(copy.severity).toBe('sold');
        expect(copy.label).toBe('Sold Out');
        expect(copy.narrative).toMatch(/custom/);
        expect(copy.founderNote).toBeNull();
    });

    it('returns sold severity and an archive-y narrative when soldAt is set (no founder note)', () => {
        const copy = getScarcityCopy({ ...baseProduct, archived: true, soldAt: '2026-07-02T00:00:00Z' }, 0);
        expect(copy.severity).toBe('sold');
        expect(copy.label).toBe('Sold');
        expect(copy.narrative).toMatch(/archive/);
        expect(copy.founderNote).toBeNull();
    });

    it('returns numbered severity with a final-piece narrative AND the verbatim founder limit note when remaining is 1', () => {
        const copy = getScarcityCopy({ ...baseProduct, editionSize: 2, pricingTiers: [{ untilCount: 2, price: 4 }], editionSoldCount: 1 }, 1);
        expect(copy.severity).toBe('numbered');
        expect(copy.label).toBe('Last 1 of 2');
        expect(copy.narrative).toMatch(/last piece of an edition of 2/);
        expect(copy.founderNote).toMatch(/I want to keep items limited for now/);
    });

    it('returns numbered severity with an X-of-N narrative AND the verbatim founder limit note when staying under 20% of edition', () => {
        const copy = getScarcityCopy({ ...baseProduct, editionSize: 50, pricingTiers: [{ untilCount: 50, price: 10 }], editionSoldCount: 45 }, 5);
        expect(copy.severity).toBe('numbered');
        expect(copy.label).toBe('Only 5 of 50 left');
        expect(copy.narrative).toMatch(/5 pieces remain in an edition of 50/);
        expect(copy.founderNote).toMatch(/I want to keep items limited for now/);
    });

    it('returns numbered severity with the fresh-drop narrative AND the verbatim founder limit note when edition is largely untouched', () => {
        const copy = getScarcityCopy({ ...baseProduct, editionSize: 44, pricingTiers: [{ untilCount: null, price: 40 }], editionSoldCount: 0 }, 44);
        expect(copy.severity).toBe('numbered');
        expect(copy.label).toBe('44 piece edition');
        expect(copy.narrative).toMatch(/Your piece is the 1st made/);
        expect(copy.founderNote).toMatch(/I want to keep items limited for now/);
    });

    it('returns sold severity with a fully-minted narrative when remaining is 0 (no founder note)', () => {
        const copy = getScarcityCopy({ ...baseProduct, editionSize: 4, pricingTiers: [{ untilCount: null, price: 20 }], editionSoldCount: 4 }, 0);
        expect(copy.severity).toBe('sold');
        expect(copy.label).toBe('Sold Out');
        expect(copy.narrative).toMatch(/Every piece has been claimed/);
        expect(copy.founderNote).toBeNull();
    });

    it('handles missing editionSoldCount by treating it as 0', () => {
        const copy = getScarcityCopy({ ...baseProduct, editionSize: 4, pricingTiers: [{ untilCount: null, price: 20 }], editionSoldCount: null }, 2);
        expect(copy.severity).toBe('numbered');
        expect(copy.label).toMatch(/piece edition/);
        expect(copy.founderNote).toMatch(/I want to keep items limited for now/);
    });

    it('keeps the PDP founder note verbatim in lock-step with pages/About.tsx (same exact copy on both surfaces)', () => {
        // Both surfaces use the founder's exact words verbatim:
        // "I want to keep items limited for now so I can get my hands on each piece directly."
        // If a future edit changes the About page copy without updating the PDP constant
        // (or vice versa), this test pins the verbatim phrase so the catalog and PDP
        // story cannot silently drift.
        const copy = getScarcityCopy({ ...baseProduct }, 3);
        expect(copy.founderNote).not.toBeNull();
        expect(copy.founderNote).toMatch(/I want to keep items limited for now/);
        expect(copy.founderNote).toMatch(/get my hands on each piece directly/);
        expect(copy.founderNote).toMatch(/for now/);
    });
});

/**
 * Lock-step guard for the About page quote itself. The previous
 * describe block only pins the pdpScarcity constant - a future edit to
 * pages/About.tsx that drifts the quote (e.g. rephrasing, swapping
 * "for now") would NOT flip that test red. This block reads the About
 * page source and asserts the verbatim phrase is present, closing the
 * one-sided coverage gap the test description used to imply.
 */
describe('pages/About.tsx founder note (verbatim lock-step)', () => {
    // Resolve relative to the test file's own location so the smoke test
    // doesn't depend on the runner's cwd. fileURLToPath(import.meta.url)
    // is the ESM-safe equivalent of __filename and works in Vitest's
    // default ESM mode as well as CommonJS-aliased test files.
    const aboutSource = readFileSync(
        resolve(dirname(fileURLToPath(import.meta.url)), '../pages/About.tsx'),
        'utf-8',
    );
    const VERBATIM = 'I want to keep items limited for now so I can get my hands on each piece directly';

    it('renders the founder\'s exact verbatim message in the "From the Founder" section', () => {
        expect(aboutSource).toContain(VERBATIM);
    });

    it('keeps the About page signature aligned with the page hero (Gmoneyworld)', () => {
        // Hero uses Gmoneyworld; signature must match so the brand voice stays consistent.
        // The source encodes the em-dash as &mdash; (matches the surrounding &ldquo;/&rdquo;
        // quote marks); check the entity form so the test reads the file as-written.
        expect(aboutSource).toMatch(/&mdash; Gmoneyworld/);
    });

    it('surfaces the "From the Founder" eyebrow above the verbatim quote', () => {
        expect(aboutSource).toMatch(/From the Founder/);
        expect(aboutSource).toMatch(/data-testid="founder-note"/);
    });
});
