import { chromium } from 'playwright-core';
import { promises as fs } from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/grid-reveal');
const TEMPLATE = path.join(PROJECT_ROOT, 'scripts/templates/pink-silver-y2k-grid-slide.html');
const MAKER_IMAGE = path.join(PROJECT_ROOT, 'public/images/pink-silver-making-process.png');

// Optional args: --scale N (deviceScaleFactor, default 1) and --out DIR (PNG output,
// default docs/grid-reveal). HTML intermediates always land in OUTPUT_DIR so the
// maker-image relative path keeps resolving; defaults reproduce the original outputs.
const argValue = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const SCALE = Number(argValue('--scale') ?? 1);
const PNG_DIR = argValue('--out')
  ? path.resolve(PROJECT_ROOT, argValue('--out') as string)
  : OUTPUT_DIR;
const SUPPLIED_MAKER_IMAGE = 'C:/Users/SG/AppData/Local/Temp/freebuff-desktop-pastes/paste-1790372006050-19260.png';

async function main(): Promise<void> {
  try {
    await fs.access(MAKER_IMAGE);
  } catch {
    try {
      await fs.copyFile(SUPPLIED_MAKER_IMAGE, MAKER_IMAGE);
      console.log(`Saved supplied workshop image to ${path.relative(PROJECT_ROOT, MAKER_IMAGE)}`);
    } catch {
      throw new Error(
        'The supplied workshop photo is not available. Save it as public/images/pink-silver-making-process.png, then re-run this renderer.',
      );
    }
  }

  const makerRelativeToHtml = path.relative(OUTPUT_DIR, MAKER_IMAGE).replace(/\\/g, '/');
  const makerSrc = makerRelativeToHtml.startsWith('.') ? makerRelativeToHtml : `./${makerRelativeToHtml}`;
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
    for (let slideNo = 1; slideNo <= 5; slideNo += 1) {
      const html = template
        .replace(/__SLIDE_N__/g, String(slideNo))
        .replace(/__MAKER_IMAGE__/g, makerSrc);
      const htmlPath = path.join(OUTPUT_DIR, `y2k-pink-silver-slide-${slideNo}.html`);
      const pngPath = path.join(PNG_DIR, `y2k-pink-silver-slide-${slideNo}.png`);
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
  console.error('Y2K carousel render failed:', error);
  process.exit(1);
});
