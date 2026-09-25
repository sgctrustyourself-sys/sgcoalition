// scripts/uploadAboveAsBelowImages.ts
//
// Upload-the-Above-As-Below-images (one-shot).
//
// After scripts/auditImagePaths.ts flagged 6 broken /images/* paths across
// prod_set_above_as_below + prod_tee_above_as_below (and 2 of those paths
// also appear in PRODUCT_LOCAL_OVERRIDES for prod_tee_above_as_below),
// this script streams the 4 source PNGs from /public/images/ up to
// Supabase storage and rewrites every occurrence of the broken paths
// in constants.ts with the freshly-returned public URLs.
//
// Usage
//   # preview only — reads .env, prints intended URLs. NO uploads, NO rewrites
//   npx.cmd tsx scripts/uploadAboveAsBelowImages.ts --dry-run
//
//   # real run — uploads 4 files + rewrites constants.ts exactly
//   npx.cmd tsx scripts/uploadAboveAsBelowImages.ts --confirm
//
// Exit codes
//   0  dry-run complete OR confirm run succeeded
//   1  env missing, public file missing, upload/rewrite failed
//
// Design contract (mirrors the project convention set by
// scripts/fixProd1784012446238Sizing.ts):
//   - Static, predictable storage filenames + upsert:true so the script
//     is idempotent — repeat runs overwrite the same Supabase object
//     rather than orphaning duplicate assets.
//   - Uses SUPABASE_SERVICE_ROLE_KEY (NOT the anon key). RLS on the
//     products bucket requires it for writes.
//   - Fail-fast: aborts on the first error. No rollback because
//     upsert + static filenames + dry-run preview makes re-runs safe.
//   - Rewrites constants.ts via exact-match replaceAll on quoted forms
//     (handles both `"…"` and `'…'` because the file alternates between
//     TypeScript hand-written and JSON.stringify-style overwrites from
//     syncProductsToCode).
//   - Does NOT inline-handle the audit — re-run scripts/auditImagePaths.ts
//     manually to verify exit 0 after a --confirm (cleaner separation).

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
        '!! .env must contain VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
            '   The anon key (VITE_SUPABASE_ANON_KEY) will NOT work for storage uploads due to RLS.\n' +
            '   See Vercel project settings → Environment Variables for the operator-side key.'
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const BUCKET = 'products';

interface SourceFile {
    readonly storageKey: string;
    readonly diskRelPath: string;
    readonly contentType: string;
}

const SOURCES: SourceFile[] = [
    { storageKey: 'above-as-below-set-front.png',  diskRelPath: 'public/images/above-as-below-set-front.png',  contentType: 'image/png' },
    { storageKey: 'above-as-below-set-back.png',   diskRelPath: 'public/images/above-as-below-set-back.png',   contentType: 'image/png' },
    { storageKey: 'above-as-below-tee-front.png',  diskRelPath: 'public/images/above-as-below-tee-front.png',  contentType: 'image/png' },
    { storageKey: 'above-as-below-tee-back.png',   diskRelPath: 'public/images/above-as-below-tee-back.png',   contentType: 'image/png' },
];

const escapeForRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function uploadOne(src: SourceFile): Promise<string> {
    const diskPath = path.resolve(__dirname, '..', src.diskRelPath);
    if (!fs.existsSync(diskPath)) {
        throw new Error(`Source file missing on disk: ${diskPath}`);
    }
    const buf = fs.readFileSync(diskPath);

    const storagePath = `images/${src.storageKey}`;
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
        contentType: src.contentType,
        upsert: true,
        cacheControl: '3600',
    });
    if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    if (!data?.publicUrl) throw new Error(`Uploaded ${storagePath} but getPublicUrl returned no URL`);
    return data.publicUrl;
}

/**
 * Rewrites constants.ts by exact-match replacing every occurrence of the
 * broken /images/* path with the freshly-returned Supabase public URL.
 *
 * Handles BOTH quoting styles because the file has been overwritten by
 * syncProductsToCode (JSON.stringify-style double-quoted keys) in between
 * the operator's hand-written TypeScript sections (single-quoted or
 * unquoted keys). Exact string-replace is the safest primitive here —
 * parsing/serializing the TS file would corrupt both styles.
 */
function rewriteConstants(replacements: Array<{ brokenPath: string; newUrl: string }>): number {
    const constantsPath = path.resolve(__dirname, '../constants.ts');
    let constantsText = fs.readFileSync(constantsPath, 'utf8');
    let totalTokensReplaced = 0;

    for (const r of replacements) {
        // Three quoting variants could hold the path:  "..." | '...' | `...`
        // The exact inner string "/images/<...>.png" is the same in all cases.
        const variants: Array<{ pattern: RegExp; replacement: string }> = [
            { pattern: new RegExp(`"${escapeForRegex(r.brokenPath)}"`, 'g'), replacement: `"${r.newUrl}"` },
            { pattern: new RegExp(`'${escapeForRegex(r.brokenPath)}'`, 'g'), replacement: `"${r.newUrl}"` },
            { pattern: new RegExp('`' + escapeForRegex(r.brokenPath) + '`', 'g'), replacement: `"${r.newUrl}"` },
        ];

        for (const v of variants) {
            const before = (constantsText.match(v.pattern) || []).length;
            constantsText = constantsText.replace(v.pattern, v.replacement);
            totalTokensReplaced += before;
        }
    }

    fs.writeFileSync(constantsPath, constantsText, 'utf8');
    return totalTokensReplaced;
}

async function runDry(): Promise<void> {
    console.log('🟡 DRY RUN — no uploads, no writes\n');
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    console.log(`Bucket:       ${BUCKET}`);
    console.log(`Key source:   SUPABASE_SERVICE_ROLE_KEY  (redacted)`);

    console.log('\n4 source files in /public/images/:');
    for (const src of SOURCES) {
        const diskPath = path.resolve(__dirname, '..', src.diskRelPath);
        const exists = fs.existsSync(diskPath);
        const size = exists ? `${fs.statSync(diskPath).size} bytes` : 'MISSING';
        console.log(`  • ${src.storageKey.padEnd(34)}  (${size})`);
    }

    console.log('\n4 planned rewrites in constants.ts:');
    for (const src of SOURCES) {
        console.log(`  • "/images/${src.storageKey}"  →  <fresh Supabase public URL>`);
    }

    console.log('\nRe-run with --confirm to execute.\n');
}

async function runConfirm(): Promise<void> {
    console.log('🟢 CONFIRM RUN — uploading + rewriting\n');

    // 1. Upload 4 files + collect the new public URLs.
    const urlByKey = new Map<string, string>();
    for (const src of SOURCES) {
        const url = await uploadOne(src);
        urlByKey.set(src.storageKey, url);
        console.log(`  ✅ uploaded ${src.storageKey.padEnd(34)} → ${url}`);
    }

    // 2. Rewrite constants.ts.
    const tokens = rewriteConstants(
        SOURCES.map((src) => ({
            brokenPath: `/images/${src.storageKey}`,
            newUrl: urlByKey.get(src.storageKey)!,
        })),
    );
    console.log(`\n  ✅ constants.ts rewritten — ${tokens} string-tokens replaced.`);

    console.log('\nNext: re-run scripts/auditImagePaths.ts to confirm exit 0 (ALL CLEAN).\n');
}

const mode = process.argv.includes('--dry-run')
    ? 'dry'
    : process.argv.includes('--confirm')
      ? 'confirm'
      : null;

if (!mode) {
    console.error('Usage: tsx scripts/uploadAboveAsBelowImages.ts [--dry-run | --confirm]');
    process.exit(1);
}

(async () => {
    try {
        if (mode === 'dry') await runDry();
        else await runConfirm();
    } catch (err) {
        // Print the full error object (not just .message) so transient
        // failures surface the underlying cause — ETIMEDOUT, ECONNRESET,
        // and the supabase-js "Failed to fetch" wrapper often mask the
        // real network error in `.message` alone. The full object dumps
        // `.name`, `.code`, `.cause`, and any nested supabase error.
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
