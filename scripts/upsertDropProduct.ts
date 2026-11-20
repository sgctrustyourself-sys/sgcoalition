/**
 * scripts/upsertDropProduct.ts — write a release's storefront row from the registry.
 *
 *   npx tsx scripts/upsertDropProduct.ts --slug pink-silver-crop-top            # dry run (default)
 *   npx tsx scripts/upsertDropProduct.ts --slug pink-silver-crop-top --confirm  # upsert + reseed
 *   npx tsx scripts/upsertDropProduct.ts                                        # newest drop group
 *
 * This is the generic replacement for the hand-cloned `scripts/add{Product}Wallet.ts`
 * files: one script, and the row it writes comes from the release's registry entry,
 * so the PDP can never disagree with the poster.
 *
 * Safety rails:
 *   - dry run by default; nothing is written without --confirm
 *   - every image URL is HEAD-checked first, and a --confirm write is refused if
 *     any of them 404s (an imageless listing is worse than no listing)
 *   - an existing ARCHIVED row is never silently revived; pass --force for that
 *   - featured exclusivity goes through utils/featuredExclusivity.ts, the same
 *     single owner the admin API and the add*Product scripts use
 *   - after a successful write it re-runs scripts/syncProducts.ts so
 *     constants/products.ts keeps the entries the database does not hold (it is not a
 *     mirror — see scripts/productSeed.ts), and only the release just written is
 *     rewritten into it
 */
import { spawnSync } from 'child_process';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getAdminClient,
  PROJECT_ROOT,
  resolveStoreImages,
  slugsFromArgs,
  supabaseProjectUrl,
  verifyUrls,
} from './dropKit';
import { hasFlag, logHeader, logRow } from './cli';
import { getDrop } from './story-reveal-specs/drops';
import type { DropRelease } from './story-reveal-specs/drops';
import { clearOtherFeaturedProducts } from '../utils/featuredExclusivity';

/** The Supabase row shape. Column names mirror api/_handlers/admin-products.ts. */
function buildRow(drop: DropRelease, images: string[]) {
  const total = Object.values(drop.listing.sizeInventory).reduce((sum, n) => sum + Number(n || 0), 0);
  return {
    id: drop.listing.id,
    name: drop.spec.productName,
    price: drop.listing.price,
    stock: total,
    images,
    description: drop.listing.description,
    category: drop.listing.category,
    is_featured: drop.listing.isFeatured,
    is_limited_edition: drop.listing.isLimitedEdition,
    sizes: drop.listing.sizes,
    size_inventory: drop.listing.sizeInventory,
    archived: false,
  };
}

function printRow(row: ReturnType<typeof buildRow>): void {
  logRow('id', row.id);
  logRow('name', row.name);
  logRow('price', `$${row.price}`);
  logRow('category', row.category);
  logRow('stock', `${row.stock} (${Object.entries(row.size_inventory).map(([s, n]) => `${s}:${n}`).join(' ')})`);
  logRow('limited', row.is_limited_edition ? 'yes' : 'no');
  logRow('featured', row.is_featured ? 'yes' : 'no');
  logRow('images', `${row.images.length}`);
  for (const image of row.images) console.log(`                 ${image}`);
  logRow('description', row.description.slice(0, 72) + (row.description.length > 72 ? '…' : ''));
}

/**
 * Refresh the local seed from the DB, naming only the releases just written:
 * `syncProducts --only` rewrites those entries and leaves every other entry —
 * including seed-only products with no DB row — exactly as it is. The rule lives
 * in scripts/productSeed.ts.
 */
function reseedConstants(writableIds: string[]): void {
  console.log(`\n  reseeding constants/products.ts — rewriting only ${writableIds.join(', ')}…`);
  const result = spawnSync('npx', ['tsx', path.join('scripts', 'syncProducts.ts'), '--only', writableIds.join(',')], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.warn(`  ⚠️  syncProducts exited ${result.status}. The DB row is written; re-run \`npx tsx scripts/syncProducts.ts\` to refresh the local seed.`);
  }
}

async function upsertOne(admin: SupabaseClient, url: string, drop: DropRelease, confirm: boolean, force: boolean, skipImageCheck: boolean): Promise<void> {
  console.log(`\n▸ ${drop.spec.slug}  (drop ${drop.dropDate})`);

  const images = resolveStoreImages(drop, url);
  if (!images.length) {
    console.log(`  ✗ no images. Run \`npm run drop:assets -- --slug ${drop.spec.slug} --confirm\` first.`);
    return;
  }
  if (!skipImageCheck) {
    const results = await verifyUrls(images);
    const broken = results.filter((r) => !r.ok);
    for (const r of results) console.log(`  ${r.ok ? '✓' : '✗'} ${String(r.status || 'ERR').padEnd(4)} ${r.url}`);
    if (broken.length) {
      console.log(`  ✗ ${broken.length} image URL(s) do not resolve. Upload them (\`npm run drop:assets -- --confirm\`), or pass --skip-image-check to write anyway.`);
      return;
    }
  }

  const row = buildRow(drop, images);
  printRow(row);

  const unitCost = drop.listing.unitCost;
  if (typeof unitCost === 'number') {
    const margin = row.price - unitCost;
    const pct = Math.round((margin / row.price) * 100);
    logRow('margin', `$${margin.toFixed(2)} per unit — $${row.price} sell − $${unitCost.toFixed(2)} cost (${pct}%)`);
  }

  const { data: existing, error: readError } = await admin
    .from('products')
    .select('id, archived, price, images, size_inventory')
    .eq('id', row.id)
    .maybeSingle();
  if (readError) throw new Error(`Could not read products row: ${readError.message}`);

  if (existing) {
    const dbImages = Array.isArray(existing.images) ? existing.images : [];
    console.log(`\n  existing row found — ${existing.archived ? 'ARCHIVED' : 'live'}, $${existing.price}, ${dbImages.length} image(s)`);
    if (existing.archived && !force) {
      console.log(`  ✗ refusing to revive an archived row. This release is sold/archived; pass --force only if you intend to re-list it.`);
      return;
    }
    const changes: string[] = [];
    if (existing.price !== row.price) changes.push(`price $${existing.price} → $${row.price}`);
    if (dbImages.length !== row.images.length) changes.push(`images ${dbImages.length} → ${row.images.length}`);
    const dbInv = JSON.stringify(existing.size_inventory || {});
    if (dbInv !== JSON.stringify(row.size_inventory)) changes.push('size_inventory');
    console.log(`  changes: ${changes.length ? changes.join(' · ') : 'none'}`);
  } else {
    console.log(`\n  new row (nothing at this id yet)`);
  }

  if (!confirm) return;

  const { error } = await admin.from('products').upsert([row]);
  if (error) throw new Error(`Upsert failed: ${error.message}`);
  console.log(`  ✓ written to products`);

  if (row.is_featured) {
    const result = await clearOtherFeaturedProducts(admin, row.id, row.is_featured, {
      warn: (message) => console.warn(`  ⚠️  ${message}`),
    });
    if (result.cleared) console.log(`  ✓ cleared ${result.clearedCount} other featured row(s)`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const slugs = slugsFromArgs(argv);
  const confirm = hasFlag(argv, 'confirm');
  const force = hasFlag(argv, 'force');
  const skipImageCheck = hasFlag(argv, 'skip-image-check');
  const url = supabaseProjectUrl();

  logHeader(confirm ? '📦 drop:list — confirm' : '📦 drop:list — dry run');
  logRow('releases', slugs.join(', '));
  logRow('supabase', url);
  logRow('mode', confirm ? 'upsert + reseed constants.ts' : 'inspect only');

  const admin = getAdminClient();
  for (const slug of slugs) {
    await upsertOne(admin, url, getDrop(slug), confirm, force, skipImageCheck);
  }

  if (confirm) reseedConstants(slugs.map((slug) => getDrop(slug).listing.id));
  else console.log(`\nDry run — nothing written. Re-run with --confirm to write the rows above.\n`);
}

main().catch((err) => {
  console.error('\n❌ drop:list failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
