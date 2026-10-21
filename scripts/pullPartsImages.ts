/**
 * scripts/pullPartsImages.ts — one-shot: pull the Coalition 'Parts' wallet
 * photos off imgur and bake them into the repo as the drop pipeline's local
 * source PNGs.
 *
 * Why: the catalog rows for Parts 3/4 and 4/4 point at remote i.imgur.com URLs
 * (see constants/products.ts). The drop pipeline (scripts/render-story.ts and
 * scripts/dropAssets.ts) reads LOCAL files at public/images/<slug>-{front,back}.png
 * and refuses to render without them. This closes that gap:
 *
 *   download → normalise (the drop:assets rule) → write the local PNG
 *
 * Normalisation is byte-for-byte the same rule as scripts/dropAssets.ts — alpha
 * flattened onto brand black, sRGB, capped at 1600px on the long edge (never
 * enlarged), PNG compressionLevel 9 — so a later
 * `npm run drop:assets --slug <slug> --confirm` re-normalises to an identical
 * file and the poster and the PDP cannot show different pictures.
 *
 * Usage
 *   npx tsx scripts/pullPartsImages.ts            # dry run: report, write nothing
 *   npx tsx scripts/pullPartsImages.ts --confirm  # download + normalise + write
 *
 * Idempotent: static output paths, overwritten on every --confirm run.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(PROJECT_ROOT, 'public', 'images');
const MAX_EDGE = 1600;

const CONFIRM = process.argv.includes('--confirm');

interface Source {
  /** Registry slug this photo belongs to — names the local PNG. */
  slug: string;
  side: 'front' | 'back';
  /** Remote source URL (the imgur path currently in the catalog row). */
  url: string;
}

// NOTE: `{id}.jpg` (no suffix) is NOT the largest imgur will serve. For the 3/4
// pair the bare URL returns a 500×500 rendition, while `{id}h.jpg` (imgur's
// "huge") returns the full 1024×1024 — 4× the pixels. The 4/4 pair is 1024×1024
// either way; 1024 is the ceiling these uploads hold, so anything larger has to
// come from the Tapstitch original or an upscale. Always take `h`.
const SOURCES: Source[] = [
  { slug: 'parts-wallet-3-4', side: 'front', url: 'https://i.imgur.com/83jXZKgh.jpg' },
  { slug: 'parts-wallet-3-4', side: 'back', url: 'https://i.imgur.com/0OMUUgVh.jpg' },
  { slug: 'parts-wallet-4-4', side: 'front', url: 'https://i.imgur.com/RqcU0I9h.jpg' },
  { slug: 'parts-wallet-4-4', side: 'back', url: 'https://i.imgur.com/Lnimi33h.jpg' },
];

function outPath(src: Source): string {
  return path.join(OUT_DIR, `${src.slug}-${src.side}.png`);
}

async function fetchBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The exact scripts/dropAssets.ts normalisation, applied to an in-memory buffer. */
async function normalize(input: Buffer): Promise<{ buffer: Buffer; note: string }> {
  const before = await sharp(input).metadata();
  const buffer = await sharp(input)
    .flatten({ background: '#000000' })
    .toColourspace('srgb')
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const after = await sharp(buffer).metadata();
  const note =
    `${before.width}×${before.height} (${before.hasAlpha ? 'alpha' : 'no alpha'}) → ` +
    `${after.width}×${after.height} · ${(buffer.length / 1024).toFixed(0)} KB`;
  return { buffer, note };
}

async function main(): Promise<void> {
  console.log(CONFIRM ? '🟢 pull:parts — confirm (download + normalise + write)\n' : '🟡 pull:parts — dry run (write nothing)\n');
  console.log(`Source: i.imgur.com  ·  Output: public/images/\n`);

  if (CONFIRM) await fs.mkdir(OUT_DIR, { recursive: true });

  let written = 0;
  for (const src of SOURCES) {
    const dest = outPath(src);
    const rel = path.relative(PROJECT_ROOT, dest);
    console.log(`▸ ${src.slug} ${src.side}`);
    console.log(`  src   ${src.url}`);

    const input = await fetchBytes(src.url);
    const { buffer, note } = await normalize(input);
    console.log(`  norm  ${note}`);
    console.log(`  dest  ${rel}`);

    if (CONFIRM) {
      await fs.writeFile(dest, buffer);
      console.log(`  ✓ written`);
      written += 1;
    } else {
      console.log(`  · skipped (dry run)`);
    }
    console.log('');
  }

  if (CONFIRM) {
    console.log(`✅ ${written}/${SOURCES.length} local source PNGs written to public/images/.`);
    console.log(`\nNext: add the two drops.ts entries, then run drop:docs / drop:render.`);
  } else {
    console.log(`Dry run — nothing written. Re-run with --confirm to download + normalise + write.`);
  }
}

main().catch((err) => {
  console.error('\n❌ pull:parts failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
