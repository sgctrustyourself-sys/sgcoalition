import { chromium } from 'playwright';
import { spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const root = process.cwd();
const W = 1080, H = 1920;
const failures = [];

function rawFromPng(png) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error('ffmpeg raw failed for ' + png + ': ' + r.stderr);
  return r.stdout;
}
function px(buf, x, y) {
  const i = (y * W + x) * 3;
  return [buf[i], buf[i + 1], buf[i + 2]];
}
function sat([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}
function check(name, cond, detail) {
  if (!cond) { failures.push(`${name}: ${detail}`); console.log('FAIL', name, detail); }
  else console.log('ok  ', name);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('pageerror', e => { failures.push('pageerror: ' + e.message); console.log('PAGE_ERROR', e.message); });
await page.goto(pathToFileURL(path.join(root, 'scripts', 'reels', 'ghost-riders-y2k-reel.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const shotDir = path.join(root, 'scripts', 'reels');

// --- geometry: key elements must sit inside the canvas at settled times ---
const boundsCases = [
  { t: 1.5, sels: ['#s1ttl', '#s1star', '#s1sub', '#s1marq'] },
  { t: 4.5, sels: ['#s2ttl', '#s2c1', '#s2c2', '#s2ph'] },
  { t: 7.5, sels: ['#s3big', '#s3art', '#s3price', '#s3star', '#s3eb', '#s3cap'] },
  { t: 10.5, sels: ['#s4a', '#s4b', '#s4ph', '#s4tag', '#s4sub', '#s4ghost'] },
  { t: 13.5, sels: ['#s5ttl', '#s5url', '#s5chip', '#s5ph', '#s5marq', '#s5handle'] },
];
for (const c of boundsCases) {
  await page.evaluate(t => window.seek(t), c.t);
  const rects = await page.evaluate(sels => sels.map(s => {
    const el = document.querySelector(s); const r = el.getBoundingClientRect();
    return { s, x: r.x, y: r.y, w: r.width, h: r.height, vis: getComputedStyle(el).visibility, op: getComputedStyle(el).opacity };
  }), c.sels);
  for (const r of rects) {
    const TOL = 40;
    if (r.s.includes('marq')) {
      // marquees are full-bleed scroll strips (2400px, translated) — only y/size must fit
      check(`bounds t=${c.t} ${r.s}`, r.y >= -TOL && r.y + r.h <= H + TOL && r.w > 5, JSON.stringify(r));
    } else {
      check(`bounds t=${c.t} ${r.s}`, r.x >= -TOL && r.y >= -TOL && r.x + r.w <= W + TOL && r.y + r.h <= H + TOL && r.w > 5,
        JSON.stringify(r));
    }
    check(`visible t=${c.t} ${r.s}`, Number(r.op) > 0.5, `opacity=${r.op}`);
  }
}

// --- pixel probes ---
const probeCases = [
  { t: 1.5, probes: [
      { sel: '#s1star', inset: 40, want: 'white' },
      { sel: '#s1sub', inset: 60, want: 'dark' },
      { pt: [25, 960], want: 'white', name: 'ring-left' },
    ] },
  { t: 4.5, probes: [
      { sel: '#s2c1', inset: 24, want: 'dark' },
      { sel: '#s2c2', inset: 24, want: 'mist' },
    ] },
  { t: 7.5, probes: [
      { sel: '#s3price', inset: 30, want: 'white' },
      { sel: '#s3star', region: true, inset: 24, want: 'mist' },
      { sel: '#s3eb', inset: 30, want: 'dark' },
    ] },
  { t: 10.5, probes: [
      { sel: '#s4tag', inset: 30, want: 'white' },
      { pt: [540, 54], want: 'brightish', name: 's4-checker' },
    ] },
  { t: 13.5, probes: [
      { sel: '#s5url', inset: 40, want: 'white' },
      { sel: '#s5chip', inset: 30, want: 'dark' },
      { pt: [540, 1140], want: 'dark', name: 's5-panel' },
    ] },
  { t: 3.0, probes: [ { pt: [540, 960], want: 'white', name: 'flash-at-cut' } ] },
  { t: 8.97, probes: [ { pt: [540, 960], want: 'bright', name: 'bars-covering' } ] },
];

function classify([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), s = mx === 0 ? 0 : (mx - mn) / mx;
  if (mx > 60 && s > 0.3) return 'saturated'; // meaningful color only; ignore dark noise
  if (mx > 235) return 'white';
  if (mx > 170) return 'mist';
  if (mx < 60) return 'dark';
  return 'grayish';
}
function match(want, [r, g, b]) {
  const cls = classify([r, g, b]);
  if (want === 'bright') return cls === 'white' || cls === 'mist';
  if (want === 'brightish') return cls === 'white' || cls === 'mist' || cls === 'grayish';
  return cls === want;
}

for (const c of probeCases) {
  await page.evaluate(t => window.seek(t), c.t);
  const png = path.join(shotDir, `verify-t${String(c.t).replace('.', '_')}.png`);
  await page.screenshot({ path: png });
  const buf = rawFromPng(png);
  for (const p of c.probes) {
    let x, y, label;
    if (p.sel && p.region) {
      // region scan: rotating star / glyph-safe sampling — tally classes over the bbox
      const r = await page.evaluate(s => { const q = document.querySelector(s).getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }, p.sel);
      let mistOrWhite = 0, satCount = 0, total = 0;
      for (let gx = r.x + p.inset; gx < r.x + r.w - p.inset; gx += 12) {
        for (let gy = r.y + p.inset; gy < r.y + r.h - p.inset; gy += 12) {
          const xx = Math.round(Math.max(0, Math.min(W - 1, gx))), yy = Math.round(Math.max(0, Math.min(H - 1, gy)));
          const c0 = px(buf, xx, yy); total++;
          const cls = classify(c0);
          if (cls === 'saturated') satCount++;
          if (cls === 'mist' || cls === 'white') mistOrWhite++;
        }
      }
      check(`region ${p.sel}@${c.t} want=${p.want}`, mistOrWhite / total >= 0.15 && satCount === 0,
        `mistOrWhite=${(mistOrWhite / total).toFixed(2)} saturated=${satCount}/${total}`);
      continue;
    }
    if (p.sel) {
      const r = await page.evaluate(s => { const q = document.querySelector(s).getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }, p.sel);
      x = Math.round(r.x + p.inset); y = Math.round(r.y + r.h / 2);
      label = `${p.sel}@${c.t}(${x},${y})`;
    } else { [x, y] = p.pt; label = `${p.name}@${c.t}(${x},${y})`; }
    x = Math.max(0, Math.min(W - 1, x)); y = Math.max(0, Math.min(H - 1, y));
    const c0 = px(buf, x, y);
    const cls = classify(c0);
    check(`probe ${label} want=${p.want}`, match(p.want, c0), `got ${cls} rgb=(${c0.join(',')})`);
  }
  await fs.rm(png, { force: true });
}

await browser.close();
console.log(failures.length ? `\nVERIFY_FAILED ${failures.length}` : '\nVERIFY_OK');
process.exit(failures.length ? 1 : 0);
