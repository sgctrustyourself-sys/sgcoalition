// scripts/convertPngsToWebP.ts
// One-shot: downloads Supabase-hosted .png product images, converts to
// WebP via sharp, uploads WebP back to Supabase storage.
// USAGE
//   npx tsx scripts/convertPngsToWebP.ts --dry-run                  # list files only
//   npx tsx scripts/convertPngsToWebP.ts --confirm                   # download → convert → upload
//   npx tsx scripts/convertPngsToWebP.ts --confirm --delete-originals # also delete PNGs after upload

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'products';

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('!! .env must contain VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function extractSupabasePngUrls(): string[] {
    const productPath = path.resolve(__dirname, '../constants/products.ts');
    const src = fs.readFileSync(productPath, 'utf8');
    const re = /https:\/\/[a-z]+\.supabase\.co\/storage\/v1\/object\/public\/products\/[^"\s]+\.png/gi;
    const matches = new Set<string>();
    for (const m of src.matchAll(re)) matches.add(m[0]);
    return [...matches].sort();
}

function storageKeyFromUrl(url: string): string {
    const prefix = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(prefix);
    if (idx === -1) throw new Error(`Cannot parse storage key from: ${url}`);
    const key = url.slice(idx + prefix.length);
    return key.replace(/\.png$/i, '');
}

interface ConvertResult {
    oldUrl: string; newUrl: string; oldSize: number; newSize: number; savingsPct: number;
    deleted: boolean;
}

async function convertOne(oldUrl: string, deleteOriginals: boolean): Promise<ConvertResult> {
    const storageKey = storageKeyFromUrl(oldUrl);
    const baseName = path.basename(storageKey);
    console.log(`\n  Downloading ${baseName}.png ...`);

    const res = await fetch(oldUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const pngBuf = Buffer.from(await res.arrayBuffer());
    const oldSize = pngBuf.length;
    console.log(`     PNG ${(oldSize / 1024).toFixed(0)} KB`);

    const webpBuf = await sharp(pngBuf).webp({ quality: 85 }).toBuffer();
    const newSize = webpBuf.length;
    const savingsPct = ((1 - newSize / oldSize) * 100);
    console.log(`     WebP ${(newSize / 1024).toFixed(0)} KB  (${savingsPct > 0 ? '-' : '+'}${Math.abs(savingsPct).toFixed(0)}%)`);

    // Upload with same directory structure, .webp extension
    const dir = path.dirname(storageKey);
    const newStoragePath = dir === '.' ? `${baseName}.webp` : `${dir}/${baseName}.webp`;
    const { error } = await supabase.storage.from(BUCKET).upload(newStoragePath, webpBuf, {
        contentType: 'image/webp', upsert: true, cacheControl: '31536000',
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(newStoragePath);
    if (!data?.publicUrl) throw new Error('getPublicUrl returned no URL');
    console.log(`     ✅ uploaded`);

    let didDelete = false;

    // Delete the original PNG if requested
    if (deleteOriginals) {
        const pngStoragePath = dir === '.' ? `${baseName}.png` : `${dir}/${baseName}.png`;
        const { error: delErr } = await supabase.storage.from(BUCKET).remove([pngStoragePath]);
        if (delErr) {
            console.warn(`     ⚠️  Could not delete original PNG: ${delErr.message}`);
        } else {
            console.log(`     🗑  Deleted original PNG`);
            didDelete = true;
        }
    }

    return { oldUrl, newUrl: data.publicUrl, oldSize, newSize, savingsPct, deleted: didDelete };
}

async function runDry() {
    console.log('DRY RUN\n');
    const urls = extractSupabasePngUrls();
    console.log(`Found ${urls.length} unique Supabase PNGs:\n`);
    for (const u of urls) console.log(`  ${u}`);
    console.log(`\nRe-run with --confirm to download, convert, and upload.`);
}

async function runConfirm(deleteOriginals: boolean) {
    const tag = deleteOriginals ? 'CONFIRM + DELETE ORIGINALS' : 'CONFIRM';
    console.log(`${tag} — downloading, converting, uploading\n`);
    if (deleteOriginals) console.log('⚠️  Will DELETE original PNGs after successful WebP upload.\n');

    const urls = extractSupabasePngUrls();
    console.log(`Targeting ${urls.length} unique PNGs\n`);

    const results: ConvertResult[] = [];
    let totalOld = 0, totalNew = 0, deleted = 0;
    for (const url of urls) {
        try {
            const r = await convertOne(url, deleteOriginals);
            results.push(r);
            totalOld += r.oldSize;
            totalNew += r.newSize;
            if (r.deleted) deleted++;
        } catch (err) {
            console.error(`  FAILED: ${(err as Error).message}`);
        }
    }

    console.log('\n---');
    console.log(`${results.length}/${urls.length} converted`);
    console.log(`Before: ${(totalOld / 1024).toFixed(0)} KB PNG`);
    console.log(`After:  ${(totalNew / 1024).toFixed(0)} KB WebP`);
    if (totalOld > 0) console.log(`Savings: ${((1 - totalNew / totalOld) * 100).toFixed(0)}%`);
    if (deleteOriginals) console.log(`Deleted: ${deleted} originals`);

    console.log('\nURL REPLACEMENT MAP (old → new):\n');
    for (const r of results) {
        console.log(`${r.oldUrl}`);
        console.log(`  → ${r.newUrl}\n`);
    }

    const mapPath = path.resolve(__dirname, '../.webp-url-map.json');
    const urlMap: Record<string, string> = {};
    for (const r of results) urlMap[r.oldUrl] = r.newUrl;
    fs.writeFileSync(mapPath, JSON.stringify(urlMap, null, 2));
    console.log(`Mapping saved to .webp-url-map.json`);
}

const deleteOriginals = process.argv.includes('--delete-originals');
const mode = process.argv.includes('--dry-run') ? 'dry' : process.argv.includes('--confirm') ? 'confirm' : null;
if (!mode) {
    console.error('Usage: npx tsx scripts/convertPngsToWebP.ts [--dry-run | --confirm] [--delete-originals]');
    process.exit(1);
}

// --delete-originals only makes sense with --confirm
if (deleteOriginals && mode !== 'confirm') {
    console.error('--delete-originals requires --confirm');
    process.exit(1);
}

(async () => {
    try {
        mode === 'dry' ? await runDry() : await runConfirm(deleteOriginals);
    } catch (err) { console.error('\nAborted:', err); process.exit(1); }
})();
