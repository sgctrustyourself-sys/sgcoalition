import { spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const root = process.cwd();
const MP4 = path.join(root, 'docs', 'reels', 'ghost-riders-y2k-reel.mp4');
const W = 1080, H = 1920;
const failures = [];
const check = (name, cond, detail) => {
  if (!cond) { failures.push(name + ': ' + detail); console.log('FAIL', name, detail); }
  else console.log('ok  ', name);
};

// --- ffprobe specs ---
const pr = spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', MP4], { encoding: 'utf8' });
if (pr.status !== 0) { console.error('ffprobe failed', pr.stderr); process.exit(1); }
const info = JSON.parse(pr.stdout);
const v = info.streams.find(s => s.codec_type === 'video');
check('codec h264', v.codec_name === 'h264', v.codec_name);
check('dims 1080x1920', v.width === 1080 && v.height === 1920, `${v.width}x${v.height}`);
check('pix_fmt yuv420p', v.pix_fmt === 'yuv420p', v.pix_fmt);
check('fps 30', v.r_frame_rate === '30/1', v.r_frame_rate);
const dur = Number(info.format.duration);
check('duration ~15s', dur > 14.5 && dur < 15.5, String(dur));
const size = Number(info.format.size);
check('size > 500KB', size > 500_000, String(size));

// --- frame probes ---
function extract(t) {
  const png = path.join(root, 'scripts', 'reels', `vprobe-${String(t).replace('.', '_')}.png`);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', MP4, '-frames:v', '1', '-y', png], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('extract failed @' + t + ' ' + r.stderr);
  const raw = spawnSync('ffmpeg', ['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 }).stdout;
  return raw;
}
function brightFrac(buf, x0, y0, x1, y1, thresh = 200) {
  let n = 0, tot = 0;
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * W + x) * 3;
    if (Math.max(buf[i], buf[i + 1], buf[i + 2]) > thresh) n++;
    tot++;
  }
  return n / tot;
}
function px(buf, x, y) { const i = (y * W + x) * 3; return [buf[i], buf[i + 1], buf[i + 2]]; }
function grayish([r, g, b]) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 || (mx - mn) / mx <= 0.3 || mx <= 60; }

// t, description, assertion
const cases = [
  [1.5, 'S1 chrome title present', b => brightFrac(b, 100, 300, 980, 600) > 0.02],
  [1.5, 'S1 ring white left', b => { const p = px(b, 25, 960); return Math.min(...p) > 220; }],
  [3.0, 'flash covers cut', b => { const p = px(b, 540, 960); return Math.min(...p) > 235; }],
  [4.5, 'S2 headline present', b => brightFrac(b, 70, 240, 1000, 470) > 0.03],
  [7.5, 'S3 price pill white', b => brightFrac(b, 80, 1645, 400, 1735, 235) > 0.6],
  [7.5, 'S3 no pink bg (dark scene)', b => { const p = px(b, 50, 795); return grayish(p) && Math.max(...p) < 80; }],
  [8.97, 'bar wipe covering', b => { const p = px(b, 540, 960); return Math.min(...p) > 170; }],
  [10.5, 'S4 checker band bright', b => brightFrac(b, 0, 0, 1080, 100, 150) > 0.25],
  [12.0, 'flash covers cut', b => { const p = px(b, 540, 960); return Math.min(...p) > 235; }],
  [13.5, 'S5 url pill white', b => brightFrac(b, 300, 1370, 780, 1450, 235) > 0.6],
  [13.5, 'S5 panel dark', b => { const p = px(b, 100, 1120); return Math.max(...p) < 60; }],
  [14.96, 'outro fade to black', b => { const p = px(b, 540, 960); return Math.max(...p) < 30; }],
];
for (const [t, name, fn] of cases) {
  const buf = extract(t);
  check(`@${t} ${name}`, fn(buf), 'assertion failed');
  await fs.rm(path.join(root, 'scripts', 'reels', `vprobe-${String(t).replace('.', '_')}.png`), { force: true });
}

console.log(failures.length ? `\nVIDEO_VERIFY_FAILED ${failures.length}` : '\nVIDEO_VERIFY_OK');
process.exit(failures.length ? 1 : 0);
