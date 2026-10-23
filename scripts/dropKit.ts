/**
 * scripts/dropKit.ts — shared plumbing for the drop generators.
 *
 * Owns exactly one policy each, so the generators stay thin and cannot disagree:
 *   - where a release's local source PNG lives (public/images/<name>.png)
 *   - where its Supabase copy lives (products bucket, images/<name>.png)
 *   - what URL the storefront row therefore carries
 *   - CLI argument parsing (--slug / --all / --confirm / --force / --test)
 *
 * The registry (scripts/story-reveal-specs/drops.ts) owns the DATA; this module
 * owns the PATHS and the process. Nothing here imports app/client code.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { argValue, hasFlag } from './cli';
import { DROPS, assetRelPath, getDrop, listDropSlugs } from './story-reveal-specs/drops';
import type { DropRelease, DropSpec } from './story-reveal-specs/drops';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const PRODUCTS_BUCKET = 'products';
export const DROP_IMAGE_DIR = 'images';

dotenv.config({ path: path.resolve(PROJECT_ROOT, '.env') });

export type AssetSide = 'front' | 'back';

// ─── Local assets ────────────────────────────────────────────────────────────

/** Absolute path of a release's local source PNG (public/images/...). */
export function localAssetAbs(spec: DropSpec, which: AssetSide): string {
  return path.join(PROJECT_ROOT, assetRelPath(spec, which));
}

/**
 * The URL the live site serves this asset at. `public/` is the web root, so
 * public/images/x.png is reachable at /images/x.png — which is what editorial
 * content should reference (it works before anything is uploaded to storage).
 */
export function publicAssetUrl(spec: DropSpec, which: AssetSide): string {
  return `/${DROP_IMAGE_DIR}/${path.basename(assetRelPath(spec, which))}`;
}

/** True when the release's declared front + back PNGs both exist on disk. */
export async function hasLocalAssets(spec: DropSpec): Promise<boolean> {
  const checks = await Promise.all(
    (['front', 'back'] as const).map((w) =>
      fs
        .access(localAssetAbs(spec, w))
        .then(() => true)
        .catch(() => false),
    ),
  );
  return checks.every(Boolean);
}

// ─── Supabase storage paths + public URLs ────────────────────────────────────

/**
 * Storage key for a release's image. Derived from the local filename so the
 * uploaded object is always byte-for-byte the file the renderer used — the
 * poster and the PDP cannot show different pictures.
 */
export function storagePathFor(spec: DropSpec, which: AssetSide): string {
  return `${DROP_IMAGE_DIR}/${path.basename(assetRelPath(spec, which))}`;
}

export function publicUrlFor(supabaseUrl: string, storagePath: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${PRODUCTS_BUCKET}/${storagePath}`;
}

/**
 * The storefront URLs a release gets: its explicit `listing.storeImages` when
 * set (the migrated Grey Wave row keeps its real imgur-migrated URLs), otherwise
 * the deterministic storage URLs `drop:assets` uploads to.
 */
export function resolveStoreImages(drop: DropRelease, supabaseUrl: string): string[] {
  if (drop.listing.storeImages.length) return drop.listing.storeImages;
  return (['front', 'back'] as const).map((w) =>
    publicUrlFor(supabaseUrl, storagePathFor(drop.spec, w)),
  );
}

/** HEAD each URL so a listing is never written with images that 404. */
export async function verifyUrls(urls: string[]): Promise<Array<{ url: string; ok: boolean; status: number }>> {
  return Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        return { url, ok: res.ok, status: res.status };
      } catch {
        return { url, ok: false, status: 0 };
      }
    }),
  );
}

// ─── Env + clients ───────────────────────────────────────────────────────────

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to .env before running this.`);
  return value;
}

/** Supabase project URL. Both env names hold the same project URL. */
export function supabaseProjectUrl(): string {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) throw new Error('VITE_SUPABASE_URL (or SUPABASE_URL) is not set in .env.');
  return url;
}

/** Service-role client — the only credential that can write products + storage. */
export function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url) throw new Error('VITE_SUPABASE_URL (or SUPABASE_URL) is not set in .env.');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in .env.');
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Release selection ───────────────────────────────────────────────────────

/**
 * Releases to act on: `--slug <one|comma,separated>`, `--all`, or nothing, which
 * defaults to every release in the most recent drop group (the thing you are
 * shipping today).
 */
export function slugsFromArgs(argv: string[]): string[] {
  if (hasFlag(argv, 'all')) return listDropSlugs();
  const raw = argValue(argv, 'slug');
  if (raw) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => getDrop(s).spec.slug);
  }
  const latestGroup = [...new Set(Object.values(DROPS).map((d) => d.dropId))].sort().pop();
  return Object.entries(DROPS)
    .filter(([, d]) => d.dropId === latestGroup)
    .map(([slug]) => slug)
    .sort();
}
