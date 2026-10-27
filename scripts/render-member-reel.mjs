import { chromium } from 'playwright';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PAGE = path.join(ROOT, 'scripts', 'reels', 'member-30-reel.html');
const OUT_DIR = path.join(ROOT, 'docs', 'reels');
const OUT = path.join(OUT_DIR, 'member-30-reel.mp4');
const FPS = 30; const DURATION_S = 8; const W = 1080; const H = 1920;

function run(cmd, args){ return new Promise((resolve,reject)=>{ const p=spawn(cmd,args,{stdio:['ignore','pipe','pipe']}); let err=''; p.stderr.on('data',d=>err+=d); p.on('error',reject); p.on('close',c=>c===0?resolve():reject(new Error(cmd+' exited '+c+'\n'+err))); }); }

const framesDir = await fs.mkdtemp(path.join(os.tmpdir(),'reel-frames-'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:W,height:H}, deviceScaleFactor:1 });
page.on('pageerror', e=>{ throw new Error('page error: '+e.message); });
await page.goto(pathToFileURL(PAGE).href, { waitUntil:'networkidle' });
await page.evaluate(()=>document.fonts.ready);
const total = FPS*DURATION_S;
const t0 = Date.now();
for (let i=0;i<total;i++){
  await page.evaluate((t)=>window.seek(t), i/FPS);
  await page.screenshot({ path: path.join(framesDir, `f${String(i).padStart(4,'0')}.png`) });
  if (i%60===0) console.log('frame', i, '/', total);
}
await browser.close();
console.log('captured', total, 'frames in', ((Date.now()-t0)/1000).toFixed(1)+'s');
await fs.mkdir(OUT_DIR, { recursive:true });
await run('ffmpeg', ['-y','-framerate',String(FPS),'-i',path.join(framesDir,'f%04d.png'),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',OUT]);
await fs.rm(framesDir, { recursive:true, force:true });
console.log('REEL_OK', OUT);