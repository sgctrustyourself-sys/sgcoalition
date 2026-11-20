// scripts/buildSitesAssets.mjs
//
// Builds the static bundle that Freebuff Sites will actually accept.
//
// The Vite build is sized for Vercel, where a 47 MB asset tree is fine. The
// Sites uploader rejects anything whose files blow past its caps, and it does
// so with a single opaque "Site file exceeds the upload limit" error — so the
// production Worker ends up deployed with no assets at all and answers every
// request with 502 "Site unavailable". This script produces the same site with
// the images re-encoded as WebP, which is what gets it under the cap without
// touching the Vercel build.
//
// Usage: node scripts/buildSitesAssets.mjs [--src dist] [--out dist-sites]
//
// It fails loudly (exit 1) on: an oversized bundle, too many files, or an image
// reference left dangling after the rewrite.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Caps enforced by the Sites uploader for a non-framework site.
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 1000;

const MAX_WIDTH = 1200;
const WEBP_QUALITY = 72;

// Images that must keep their original format. Social crawlers want JPEG for
// og:image, and iOS/Android home-screen icons are only reliably read as PNG.
const KEEP_AS_IS = new Set(['images/logo.png']);
const KEEP_DIRS = ['og'];

// Never uploaded: build diagnostics and source maps.
const DROP = [
    /\.map$/i,
    /^stats\.html$/,
];

const IMAGE_EXT = /\.(png|jpe?g)$/i;
const TEXT_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest', '.xml', '.txt', '.svg']);

function parseArgs(argv) {
    const args = { src: 'dist', out: 'dist-sites' };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--src') args.src = argv[++i];
        else if (argv[i] === '--out') args.out = argv[++i];
    }
    return args;
}

function walk(dir, rel = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...walk(abs, relPath));
        else if (entry.isFile()) files.push(relPath);
        else throw new Error(`refusing to copy non-regular file: ${relPath}`);
    }
    return files;
}

function isKept(relPath) {
    if (KEEP_AS_IS.has(relPath)) return true;
    return KEEP_DIRS.some((dir) => relPath === dir || relPath.startsWith(`${dir}/`));
}

function bytesOf(dir, files) {
    return files.reduce((sum, rel) => sum + fs.statSync(path.join(dir, rel)).size, 0);
}

const mb = (bytes) => `${(bytes / 1048576).toFixed(2)} MB`;

async function main() {
    const { src, out } = parseArgs(process.argv.slice(2));
    const srcDir = path.resolve(PROJECT_ROOT, src);
    const outDir = path.resolve(PROJECT_ROOT, out);

    if (!fs.existsSync(path.join(srcDir, 'index.html'))) {
        console.error(`build ${src}/index.html first — ${src} has no index.html`);
        process.exit(1);
    }

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.cpSync(srcDir, outDir, { recursive: true });

    // 1. Drop files the uploader rejects outright.
    const copied = walk(outDir);
    let dropped = 0;
    for (const rel of copied) {
        if (DROP.some((pattern) => pattern.test(rel))) {
            fs.rmSync(path.join(outDir, rel));
            dropped++;
        }
    }

    // 2. Re-encode images, remembering each rename so references can follow.
    const renames = new Map();
    let beforeImageBytes = 0;
    let afterImageBytes = 0;

    for (const rel of walk(outDir)) {
        if (!IMAGE_EXT.test(rel) || isKept(rel)) continue;
        const abs = path.join(outDir, rel);
        const original = fs.statSync(abs).size;
        beforeImageBytes += original;

        const webp = await sharp(abs)
            .resize({ width: MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY, effort: 5 })
            .toBuffer();

        // Never ship a "compressed" file that got bigger.
        if (webp.length >= original) {
            afterImageBytes += original;
            continue;
        }

        const webpRel = rel.replace(IMAGE_EXT, '.webp');
        fs.writeFileSync(path.join(outDir, webpRel), webp);
        fs.rmSync(abs);
        afterImageBytes += webp.length;
        renames.set(rel, webpRel);
    }

    // 3. Point every text reference at the new file names.
    const rewritten = [];
    const staleRefs = [];

    for (const rel of walk(outDir)) {
        const ext = path.extname(rel).toLowerCase();
        if (!TEXT_EXT.has(ext)) continue;

        const abs = path.join(outDir, rel);
        const original = fs.readFileSync(abs, 'utf8');
        let text = original;

        for (const [from, to] of renames) {
            if (!text.includes(from)) continue;
            text = text.split(from).join(to);
        }

        if (text !== original) {
            fs.writeFileSync(abs, text);
            rewritten.push(rel);
        }

        // Anything still naming a converted file is a reference we missed.
        for (const from of renames.keys()) {
            if (text.includes(from)) staleRefs.push(`${rel} -> ${from}`);
        }
    }

    // 4. Verify every literal image reference resolves. A reference the source
    // bundle already could not resolve (product rows in Supabase naming images
    // that were never shipped) is reported but must not fail the build; only a
    // reference this script broke counts against us.
    const present = new Set(walk(outDir));
    const missing = [];
    const preExisting = [];

    const existedInSource = (target) => {
        if (fs.existsSync(path.join(srcDir, target))) return true;
        if (!target.endsWith('.webp')) return false;
        const base = target.slice(0, -'.webp'.length);
        return ['.png', '.jpg', '.jpeg'].some((ext) => fs.existsSync(path.join(srcDir, base + ext)));
    };

    for (const rel of walk(outDir)) {
        const ext = path.extname(rel).toLowerCase();
        if (!TEXT_EXT.has(ext)) continue;
        const text = fs.readFileSync(path.join(outDir, rel), 'utf8');
        const matches = text.match(/\/?(?:images|og|assets\/arcade)\/[A-Za-z0-9._@-]+\.(?:png|jpe?g|webp|svg)/g) || [];
        for (const match of matches) {
            const target = match.replace(/^\//, '');
            if (present.has(target)) continue;
            if (existedInSource(target)) missing.push(`${rel} -> ${match}`);
            else preExisting.push(`${rel} -> ${match}`);
        }
    }

    // 5. Report against the uploader's caps.
    const finalFiles = walk(outDir);
    const total = bytesOf(outDir, finalFiles);

    console.log(`source        ${src}`);
    console.log(`output        ${out}`);
    console.log(`images        ${mb(beforeImageBytes)} -> ${mb(afterImageBytes)} (${renames.size} re-encoded to WebP)`);
    console.log(`dropped       ${dropped} file(s) (source maps, build stats)`);
    console.log(`references    ${rewritten.length} text file(s) rewritten`);
    if (preExisting.length) {
        console.log(`pre-existing  ${preExisting.length} dangling image reference(s) already broken in ${src}/ (not caused here)`);
    }
    console.log(`bundle        ${mb(total)} in ${finalFiles.length} files`);
    console.log(`caps          ${mb(MAX_TOTAL_BYTES)} / ${MAX_FILES} files`);

    let failed = false;
    if (staleRefs.length) {
        failed = true;
        console.error(`\nstale references to re-encoded images (${staleRefs.length}):`);
        for (const ref of staleRefs.slice(0, 20)) console.error(`  ${ref}`);
    }
    if (missing.length) {
        failed = true;
        console.error(`\nreferences this build broke — file existed in ${src}/ before the rewrite (${missing.length}):`);
        for (const ref of missing.slice(0, 20)) console.error(`  ${ref}`);
    }
    if (total > MAX_TOTAL_BYTES) {
        failed = true;
        console.error(`\nbundle is ${mb(total)}, ${mb(total - MAX_TOTAL_BYTES)} over the cap — lower MAX_WIDTH or WEBP_QUALITY`);
    }
    if (finalFiles.length > MAX_FILES) {
        failed = true;
        console.error(`\n${finalFiles.length} files exceeds the ${MAX_FILES}-file cap`);
    }

    if (failed) process.exit(1);
    console.log('\nok — bundle fits the Sites uploader caps');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
