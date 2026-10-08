/**
 * Renders the COALITION FLEECE Instagram carousel to docs/grid-reveal/.
 *
 * This drop has exactly one product photograph
 * (public/images/Coalition-hoodie-front.png). The registry's
 * coalition-fleece-hoodie front/back pointers do not resolve to files on disk,
 * so `npm run drop:render` cannot build this carousel. Every scene here is a
 * crop or reframe of the real photo — no second garment view is invented, and
 * nothing implies a back shot or an on-body fit.
 *
 * Run: npx tsx scripts/render-coalition-fleece-y2k.ts
 */
import { chromium } from 'playwright-core';
import { promises as fs } from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/grid-reveal');
const TEMPLATE = path.join(PROJECT_ROOT, 'scripts/templates/coalition-fleece-y2k-grid-slide.html');
const SLIDE_SOURCE = path.join(PROJECT_ROOT, 'public/images/Coalition-hoodie-front.png');

async function main(): Promise<void> {
  try {
    await fs.access(SLIDE_SOURCE);
  } catch {
    throw new Error(
      `Missing ${path.relative(PROJECT_ROOT, SLIDE_SOURCE)}. The COALITION FLEECE carousel is built ` +
        'from that single photograph; re-render once it is back in the repo.',
    );
  }

  const template = await fs.readFile(TEMPLATE, 'utf8');
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error') console.warn(`[browser console error] ${message.text()}`);
  });
  page.on('pageerror', (error) => console.warn(`[browser page error] ${error.message}`));

  try {
    for (let slideNo = 1; slideNo <= 5; slideNo += 1) {
      const html = template.replace(/__SLIDE_N__/g, String(slideNo));
      const htmlPath = path.join(OUTPUT_DIR, `y2k-fleece-slide-${slideNo}.html`);
      const pngPath = path.join(OUTPUT_DIR, `y2k-fleece-slide-${slideNo}.png`);
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

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
