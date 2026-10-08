/**
 * scripts/render-reel.ts — frame-by-frame renderer for the Ghost Riders Y2K reel.
 *
 * Loads scripts/reels/ghost-riders-y2k-reel.html (a deterministic page exposing
 * window.seek(t)), captures 1080x1920 frames at 30fps for 15s, then encodes
 * H.264 MP4 with ffmpeg (yuv420p, faststart) to docs/reels/.
 *
 * Run: npx tsx scripts/render-reel.ts
 */
import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const PAGE = path.join(PROJECT_ROOT, 'scripts', 'reels', 'ghost-riders-y2k-reel.html');
const OUT_DIR = path.join(PROJECT_ROOT, 'docs', 'reels');
const OUT = path.join(OUT_DIR, 'ghost-riders-y2k-reel.mp4');
const FPS = 30;
const DURATION_S = 15;
const W = 1080;
const H = 1920;

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err}`))));
  });
}

async function main(): Promise<void> {
  const framesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reel-frames-'));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => { throw new Error(`page error: ${e.message}`); });
  page.on('console', m => { if (m.type() === 'error') console.warn(`[console] ${m.text()}`); });

  await page.goto(pathToFileURL(PAGE).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => (document as any).fonts.ready);

  const total = FPS * DURATION_S;
  const t0 = Date.now();
  for (let i = 0; i < total; i += 1) {
    await page.evaluate((t: number) => (window as any).seek(t), i / FPS);
    const file = path.join(framesDir, `f${String(i).padStart(4, '0')}.png`);
    await page.screenshot({ path: file });
    if (i % 60 === 0) console.log(`frame ${i}/${total}`);
  }
  await browser.close();
  console.log(`captured ${total} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  await fs.mkdir(OUT_DIR, { recursive: true });
  await run('ffmpeg', [
    '-y', '-framerate', String(FPS),
    '-i', path.join(framesDir, 'f%04d.png'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    OUT,
  ]);
  await fs.rm(framesDir, { recursive: true, force: true });
  console.log('REEL_OK', OUT, `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(err => { console.error(err); process.exit(1); });
