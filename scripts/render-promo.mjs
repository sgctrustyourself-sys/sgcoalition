import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'scripts', 'promo-member-30.html');

const targets = [
  { w: 1080, h: 1350, out: path.join(ROOT, 'docs', 'promo', 'member-30-ig-grid.png') },
  { w: 1080, h: 1920, out: path.join(ROOT, 'docs', 'promo', 'member-30-tiktok.png') },
];

const browser = await chromium.launch();
for (const t of targets) {
  const ctx = await browser.newContext({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('file://' + PAGE.replace(/\\/g, '/'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await fs.mkdir(path.dirname(t.out), { recursive: true });
  await page.screenshot({ path: t.out, fullPage: false });
  await page.close();
  await ctx.close();
  console.log('rendered', t.out);
}
await browser.close();
console.log('DONE');