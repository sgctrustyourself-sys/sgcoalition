/**
 * scripts/render-parts-y2k.ts — render the 5 Parts "closing run" carousel slides
 * (the Act-1 source set for the docs/parts-reel HyperFrames reel).
 *
 * Mirrors scripts/render-pink-silver-y2k.ts, minus its maker-image bootstrap:
 * this run has no behind-the-scenes workshop photo, so slide 4 is the
 * four-part "assembly" beat instead of a maker card.
 *
 * HTML intermediates always land in docs/grid-reveal/ so the template's
 * `../../public/images/...` relative paths keep resolving; PNGs default to the
 * same directory and can be redirected with --out.
 *
 * Usage
 *   npx tsx scripts/render-parts-y2k.ts
 *   npx tsx scripts/render-parts-y2k.ts --scale 1.5 --out docs/parts-reel/assets
 */
import { chromium } from 'playwright-core';
import { promises as fs } from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/grid-reveal');
const TEMPLATE = path.join(PROJECT_ROOT, 'scripts/templates/parts-y2k-grid-slide.html');
const SLIDES = 5;

const argValue = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const SCALE = Number(argValue('--scale') ?? 1);
const PNG_DIR = argValue('--out')
  ? path.resolve(PROJECT_ROOT, argValue('--out') as string)
  : OUTPUT_DIR;

async function main(): Promise<void> {
  const template = await fs.readFile(TEMPLATE, 'utf8');
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(PNG_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: SCALE });
  page.on('console', (message) => {
    if (message.type() === 'error') console.warn(`[browser console error] ${message.text()}`);
  });
  page.on('pageerror', (error) => console.warn(`[browser page error] ${error.message}`));

  try {
    for (let slideNo = 1; slideNo <= SLIDES; slideNo += 1) {
      const html = template.replace(/__SLIDE_N__/g, String(slideNo));
      const htmlPath = path.join(OUTPUT_DIR, `y2k-parts-slide-${slideNo}.html`);
      const pngPath = path.join(PNG_DIR, `y2k-parts-slide-${slideNo}.png`);
      await fs.writeFile(htmlPath, html, 'utf8');
      await page.goto(pathToFileURL(htmlPath).toString(), { waitUntil: 'networkidle', timeout: 30_000 });
      try {
        await page.waitForFunction(() => document.fonts && document.fonts.ready.then(() => true), null, { timeout: 8_000 });
      } catch {
        console.warn(`[renderer warning] Fonts timed out on slide ${slideNo}; screenshot will use fallback fonts.`);
      }
      await page.waitForTimeout(200);
      await page.screenshot({ path: pngPath, fullPage: false, omitBackground: false, type: 'png' });
      console.log(`✓ ${path.relative(PROJECT_ROOT, pngPath)}`);
    }
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Parts Y2K carousel render failed:', error);
  process.exit(1);
});
