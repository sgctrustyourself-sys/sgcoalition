// tests/rendererSmoke.test.ts
//
// Coalition drop-asset renderer -- PR-time regression catch.
//
// (1) `npm run reveal` is a default-format alias for `npm run story:reveal`
//     and renders ONLY 5 Story PNGs (0 Grid, 0 X). Earlier docs claimed it
//     chained all three formats; this test catches the alias confusion.
// (2) The three explicit scripts jointly produce 14 postable PNGs at the
//     documented viewports (1080x1920 / 1080x1350 / 1200x628) plus 14 matching
//     reviewer-aid HTMLs in docs/{story,grid,x}-reveal/.
// (3) Zero orange #ff7a59 sticker-hint pixels are baked into any PNG -- proves
//     the renderer's `body[data-mode=postable]` CSS strip actually hides the
//     orange dashed-box overlays before the screenshot.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
// Top-level `fs` (not `fs.promises`) so the sync helpers like
// `fs.readdirSync`/`fs.rmSync` resolve alongside the async ones
// (`fs.createReadStream`, `fs.rm`, `fs.writeFile`) without having to mix
// two `fs` namespaces in the same file.
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(__dirname, '..');
const SPEC = path.join(ROOT, 'scripts/story-reveal-specs/throwaway.ts');

const DIRS = {
    story: path.join(ROOT, 'docs/story-reveal'),
    grid:  path.join(ROOT, 'docs/grid-reveal'),
    x:     path.join(ROOT, 'docs/x-reveal'),
};

// Synthetic 2-image drop with deliberately-formatted caption + sticker-hint
// label that is unmistakably orange in the reviewer-aid. If a single pixel of
// #ff7a59 leaks into the postable PNG, the renderer's data-mode strip is broken
// and the hasOrangeBleed assertion fails. Use a 1x1 placeholder PNG already
// on disk (public/images/grey-wave-wallet-1-2-front.png) so the renderer does
// not log empty-URL warnings.
const PLACEHOLDER_FRONT = '../../public/images/grey-wave-wallet-1-2-front.png';
const PLACEHOLDER_BACK  = '../../public/images/grey-wave-wallet-1-2-back.png';
const SENTINEL_LABEL = 'BLEED TEST SHOULD NOT APPEAR IN PNG';
const THROWAWAY_SPEC = [
    "export const throwawaySpec = {",
    "    slug: 'throwaway',",
    "    releaseName: 'BLEED TEST',",
    "    productName: 'Bleed Test 1/1',",
    "    x: 1, y: 1,",
    "    price: '99',",                              // literal, no $ expansion hazards
    "    shopUrl: 'test.local',",
    "    images: { front: '" + PLACEHOLDER_FRONT + "', back: '" + PLACEHOLDER_BACK + "' },",
    "    slides: [",
    "        { layout: 'hero',      headline: 'SENT', stickers: [{ type: 'countdown', anchor: 'top-right',     label: '" + SENTINEL_LABEL + "' }] },",
    "        { layout: 'detail',    headline: 'SENT', stickers: [{ type: 'poll',      anchor: 'center-right',  label: '" + SENTINEL_LABEL + "' }] },",
    "        { layout: 'scarcity',  eyebrow: 'x', headline: 'x', price: '99',                       stickers: [{ type: 'countdown', anchor: 'top-right',     label: '" + SENTINEL_LABEL + "' }] },",
    "        { layout: 'manifesto', headline: 'SENT', stickers: [{ type: 'mention',   anchor: 'bottom-right',  label: '" + SENTINEL_LABEL + "' }] },",
    "        { layout: 'cta',       eyebrow: 'x', headline: 'x', url: 'x',                          stickers: [{ type: 'link',      anchor: 'center-right',  label: '" + SENTINEL_LABEL + "' }] },",
    "    ],",
    "};",
    "",
].join('\n');

async function readPng(filePath) {
    return new Promise((resolve, reject) => {
        const png = new PNG();
        fs.createReadStream(filePath).pipe(png).on('parsed', function () {
            resolve({ width: this.width, height: this.height, data: this.data });
        }).on('error', reject);
    });
}

// RGB approx #ff7a59 (255, 122, 89). TOL=8 tolerates AA fringes without false positives.
const ORANGE = { r: 255, g: 122, b: 89 };
const TOL = 8;
function hasOrangeBleed(data) {
    // Strict-TS-safe: readUInt8 returns number (no Uint8Array index undefined).
    for (let i = 0; i < data.length; i += 4) {
        const r = data.readUInt8(i);
        const g = data.readUInt8(i + 1);
        const b = data.readUInt8(i + 2);
        if (Math.abs(r - ORANGE.r) <= TOL && Math.abs(g - ORANGE.g) <= TOL && Math.abs(b - ORANGE.b) <= TOL) {
            return true;
        }
    }
    return false;
}

function listPngs(dir) {
    return fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
}
function listHtml(dir) {
    return fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();
}

describe('Coalition Drop Renderer smoke test', () => {
    beforeAll(async () => {
        // Clean output dirs so this run is deterministic.
        await Promise.all([
            fs.rm(DIRS.story, { recursive: true, force: true }),
            fs.rm(DIRS.grid,  { recursive: true, force: true }),
            fs.rm(DIRS.x,     { recursive: true, force: true }),
        ]);
        await fs.writeFile(SPEC, THROWAWAY_SPEC, 'utf8');
    }, 60_000);

    afterAll(async () => {
        // Drop the synthetic spec so dev machines don't accumulate stray files.
        await fs.rm(SPEC, { force: true });
    });

    // REGRESSION CATCH:
    //   `npm run reveal` is a default-format alias for `npm run story:reveal`,
    //   NOT a chained three-format runner. Earlier docs claimed otherwise.
    it('npm run reveal alias renders ONLY 5 Story PNGs (0 grid, 0 x)', () => {
        execSync('npm run reveal -- --slug throwaway', { cwd: ROOT, stdio: 'pipe' });
        const storyPngs = listPngs(DIRS.story);
        const gridPngs  = listPngs(DIRS.grid);
        const xPngs     = listPngs(DIRS.x);
        expect(storyPngs.length, 'alias should produce 5 story PNGs').toBe(5);
        expect(gridPngs.length,  'alias must NOT write to grid-reveal/').toBe(0);
        expect(xPngs.length,     'alias must NOT write to x-reveal/').toBe(0);
    }, 60_000);

    // Full coverage: 14 PNGs at correct viewports, 14 matching HTML aids, 0 orange bleed.
    it('3 explicit scripts render exactly 14 PNGs + 14 HTML aids at correct viewports with 0 orange bleed', async () => {
        // Clear the alias-run output before chained-three run.
        fs.rmSync(DIRS.story, { recursive: true, force: true });

        execSync('npm run story:reveal -- --slug throwaway', { cwd: ROOT, stdio: 'pipe' });
        execSync('npm run grid:reveal -- --slug throwaway',  { cwd: ROOT, stdio: 'pipe' });
        execSync('npm run x:reveal -- --slug throwaway',     { cwd: ROOT, stdio: 'pipe' });

        const storyPngs = listPngs(DIRS.story);
        const gridPngs  = listPngs(DIRS.grid);
        const xPngs     = listPngs(DIRS.x);

        // (a) Counts: 5 + 5 + 4 = 14 PNGs.
        expect(storyPngs.length, 'story PNGs count').toBe(5);
        expect(gridPngs.length,  'grid PNGs count').toBe(5);
        expect(xPngs.length,     'X PNGs count').toBe(4);

        // (b) Reviewer-aid HTMLs: 5 + 5 + 4 = 14 HTML aids.
        const storyHtml = listHtml(DIRS.story);
        const gridHtml  = listHtml(DIRS.grid);
        const xHtml     = listHtml(DIRS.x);
        expect(storyHtml.length, 'story HTML aids count').toBe(5);
        expect(gridHtml.length,  'grid HTML aids count').toBe(5);
        expect(xHtml.length,     'X HTML aids count (single + 3 threads)').toBe(4);

        // (c) Viewports per format.
        const CHECKS = [
            [DIRS.story, [1080, 1920]],
            [DIRS.grid,  [1080, 1350]],
            [DIRS.x,     [1200,  628]],
        ];
        for (const [dir, expected] of CHECKS) {
            for (const name of listPngs(dir)) {
                const png = await readPng(path.join(dir, name));
                expect([png.width, png.height], `viewport for ${name}`).toEqual(expected);
            }
        }

        // (d) Zero orange sticker-hint bleed across all 14 PNGs.
        const leaky = [];
        for (const dir of [DIRS.story, DIRS.grid, DIRS.x]) {
            for (const name of listPngs(dir)) {
                const png = await readPng(path.join(dir, name));
                if (hasOrangeBleed(png.data)) leaky.push(path.join(dir, name));
            }
        }
        expect(
            leaky.length,
            'Expected 0 orange (#ff7a59) bleed; found ' + leaky.length +
            ' leaky PNG(s). First: ' + (leaky[0] ?? '(none)') +
            '. data-mode="postable" strip is broken.',
        ).toBe(0);
    }, 120_000);
});
