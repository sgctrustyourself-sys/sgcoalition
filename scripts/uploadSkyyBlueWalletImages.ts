// scripts/uploadSkyyBlueWalletImages.ts
//
// One-shot repair for SKYYBLUEWALLET1_2 (the Skyy Blue wallet whose
// images got lost). Fetches 2 jpgs from imgur (Z5K3JZ0 + ySkgCOs),
// uploads them to Supabase storage as products/images/wallet-skyy-blue-
// {front,back}.jpg, and updates the products.images column with the
// freshly-returned public URLs.
//
// Why this exists
//   Today's audit extension (scripts/auditImagePaths.ts Section 2 + 3)
//   caught SKYYBLUEWALLET1_2 with two /images/products/wallet-skyy-blue/
//   {front,back}.jpg paths that 404 at runtime. The user reported the
//   lost images earlier and provided the two imgur URLs in the incident
//   thread. This script does the upload + DB sync in one shot.
//
// Idempotency
//   - Storage uploads use upsert:true + static filenames, so re-runs
//     overwrite the same Supabase object rather than orphaning duplicates.
//   - DB update is a partial patch of the `images` column only. Other
//     fields (name, price, sizes, size_inventory, archived, etc.) are
//     preserved as-is.
//
// Front/back mapping
//   The two imgur URLs were listed without explicit side labels. Order
//   from the operator's incident report maps to:
//     imgur/Z5K3JZ0  →  front   (PDP hero, the image the customer sees first)
//     imgur/ySkgCOs  →  back    (PDP secondary, swiped to)
//   To swap the mapping (e.g. operator confirms via visual inspection
//   that the order is reversed), swap the SOURCES array entries before
//   re-running --confirm. The script is read-only until --confirm.
//
// USAGE
//   # preview only — no uploads, no DB writes
//   npx.cmd tsx scripts/uploadSkyyBlueWalletImages.ts --dry-run
//
//   # real run — uploads 2 jpgs + writes products.images
//   npx.cmd tsx scripts/uploadSkyyBlueWalletImages.ts --confirm
//
// EXIT CODES
//   0  dry-run complete OR confirm run succeeded (uploads + DB sync)
//   1  env missing, imgur fetch failed, Supabase upload failed, DB write failed
//
// Auth
//   Uses SUPABASE_SERVICE_ROLE_KEY (NOT the anon key). RLS on the
//   products bucket + products table requires it for writes. Matches
//   the convention set by scripts/uploadAboveAsBelowImages.ts and
//   scripts/syncImageFieldsToSupabase.ts.

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
        '!! .env must contain VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
            '   The anon key (VITE_SUPABASE_ANON_KEY) will NOT work for storage uploads due to RLS.',
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const BUCKET = 'products';
const TARGET_ID = 'SKYYBLUEWALLET1_2';

interface SourceImage {
    readonly side: 'front' | 'back';
    readonly imgurId: string;
    readonly storageKey: string;
}

const SOURCES: ReadonlyArray<SourceImage> = [
    { side: 'front', imgurId: 'Z5K3JZ0', storageKey: 'wallet-skyy-blue-front.jpg' },
    { side: 'back',  imgurId: 'ySkgCOs', storageKey: 'wallet-skyy-blue-back.jpg'  },
];

const IMGUR_DIRECT = (id: string): string => `https://i.imgur.com/${id}.jpg`;

// Magic-byte signatures for the image formats we accept. Imgur often serves
// the original upload format regardless of the .jpg extension in the URL,
// so we cannot assume JPEG. PNG is the most common alternative for this
// batch; the lookup keeps the door open to add more formats later.
type SupportedContentType = 'image/jpeg' | 'image/png';
const MAGIC_BYTES: ReadonlyArray<{ type: SupportedContentType; bytes: ReadonlyArray<number> }> = [
    { type: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
    { type: 'image/png',  bytes: [0x89, 0x50, 0x4e] },
];

function detectContentType(buf: Buffer): SupportedContentType {
    for (const m of MAGIC_BYTES) {
        if (m.bytes.every((b, i) => buf[i] === b)) return m.type;
    }
    const hex = buf.slice(0, 8).toString('hex');
    throw new Error(
        `Unsupported image format (magic ${hex}). Accepted: JPEG (FF D8 FF), PNG (89 50 4E 47).`,
    );
}

async function fetchImageBytes(url: string): Promise<{ buffer: Buffer; contentType: SupportedContentType }> {
    const r = await fetch(url);
    if (!r.ok) {
        throw new Error(`HTTP ${r.status} fetching ${url}`);
    }
    const ab = await r.arrayBuffer();
    const buf = Buffer.from(ab);
    // Imgur can return HTML error pages with HTTP 200 (e.g. on stale IDs).
    // Magic-byte check is the only reliable signal that the body is an image.
    const contentType = detectContentType(buf);
    return { buffer: buf, contentType };
}

async function uploadOne(src: SourceImage): Promise<string> {
    const url = IMGUR_DIRECT(src.imgurId);
    console.log(`  → fetching ${src.side} (imgur/${src.imgurId})...`);
    const { buffer, contentType } = await fetchImageBytes(url);
    console.log(`     ${buffer.length} bytes, detected ${contentType}`);

    // Storage key keeps the .jpg extension to match the React app's
    // existing path pattern (wallet-skyy-blue-{front,back}.jpg). The
    // Supabase contentType metadata is set to the actual format so the
    // CDN serves the file with correct Content-Type response headers.
    const storagePath = `images/${src.storageKey}`;
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
        contentType,
        upsert: true,
        cacheControl: '3600',
    });
    if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    if (!data?.publicUrl) {
        throw new Error(`Uploaded ${storagePath} but getPublicUrl returned no URL`);
    }
    return data.publicUrl;
}

async function readCurrentImages(productId: string): Promise<string[] | null> {
    const { data, error } = await supabase
        .from('products')
        .select('images')
        .eq('id', productId)
        .maybeSingle();
    if (error) throw new Error(`Read failed for ${productId}: ${error.message}`);
    if (!data) return null;
    return Array.isArray(data.images) ? (data.images as string[]) : null;
}

async function runDry(): Promise<void> {
    console.log('🟡 DRY RUN — no uploads, no DB writes\n');
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    console.log(`Bucket:       ${BUCKET}`);
    console.log(`Target:       ${TARGET_ID} (Coalition Skyy Blue Wallet)\n`);

    const current = await readCurrentImages(TARGET_ID);
    if (current === null) {
        console.log(`  ⚠️  ${TARGET_ID} is NOT in Supabase. --confirm will fail unless the row exists.`);
    } else {
        console.log(`  Current images (${current.length}):`);
        for (const u of current) console.log(`    - ${u}`);
    }
    console.log();

    console.log('2 source images to fetch + upload:');
    for (const src of SOURCES) {
        console.log(`  • ${src.side.padEnd(6)} ${IMGUR_DIRECT(src.imgurId)}  →  ${BUCKET}/images/${src.storageKey}`);
    }

    console.log('\nRe-run with --confirm to execute.\n');
}

async function runConfirm(): Promise<void> {
    console.log('🟢 CONFIRM RUN — uploading + syncing DB\n');

    // 1. Fetch + upload 2 images
    const newUrls: string[] = [];
    for (const src of SOURCES) {
        const url = await uploadOne(src);
        newUrls.push(url);
        console.log(`     ✅ ${src.side} → ${url}`);
    }

    // 2. Update products.images column (scoped patch)
    const { error: dbError } = await supabase
        .from('products')
        .update({ images: newUrls })
        .eq('id', TARGET_ID);
    if (dbError) {
        throw new Error(`DB update failed for ${TARGET_ID}: ${dbError.message}`);
    }
    console.log(`\n  ✅ ${TARGET_ID} products.images updated (${newUrls.length} URLs)`);

    // 3. Re-verify by re-reading the row
    const stored = await readCurrentImages(TARGET_ID);
    if (!stored) {
        throw new Error(`Re-verify read for ${TARGET_ID} returned null — update may not have landed.`);
    }
    const allFresh =
        stored.length === newUrls.length && newUrls.every((u) => stored.includes(u));
    console.log(`  ${allFresh ? '✅' : '⚠️ '} re-verify: products.images now has ${stored.length} URLs`);
    for (const u of stored) console.log(`    - ${u}`);

    console.log('\nNext: re-run scripts/auditImagePaths.ts to confirm exit 0 (ALL CLEAN).\n');
}

const mode = process.argv.includes('--dry-run')
    ? 'dry'
    : process.argv.includes('--confirm')
      ? 'confirm'
      : null;

if (!mode) {
    console.error('Usage: tsx scripts/uploadSkyyBlueWalletImages.ts [--dry-run | --confirm]');
    process.exit(1);
}

(async () => {
    try {
        if (mode === 'dry') await runDry();
        else await runConfirm();
    } catch (err) {
        // Print the full error object (not just .message) so transient
        // failures surface their underlying cause. Mirrors the
        // uploadAboveAsBelowImages.ts error-shape contract.
        console.error('\n!! Aborted. Full error object:');
        console.error(err);
        if (err && typeof err === 'object') {
            console.error('--- error shape summary ---');
            console.error('  name:    ', (err as any).name);
            console.error('  message: ', (err as any).message);
            console.error('  code:    ', (err as any).code);
            console.error('  cause:   ', (err as any).cause);
        }
        process.exit(1);
    }
})();
