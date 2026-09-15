// scripts/syncImageFieldsToSupabase.ts
//
// One-shot Supabase images-column sync for the 2 Above-As-Below products
// that were repaired by scripts/uploadAboveAsBelowImages.ts.
//
// WHY THIS EXISTS
//   constants.ts was rewritten with 4 fresh Supabase storage URLs for
//   prod_set_above_as_below + prod_tee_above_as_below, but the React app's
//   fetchProducts does a spread merge: { ...local, ...sp } where sp is
//   the Supabase row. That means Supabase's `images` column overrides
//   the freshly-fixed constants.ts on every product fetch — so the live
//   PDPs kept rendering the OLD /images/ paths until the Supabase rows
//   were also updated. This script does that update.
//
// DESIGN CONTRACT
//   - Text-based regex on constants.ts (matches the existing project
//     convention used by scripts/auditImagePaths.ts + uploadAboveAsBelowImages.ts).
//   - Narrow scope: ONLY the 2 products named below. No broad sweep over
//     INITIAL_PRODUCTS — that could clobber other Supabase rows the
//     operator has intentionally edited DB-side.
//   - Scoped update: only the `images` column is touched. Description,
//     price, sizes, sizeInventory, archived, etc. are preserved as-is.
//   - Diff-and-update: reads current Supabase images for each product,
//     diffs against the new local images, prints the diff, and ONLY
//     applies on --confirm. --dry-run is a no-op read.
//   - Uses SUPABASE_SERVICE_ROLE_KEY (not anon — RLS rejects anon writes).
//
// USAGE
//   # preview only — reads .env, reads current Supabase state, prints
//   # intended diffs. NO writes.
//   npx.cmd tsx scripts/syncImageFieldsToSupabase.ts --dry-run
//
//   # real run — applies the diffs to Supabase
//   npx.cmd tsx scripts/syncImageFieldsToSupabase.ts --confirm
//
// EXIT CODES
//   0  dry-run complete OR confirm run succeeded AND no diff remained
//   1  env missing, parse failure, Supabase read/write failure

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { urlsEqual } from '../utils/imageUrlEquality';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
        '!! .env must contain VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
            '   The anon key (VITE_SUPABASE_ANON_KEY) will NOT work for writes due to RLS.'
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Hardcoded narrow scope: just the 2 products repaired today.
const TARGETS: Array<{ id: string; label: string }> = [
    { id: 'prod_set_above_as_below', label: 'COALITION ABOVE AS BELOW SET' },
    { id: 'prod_tee_above_as_below', label: 'COALITION ABOVE AS BELOW TEE' },
];

const escapeForRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Reads constants.ts as text and extracts the `images[]` array for a single
 * product id. Uses a block-split anchor at `{\n  "id":` (the JSON.stringify
 * style the file uses for INITIAL_PRODUCTS entries) and tracks brace-depth
 * to find the matching block close — then lazy-matches the images array
 * contents.
 *
 * Returns null if the product id is not found, or if the matched block has
 * no images[] array.
 */
function extractImagesFromConstants(productId: string): string[] | null {
    const constantsPath = path.resolve(__dirname, '../constants.ts');
    const text = fs.readFileSync(constantsPath, 'utf8');

    // 1. Find the block-starting line for this product id.
    const idLineRegex = new RegExp(`"id"\\s*:\\s*"${escapeForRegex(productId)}"`, 'g');
    const idMatch = idLineRegex.exec(text);
    if (!idMatch) return null;

    // 2. Walk back to the nearest `{` that opens the product object.
    const blockStart = text.lastIndexOf('{', idMatch.index);
    if (blockStart === -1) return null;

    // 3. Walk forward to find the matching `}` for this block. We can't
    //    naively indexOf('}') because the object contains nested braces
    //    (sizeInventory is an object literal). Track depth.
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let blockEnd = -1;
    for (let i = blockStart; i < text.length; i++) {
        const ch = text[i];
        if (escapeNext) { escapeNext = false; continue; }
        if (ch === '\\') { escapeNext = true; continue; }
        if (ch === '"' && !escapeNext) { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) { blockEnd = i; break; }
        }
    }
    if (blockEnd === -1) return null;

    const block = text.slice(blockStart, blockEnd + 1);

    // 4. Lazy-match the images array contents.
    const imagesMatch = block.match(/"images"\s*:\s*\[([\s\S]*?)\]/);
    if (!imagesMatch) return null;

    // 5. Pull out every quoted string in the array.
    const inner = imagesMatch[1];
    const urlRegex = /"((?:[^"\\]|\\.)*)"/g;
    const urls: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = urlRegex.exec(inner)) !== null) {
        urls.push(m[1]);
    }
    return urls.length > 0 ? urls : null;
}

async function fetchCurrentSupabaseImages(productId: string): Promise<string[] | null> {
    const { data, error } = await supabase
        .from('products')
        .select('images')
        .eq('id', productId)
        .maybeSingle();
    if (error) {
        throw new Error(`Supabase read for ${productId} failed: ${error.message}`);
    }
    if (!data) return null;
    return Array.isArray(data.images) ? (data.images as string[]) : null;
}

async function runDry(): Promise<void> {
    console.log('🟡 DRY RUN — no writes\n');
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    console.log(`Key source:   SUPABASE_SERVICE_ROLE_KEY  (redacted)`);
    console.log(`Target scope: ${TARGETS.length} product(s) — narrow, hardcoded\n`);

    for (const t of TARGETS) {
        const local = extractImagesFromConstants(t.id);
        const remote = await fetchCurrentSupabaseImages(t.id);

        console.log(`── ${t.id} (${t.label}) ──`);
        console.log(`  local  (constants.ts): ${local ? `${local.length} URLs` : 'NOT FOUND'}`);
        if (local) for (const u of local) console.log(`    - ${u}`);

        console.log(`  remote (Supabase DB): ${remote === null ? 'NOT IN DB' : `${remote.length} URLs`}`);
        if (remote) for (const u of remote) console.log(`    - ${u}`);

        if (urlsEqual(local, remote)) {
            console.log('  ✅ already in sync — no update needed');
        } else {
            console.log('  ⚠️  diff detected — would update remote with local');
        }
        console.log('');
    }

    console.log('Re-run with --confirm to apply the diffs.\n');
}

async function runConfirm(): Promise<void> {
    console.log('🟢 CONFIRM RUN — applying diffs\n');

    let updatesApplied = 0;
    for (const t of TARGETS) {
        const local = extractImagesFromConstants(t.id);
        const remote = await fetchCurrentSupabaseImages(t.id);

        if (!local) {
            console.error(`!! ${t.id}: could not parse images[] from constants.ts. Skipping.`);
            continue;
        }

        if (urlsEqual(local, remote)) {
            console.log(`  ✅ ${t.id} already in sync — no update needed`);
            continue;
        }

        // Scoped update: only the images column.
        const { error } = await supabase
            .from('products')
            .update({ images: local })
            .eq('id', t.id);
        if (error) {
            throw new Error(`Supabase write for ${t.id} failed: ${error.message}`);
        }
        console.log(`  ✅ ${t.id}: ${remote?.length ?? 0} URLs → ${local.length} URLs`);
        updatesApplied++;
    }

    console.log(`\n  Done. ${updatesApplied} update(s) applied.`);

    // Re-verify: re-read Supabase state and confirm diffs landed.
    console.log('\n🔍 Re-reading Supabase to confirm:');
    for (const t of TARGETS) {
        const local = extractImagesFromConstants(t.id);
        const remote = await fetchCurrentSupabaseImages(t.id);
        const ok = urlsEqual(local, remote);
        console.log(`  ${t.id}: ${ok ? '✅ in sync' : '⚠️ still differs'}`);
    }
    console.log('\nNext: re-verify the live PDPs in a browser to confirm the React app picks up the new images.\n');
}

const mode = process.argv.includes('--dry-run')
    ? 'dry'
    : process.argv.includes('--confirm')
      ? 'confirm'
      : null;

if (!mode) {
    console.error('Usage: tsx scripts/syncImageFieldsToSupabase.ts [--dry-run | --confirm]');
    process.exit(1);
}

(async () => {
    try {
        if (mode === 'dry') await runDry();
        else await runConfirm();
    } catch (err) {
        // Print the full error object (not just .message) so transient
        // Supabase failures surface their underlying cause.
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
