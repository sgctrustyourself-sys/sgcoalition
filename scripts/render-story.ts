/**
 * scripts/render-story.ts — Playwright-powered drop-asset renderer.
 *
 * For a single coalition limited-release drop, renders postable PNGs in any of
 * three formats (chosen via --format):
 *   - story : 1080 × 1920 IG Story slides (the original PNGs at docs/story-reveal/)
 *   - grid  : 1080 × 1350 IG Grid carousel slides (the docs/drop-kit portrait canvas)
 *   - x     : 1200 × 628  X feed images (single-post + 3 thread crops)
 *
 * For each output the renderer:
 *   1. Reads the release's DropSpec from the single registry at
 *      `scripts/story-reveal-specs/drops.ts` (the per-slide data, mirroring
 *      docs/drop-kit-{slug}.md) and the format-specific template at
 *      `scripts/templates/{format}-slide.html`.
 *   2. Substitutes placeholders (__SLUG__, __SLIDE_N__, __LAYOUT_NAME__,
 *      __OUTPUT_INDEX__, __OUTPUT_TOTAL__, __DROP_SPEC__, __SLIDE_SPEC__)
 *      and writes a reviewer-aid HTML to
 *      `docs/{format}-reveal/{prefix}{slug}-{slideId}-{layout}.html`.
 *   3. Loads the HTML in headless Chromium, switches `body[data-mode]` to
 *      "postable" (which strips .sticker-hint overlays + .review-caption via CSS),
 *      and screenshots the page at the format's native viewport — yielding a PNG
 *      ready to upload to IG / X with no reviewer aids baked in.
 *
 * Run:
 *   `npm run story:reveal -- --slug grey-wave`      (default; 1080×1920)
 *   `npm run grid:reveal  -- --slug grey-wave`      (1080×1350 IG carousel)
 *   `npm run x:reveal     -- --slug grey-wave`      (1200×628 X — single-post + thread×3)
 *
 * One command for every format a release posts to, or for the whole registry:
 *   `npm run drop:render -- --slug grey-wave`       (story + grid + x)
 *   `npm run drop:render -- --all`                  (every release in the registry)
 *   `--formats story,grid` narrows the set; `--format <one>` still works alone.
 *
 * First-time use: `npx playwright install chromium` (~150 MB browser binary).
 */
import { chromium } from 'playwright-core';
import { promises as fs } from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { getDrop, listDropSlugs, assetRelPath } from './story-reveal-specs/drops';
import type { DropSpec, SlideSpec } from './story-reveal-specs/drops';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

type DropFormat = 'story' | 'grid' | 'x';

// 'sequential' = one PNG per slide spec 1..N. Array = explicit mapping per output index.
type Mapping = 'sequential' | Array<'single' | 'thread-1' | 'thread-2' | 'thread-3'>;

interface FormatSpec {
  width: number;
  height: number;
  templateRel: string;
  outSubdir: string;
  filePrefix: string;
  numOutputs: number;
  mapping: Mapping;
  description: string;
}

const FORMATS: Record<DropFormat, FormatSpec> = {
  story: {
    width: 1080, height: 1920,
    templateRel: 'scripts/templates/story-slide.html',
    outSubdir: 'docs/story-reveal',
    filePrefix: '',
    numOutputs: 5,
    mapping: 'sequential',
    description: 'IG Stories (1080×1920)',
  },
  grid: {
    width: 1080, height: 1350,
    templateRel: 'scripts/templates/grid-slide.html',
    outSubdir: 'docs/grid-reveal',
    filePrefix: 'grid-',
    numOutputs: 5,
    mapping: 'sequential',
    description: 'IG Grid carousel (1080×1350)',
  },
  x: {
    width: 1200, height: 628,
    templateRel: 'scripts/templates/x-slide.html',
    outSubdir: 'docs/x-reveal',
    filePrefix: 'x-',
    numOutputs: 4,
    mapping: ['single', 'thread-1', 'thread-2', 'thread-3'],
    description: 'X feed (1200×628) — single-post + 3-thread crops',
  },
};

interface CliArgs {
  slug: string;
  format: DropFormat;
  out: string;
  template: string;
}

function argValue(argv: string[], key: string): string | null {
  const i = argv.indexOf(`--${key}`);
  if (i === -1) return null;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : null;
}

interface RunRequest {
  slugs: string[];
  formats: DropFormat[];
  out: string | null;
  template: string | null;
}

/**
 * Parses one run: which releases (one slug, or the whole registry with --all) at
 * which formats (comma-separated --formats, singular --format, default story).
 */
function parseRun(argv: string[]): RunRequest {
  const formatsRaw = argValue(argv, 'formats') ?? argValue(argv, 'format') ?? 'story';
  const formats = formatsRaw.split(',').map((f) => f.trim()).filter(Boolean);
  for (const f of formats) {
    if (!(f in FORMATS)) {
      throw new Error(`Unsupported --format "${f}". Use one of: ${Object.keys(FORMATS).join(', ')}.`);
    }
  }
  return {
    slugs: argv.includes('--all') ? listDropSlugs() : [argValue(argv, 'slug') || 'grey-wave'],
    formats: formats as DropFormat[],
    out: argValue(argv, 'out'),
    template: argValue(argv, 'template'),
  };
}

/**
 * Resolves a release's DropSpec from the single registry.
 * Adding a drop is one entry in scripts/story-reveal-specs/drops.ts — no
 * renderer edits, and no per-slug file to keep in sync.
 */
function loadSpec(slug: string): DropSpec {
    return getDrop(slug).spec;
}

/** Index of the slide spec used to feed each output (default = sequential mapping). */
function slideSpecIndexFor(outputIndex: number, mapping: Mapping): number {
  if (mapping === 'sequential') return outputIndex - 1;
  const m = mapping[outputIndex - 1];
  // X format mappings — pull content from the spec the drop-kit says the slide is "cropped" from.
  if (m === 'single') return 4;   // slide 5 / CTA — source copy for the single-post header
  if (m === 'thread-1') return 0; // slide 1 / hero
  if (m === 'thread-2') return 2; // slide 3 / scarcity
  if (m === 'thread-3') return 4; // slide 5 / CTA
  return 0;
}

/** Used in the rendered output filename + the reviewer-aid HTML <title>. */
function fileIdFor(outputIndex: number, mapping: Mapping): string {
  if (mapping === 'sequential') return `slide-${outputIndex}`;
  return mapping[outputIndex - 1];
}

async function renderOne(args: CliArgs): Promise<void> {
  const fmtSpec = FORMATS[args.format];
  const outDirAbs = path.resolve(args.out);
  const templateAbs = path.resolve(args.template);

  console.log(`🎬 Coalition Drop Renderer`);
  console.log(`   format     : ${args.format} · ${fmtSpec.description}`);
  console.log(`   viewport   : ${fmtSpec.width}×${fmtSpec.height}`);
  console.log(`   slug       : ${args.slug}`);
  console.log(`   output dir : ${outDirAbs}`);
  console.log(`   template   : ${templateAbs}`);

  const spec = loadSpec(args.slug);

  // Preflight: the templates reference `spec.images.*` relative to the rendered
  // HTML. A missing file used to render a clean-looking slide with an empty image
  // well, so a drop could be posted with 15 broken PNGs and no error at all.
  const missing = (
    await Promise.all(
      (['front', 'back'] as const).map(async (which) => {
        const abs = path.join(PROJECT_ROOT, assetRelPath(spec, which));
        try {
          await fs.access(abs);
          return null;
        } catch {
          return assetRelPath(spec, which);
        }
      }),
    )
  ).filter((p): p is string => p !== null);
  if (missing.length) {
    throw new Error(
      `Release "${args.slug}" is missing its source image(s):\n` +
        missing.map((m) => `    ${m}`).join('\n') +
        `\n  Add the photos there, then re-run. Nothing was rendered.`,
    );
  }

  const template = await fs.readFile(templateAbs, 'utf8');

  if (spec.slides.length < 5 && args.format !== 'x') {
    console.warn(`⚠️  DropSpec for "${args.slug}" declares ${spec.slides.length} slides (expected at least 5 for sequential formats).`);
  }

  await fs.mkdir(outDirAbs, { recursive: true });

  const browser = await chromium.launch();
  let context;
  let page;
  try {
    context = await browser.newContext({
      viewport: { width: fmtSpec.width, height: fmtSpec.height },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.warn(`  [browser console error] ${msg.text()}`);
    });
    page.on('pageerror', (err) => console.warn(`  [browser page error] ${err.message}`));

    const rendered: Array<{ n: number; fileId: string; slideLayout: string; htmlPath: string; pngPath: string }> = [];
    for (let i = 0; i < fmtSpec.numOutputs; i++) {
      const outputN = i + 1;
      const fileId = fileIdFor(outputN, fmtSpec.mapping);
      const slideSpecIndex = slideSpecIndexFor(outputN, fmtSpec.mapping);
      const slide: SlideSpec = spec.slides[slideSpecIndex];

      const html = template
        .replace(/__SLUG__/g, spec.slug)
        .replace(/__SLIDE_N__/g, String(outputN))
        // __LAYOUT_NAME__ tracks the slide spec's canonical layout (HERO/DETAIL/...), NOT the
        // X-variant fileId — so the reviewer-aid <title> stays consistent with the carousel/story
        // titles instead of rendering as e.g. "SLIDE-1".
        .replace(/__LAYOUT_NAME__/g, slide.layout.toUpperCase())
        .replace(/__OUTPUT_INDEX__/g, String(outputN))
        .replace(/__OUTPUT_TOTAL__/g, String(fmtSpec.numOutputs))
        .replace(/__FORMAT__/g, args.format)
        .replace(/__DROP_SPEC__/g, JSON.stringify(spec))
        .replace(/__SLIDE_SPEC__/g, JSON.stringify(slide));

      const baseName = `${fmtSpec.filePrefix}${args.slug}-${fileId}`;
      // X-variant HTML reviewer aids describe the X layout (single / thread-N), not the slide
      // spec they drew content from, so drop the `-${slide.layout}` suffix in that case to
      // avoid e.g. `x-grey-wave-single-cta.html`.
      const htmlSuffix = args.format === 'x' ? '' : `-${slide.layout}`;
      const htmlPath = path.join(outDirAbs, `${baseName}${htmlSuffix}.html`);
      const pngPath = path.join(outDirAbs, `${baseName}.png`);
      await fs.writeFile(htmlPath, html, 'utf8');

      await page.goto(pathToFileURL(htmlPath).toString(), { waitUntil: 'networkidle', timeout: 30_000 });
      try {
        await page.waitForFunction(
          () => document.fonts && document.fonts.ready.then(() => true),
          null,
          { timeout: 8_000 },
        );
      } catch {
        console.warn(`  [renderer warning] document.fonts.ready timed out for ${path.basename(htmlPath)}; using fallback fonts for this capture.`);
      }
      await page.waitForTimeout(250);

      // Strip sticker hints + review caption before screenshot.
      await page.evaluate(() => { document.body.dataset.mode = 'postable'; });
      await page.waitForTimeout(80);

      await page.screenshot({ path: pngPath, fullPage: false, omitBackground: false, type: 'png' });

      rendered.push({ n: outputN, fileId, slideLayout: slide.layout, htmlPath, pngPath });
      console.log(`  ✓ ${args.format} ${outputN}/${fmtSpec.numOutputs}  ${fileId.padEnd(10)}  →  ${path.basename(pngPath)}`);
    }

    console.log(`\nDone. ${rendered.length} output${rendered.length === 1 ? '' : 's'} rendered (${fmtSpec.width}×${fmtSpec.height}).\n`);
    console.log(`Ready-to-post PNGs (gitignored · re-run the renderer to refresh):`);
    for (const r of rendered) console.log(`  ${path.relative(PROJECT_ROOT, r.pngPath)}`);
    console.log(`\nReviewer aids (open in any browser — sticker hints visible):`);
    for (const r of rendered) console.log(`  ${path.relative(PROJECT_ROOT, r.htmlPath)}`);
    console.log(`\nOutput dir:`);
    console.log(`  ${outDirAbs}\n`);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    await browser.close();
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const run = parseRun(argv);
  console.log(
    `🎬 Coalition Drop Renderer — ${run.slugs.length} release(s) × ${run.formats.join(' + ')}\n`,
  );
  for (const slug of run.slugs) {
    for (const format of run.formats) {
      await renderOne({
        slug,
        format,
        out: run.out ?? path.join(PROJECT_ROOT, FORMATS[format].outSubdir),
        template: run.template ?? path.join(PROJECT_ROOT, FORMATS[format].templateRel),
      });
    }
  }
}

main().catch((err) => {
  console.error('❌ render-story failed:', err);
  process.exit(1);
});
