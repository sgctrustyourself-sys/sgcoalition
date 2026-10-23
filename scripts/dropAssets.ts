/**
 * scripts/dropAssets.ts — normalize a release's local images and publish them to
 * Supabase storage, so the storefront row carries real URLs.
 *
 *   npx tsx scripts/dropAssets.ts --slug pink-silver-crop-top            # dry run (default)
 *   npx tsx scripts/dropAssets.ts --slug pink-silver-crop-top --confirm  # normalize + upload
 *   npx tsx scripts/dropAssets.ts --slug pink-silver-crop-top --verify   # HEAD the public URLs
 *
 * Where things live (mirrors docs/drops-registry.md):
 *   local  : public/images/<name>.png   — served by the live site, read by the renderer
 *   storage: products/images/<name>.png — what the products row points at
 *
 * Normalization is the drops-registry "alpha-free RGB" rule: alpha flattened onto
 * brand black, sRGB, capped at 1600px on the long edge (never enlarged). The file
 * the renderer bleeds is then byte-identical to the file the PDP serves, so a
 * poster and its product page cannot show different pictures.
 *
 * The local file is rewritten in place (that is the convention — the normalized
 * copy IS the source). Pass --keep-local to upload a normalised copy without
 * touching the original.
 */
import { promises as fs } from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { Sharp } from 'sharp';
import {
  getAdminClient,
  localAssetAbs,
  PRODUCTS_BUCKET,
  publicUrlFor,
  slugsFromArgs,
  storagePathFor,
  supabaseProjectUrl,
  verifyUrls,
} from './dropKit';
import type { AssetSide } from './dropKit';
import { argValue, hasFlag, logHeader, logRow } from './cli';
import { getDrop } from './story-reveal-specs/drops';

const MAX_EDGE = 1600;

const CONTENT_TYPES: Record<string, { type: string; encode: (img: Sharp) => Sharp }> = {
  '.png': { type: 'image/png', encode: (img) => img.png({ compressionLevel: 9 }) },
  '.jpg': { type: 'image/jpeg', encode: (img) => img.jpeg({ quality: 88, mozjpeg: true }) },
  '.jpeg': { type: 'image/jpeg', encode: (img) => img.jpeg({ quality: 88, mozjpeg: true }) },
  '.webp': { type: 'image/webp', encode: (img) => img.webp({ quality: 88 }) },
};

function encoderFor(file: string) {
  const ext = path.extname(file).toLowerCase();
  const entry = CONTENT_TYPES[ext];
  if (!entry) {
    throw new Error(`Unsupported image extension "${ext}" for ${path.basename(file)}. Use .png, .jpg, .jpeg or .webp.`);
  }
  return entry;
}

async function normalize(file: string): Promise<Buffer> {
  const { encode } = encoderFor(file);
  const before = await sharp(file).metadata();
  const pipeline = sharp(file)
    .flatten({ background: '#000000' })
    .toColourspace('srgb')
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true });
  const buffer = await encode(pipeline).toBuffer();
  const after = await sharp(buffer).metadata();
  console.log(
    `  normalized     ${before.width}×${before.height} (${before.hasAlpha ? 'alpha' : 'no alpha'}) → ` +
      `${after.width}×${after.height} · ${(buffer.length / 1024).toFixed(0)} KB`,
  );
  return buffer;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const slugs = slugsFromArgs(argv);
  const confirm = hasFlag(argv, 'confirm');
  const verifyOnly = hasFlag(argv, 'verify');
  const keepLocal = hasFlag(argv, 'keep-local');

  const url = supabaseProjectUrl();
  const admin = verifyOnly || confirm ? getAdminClient() : null;

  logHeader(verifyOnly ? '🎨 drop:assets — verify' : confirm ? '🎨 drop:assets — confirm' : '🎨 drop:assets — dry run');
  logRow('releases', slugs.join(', '));
  logRow('mode', verifyOnly ? 'verify' : confirm ? 'normalize + upload + rewrite' : 'inspect only');

  for (const slug of slugs) {
    const drop = getDrop(slug);
    console.log(`\n▸ ${slug}`);
    logRow('target', url);

    if (verifyOnly) {
      const urls = (['front', 'back'] as const).map((w) => publicUrlFor(url, storagePathFor(drop.spec, w)));
      const results = await verifyUrls(urls);
      for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${r.status || 'ERR'}  ${r.url}`);
      continue;
    }

    for (const which of ['front', 'back'] as AssetSide[]) {
      const local = localAssetAbs(drop.spec, which);
      const storagePath = storagePathFor(drop.spec, which);
      const publicUrl = publicUrlFor(url, storagePath);

      console.log(`\n  ${which}: ${path.relative(process.cwd(), local)}`);
      try {
        await fs.access(local);
      } catch {
        console.log(`  ✗ missing — add the photo there (Tapstitch download), then re-run.`);
        continue;
      }

      const buffer = await normalize(local);
      logRow('storage', storagePath);
      logRow('public', publicUrl);

      if (!confirm) continue;

      if (!keepLocal) {
        await fs.writeFile(local, buffer);
        console.log(`  ✓ local file rewritten (normalized, alpha-free RGB)`);
      }
      const { error } = await admin!.storage.from(PRODUCTS_BUCKET).upload(storagePath, buffer, {
        contentType: encoderFor(local).type,
        upsert: true,
        cacheControl: '31536000',
      });
      if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
      console.log(`  ✓ uploaded to ${PRODUCTS_BUCKET}/${storagePath}`);
    }
  }

  if (!confirm && !verifyOnly) {
    console.log(`\nDry run — nothing written. Re-run with --confirm to normalize + upload,` +
      ` then --verify to confirm the public URLs resolve.\n`);
  } else {
    console.log('');
  }
}

main().catch((err) => {
  console.error('\n❌ drop:assets failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
