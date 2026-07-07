/**
 * scripts/migrateImgurToSupabase.mjs
 *
 * One-shot Imgur -> Supabase Storage migration. Re-hosts every Imgur product
 * image so non-US shoppers stop hitting regional availability issues. After
 * this script runs:
 *   1. Every https://i.imgur.com/<hash>.<ext> is duplicated at
 *      images/migrated/imgur_<hash>.<ext> in the Supabase `products` bucket.
 *   2. utils/imgurSupabaseMap.ts is generated with the URL map (committed).
 *   3. Every source file referencing Imgur URLs is rewritten in place.
 *
 * Run:
 *   node scripts/migrateImgurToSupabase.mjs            # full migration + rewrite
 *   node scripts/migrateImgurToSupabase.mjs --dry      # no file writes
 *
 * Required in .env: SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(REPO_ROOT, '.env') });
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const client = createClient(SUPABASE_URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
});

const IMGUR = [
    ['https://i.imgur.com/3UUmYQa.jpg', 'jpg'],
    ['https://i.imgur.com/vRqjRG4.jpg', 'jpg'],
    ['https://i.imgur.com/IRhVbhN.jpg', 'jpg'],
    ['https://i.imgur.com/7ScdBnE.jpg', 'jpg'],
    ['https://i.imgur.com/dcw5qLQ.jpg', 'jpg'],
    ['https://i.imgur.com/hmPBbY3.jpg', 'jpg'],
    ['https://i.imgur.com/EylCpDU.jpg', 'jpg'],
    ['https://i.imgur.com/w8dahYm.jpg', 'jpg'],
    ['https://i.imgur.com/9NF3LzM.jpg', 'jpg'],
    ['https://i.imgur.com/UoY42bg.jpg', 'jpg'],
    ['https://i.imgur.com/UqtbJCq.jpeg', 'jpg'],
    ['https://i.imgur.com/7z2h8u6.jpeg', 'jpg'],
    ['https://i.imgur.com/FVMHZoq.jpeg', 'jpg'],
    ['https://i.imgur.com/LLoGORu.jpeg', 'jpg'],
    ['https://i.imgur.com/2VU7MEr.jpg', 'jpg'],
    ['https://i.imgur.com/hJgvL2K.jpg', 'jpg'],
    ['https://i.imgur.com/EsvBcv4.jpg', 'jpg'],
    ['https://i.imgur.com/J9EmRZq.jpg', 'jpg'],
    ['https://i.imgur.com/iYBlwm8.png', 'png'],
    ['https://i.imgur.com/jwnVHoI.png', 'png'],
    ['https://i.imgur.com/YNiTSFA.png', 'png'],
    ['https://i.imgur.com/HqcoV24.png', 'png'],
    ['https://i.imgur.com/6179VgH.png', 'png'],
    ['https://i.imgur.com/kzIWQzA.jpg', 'jpg'],
    ['https://i.imgur.com/hs4lZFg.jpg', 'jpg'],
    ['https://i.imgur.com/rJSCmHu.jpg', 'jpg'],
    ['https://i.imgur.com/1FwLI72.jpg', 'jpg'],
    ['https://i.imgur.com/Z5K3JZ0.png', 'png'],
    ['https://i.imgur.com/ySkgCOs.png', 'png'],
    ['https://i.imgur.com/SS6KbOQ.jpeg', 'jpg'],
    ['https://i.imgur.com/NUXZizv.jpeg', 'jpg'],
    ['https://i.imgur.com/juuQ8jz.png', 'png'],
    ['https://i.imgur.com/IXvoGU6.png', 'png'],
    ['https://i.imgur.com/coiMyd6.png', 'png'],
    ['https://i.imgur.com/DpkQWuU.png', 'png'],
    ['https://i.imgur.com/BoayHw0.png', 'png'],
    ['https://i.imgur.com/HFMfNYr.png', 'png'],
    ['https://i.imgur.com/EqDgC3h.png', 'png'],
    ['https://i.imgur.com/X4it3yW.png', 'png'],
    ['https://i.imgur.com/IXJsUIn.png', 'png'],
    ['https://i.imgur.com/DJJY3LT.png', 'png'],
    ['https://i.imgur.com/AAW60N3.png', 'png'],
    ['https://i.imgur.com/k3cZbA3.png', 'png'],
    ['https://i.imgur.com/nzsauOz.jpg', 'jpg'],
    ['https://i.imgur.com/wYR7Nfx.jpg', 'jpg'],
    ['https://i.imgur.com/v4xVrou.jpg', 'jpg'],
    ['https://i.imgur.com/OKefysC.jpg', 'jpg'],
    ['https://i.imgur.com/VlTUzGd.jpeg', 'jpg'],
    ['https://i.imgur.com/uwKceKV.jpg', 'jpg'],
    ['https://i.imgur.com/1S7Hkyw.jpg', 'jpg'],
    ['https://i.imgur.com/u0qjWgl.jpg', 'jpg'],
    ['https://i.imgur.com/evsuOt6.jpg', 'jpg'],
    ['https://i.imgur.com/gaA93ug.jpg', 'jpg'],
    ['https://i.imgur.com/cYmL6GQ.jpg', 'jpg'],
    ['https://i.imgur.com/IVmfRGx.jpg', 'jpg'],
    ['https://i.imgur.com/v5y7tPa.jpg', 'jpg'],
    ['https://i.imgur.com/B72Iael.jpg', 'jpg'],
    ['https://i.imgur.com/aphcZ2t.jpg', 'jpg'],
    ['https://i.imgur.com/e7M0POe.jpg', 'jpg'],
    ['https://i.imgur.com/8Q9Z5bX.png', 'png'],
];

const FILES = [
    'constants.ts',
    'utils/localImageAssets.ts',
    'utils/liveOrdersFeed.ts',
    'data/blogPosts.ts',
    'pages/CustomWallets.tsx',
    'full_products.json',
    'scripts/addSkyyWallet.ts',
    'scripts/addChromeHeartsWallet.ts',
    'scripts/addAboveAsBelowWallet1_1.ts',
    'scripts/updateWalletImgur.ts',
    'scripts/addGreyWaveWallet22.ts',
    'scripts/generateSeoArtifacts.mjs',
    'docs/drop-kit-grey-wave.md',
    'docs/drop-kit-grey-wave.html',
    'docs/preview-grey-wave-assets.html',
    'README.md',
    'tests/liveOrdersFeed.test.ts',
];

async function downloadToBuffer(url) {
    const res = await fetch(url, {
        redirect: 'follow',
        headers: {
            'User-Agent': 'SGCoalition-Migrator/1.0',
            Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8',
        },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + res.statusText);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer || buffer.length < 32) throw new Error('payload too small');
    return { buffer, contentType: res.headers.get('content-type') || '' };
}

function publicUrlFor(path) {
    const { data } = client.storage.from('products').getPublicUrl(path);
    return data.publicUrl;
}

async function uploadOne(buffer, contentType, destPath) {
    const { error } = await client.storage.from('products').upload(destPath, buffer, {
        contentType, cacheControl: '3600', upsert: true,
    });
    if (error) throw error;
    return publicUrlFor(destPath);
}

function hashFromUrl(url) {
    const m = url.match(/imgur\.com\/(?:a\/)?([A-Za-z0-9]+)/);
    return m ? m[1] : null;
}

function renderMapFile(map) {
    const body = Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',').join('\n');
    return '/**\n'
        + ' * utils/imgurSupabaseMap.ts - generated by scripts/migrateImgurToSupabase.mjs.\n'
        + ' * Legacy Imgar URLs used by older Supabase rows; resolveLocalImageUrl +\n'
        + ' * rewriteImageSrcs fall through this map. Map is empty until the migrator\n'
        + ' * has run, in which case the resolver passes the Imgur URL through.\n'
        + ' * Do NOT edit by hand - re-run the migration script.\n'
        + ' */\n'
        + 'export const IMGUR_TO_SUPABASE_MAP: Record<string, string> = {\n' + body + '\n};\n';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    const dryRun = process.argv.includes('--dry');
    const outMap = path.join(REPO_ROOT, 'utils', 'imgurSupabaseMap.ts');
    console.log('Migrating ' + IMGUR.length + ' Imgar URL(s) -> Supabase...');

    const map = {};
    const failed = [];
    for (let i = 0; i < IMGUR.length; i++) {
        const [url, fallbackExt] = IMGUR[i];
        process.stdout.write('  [' + (i + 1) + '/' + IMGUR.length + '] ' + url + ' ... ');
        try {
            const { buffer, contentType } = await downloadToBuffer(url);
            const ct = contentType.split(';')[0].trim();
            const ext = ct === 'image/png' ? 'png'
                : ct === 'image/webp' ? 'webp'
                : ct === 'image/gif' ? 'gif' : fallbackExt;
            const hash = hashFromUrl(url);
            if (!hash) throw new Error('no hash in URL');
            const destPath = 'images/migrated/imgur_' + hash + '.' + ext;
            const publicUrl = await uploadOne(buffer, ct, destPath);
            console.log('-> ' + publicUrl);
            map[url] = publicUrl;
        } catch (err) {
            console.log('FAILED: ' + err.message);
            failed.push({ url, error: err.message });
        }
        await sleep(250);
    }

    console.log('\nMigrated: ' + Object.keys(map).length + '/' + IMGUR.length);
    if (failed.length) console.log('Failures:', failed);

    if (dryRun) {
        console.log('--dry: skipped map + file rewrites.');
        return;
    }

    await fs.mkdir(path.dirname(outMap), { recursive: true });
    await fs.writeFile(outMap, renderMapFile(map), 'utf8');
    console.log('Wrote map -> ' + path.relative(REPO_ROOT, outMap));

    console.log('\nRewriting files...');
    for (const rel of FILES) {
        const abs = path.join(REPO_ROOT, rel);
        let original;
        try { original = await fs.readFile(abs, 'utf8'); }
        catch (err) { console.warn('  skip ' + rel + ' (' + (err.code || err.message) + ')'); continue; }
        let current = original;
        let swaps = 0;
        for (const [imgurUrl, supabaseUrl] of Object.entries(map)) {
            const parts = current.split(imgurUrl);
            if (parts.length > 1) {
                swaps += parts.length - 1;
                current = parts.join(supabaseUrl);
            }
        }
        if (swaps > 0) {
            await fs.writeFile(abs, current, 'utf8');
            console.log('  rewrote ' + rel + ' (' + swaps + ')');
        } else {
            console.log('  no-op ' + rel);
        }
    }
}

main().catch(err => { console.error(err); process.exit(1); });
