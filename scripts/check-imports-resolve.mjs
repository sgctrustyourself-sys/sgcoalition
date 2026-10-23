// scripts/check-imports-resolve.mjs
//
// Pre-push guard: every relative import in the COMMITTED tree must resolve
// to a file that is also committed.
//
// The failure this catches is specific to how this repo is used. There is
// a large body of uncommitted work in the tree (and untracked new files).
// If a committed file imports a path that only exists untracked, the
// committed tree does not build — but the working tree does, because the
// untracked file is sitting right there. `npm run build` in the working
// directory cannot tell the difference, so a push can quietly ship a
// broken deployment.
//
// Concrete instance this was written for: pages/Checkout.tsx (committed)
// imports ../components/checkout/CheckoutOrderSummary, and
// components/checkout/ was still untracked. The working tree built fine;
// the committed tree would not have.
//
// It reads the tree at a ref (HEAD by default) so it checks what would
// actually be pushed rather than what happens to be on disk.
//
// Reading the tree goes through `git grep`, not `git show`/`cat-file`:
// this working copy sits on OneDrive, where git's mmap over the object
// database fails with "mmap failed: Invalid argument" for some blobs
// (admin/AnalyticsDashboard.tsx among them). `git grep` reads the same
// objects without the mmap.
//
// Matching rules, chosen to avoid false positives:
//   - comments are stripped first (a commented-out import is not an import)
//   - statements are anchored to a line start, so an import inside a string
//     literal — a test fixture, for instance — is not counted
//   - the runtime extension is mapped back to its TypeScript source
//     ("./_helpers.js" -> "./_helpers.ts"), the way NodeNext resolves it
//   - unresolved imports under tests/ are reported as warnings, not errors:
//     tests are not part of the deploy build
//
// Usage: node scripts/check-imports-resolve.mjs [ref]

import { execFileSync } from 'node:child_process';
import { posix } from 'node:path';

const ref = process.argv[2] || 'HEAD';

const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });

const tracked = new Set(
    git('ls-tree', '-r', '--name-only', ref)
        .split(/\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean)
);

const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const sourcePaths = [...tracked].filter((p) => SOURCE_RE.test(p));

// Every line of every source file at the ref, in one pass.
let grepOutput = '';
try {
    grepOutput = git('grep', '-n', '-e', '^', ref, '--', '*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs');
} catch (error) {
    if (error && error.status === 1) grepOutput = '';
    else throw error;
}

// Rebuild each file's content from the grep output.
//
// The output is `ref:path:lineNo:content`. The line number must be
// stripped as well as the ref and path: leaving it in place puts a ':' at
// the start of every line, which then defeats the `[^:]` guard in the
// line-comment stripper (a "//" preceded by ':' is treated as the "//" in
// a URL and left alone) — so commented-out imports survive and get
// reported as real ones.
const contents = new Map();
for (const line of grepOutput.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const first = line.indexOf(':');
    const second = line.indexOf(':', first + 1);
    const third = line.indexOf(':', second + 1);
    if (first === -1 || second === -1 || third === -1) continue;
    const file = line.slice(first + 1, second);
    const content = line.slice(third + 1);
    if (!contents.has(file)) contents.set(file, []);
    contents.get(file).push(content);
}

const candidatesFor = (base) => {
    const out = new Set([base]);
    for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']) out.add(base + ext);
    for (const idx of ['/index.ts', '/index.tsx', '/index.js', '/index.jsx']) out.add(base + idx);
    // NodeNext ESM: the import carries the RUNTIME extension
    // ("./_helpers.js") while the source file is TypeScript
    // ("./_helpers.ts"). The compiler resolves that; a plain path check
    // does not, so map the extension back.
    const jsExt = /\.(js|mjs|cjs)$/.exec(base);
    if (jsExt) {
        const stem = base.slice(0, -jsExt[0].length);
        for (const ext of ['.ts', '.tsx', '.mts', '.cts']) out.add(stem + ext);
    }
    return out;
};

/** Remove block and line comments so a commented-out import is not counted. */
const stripComments = (source) =>
    source
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const STATIC_IMPORT = /(?:^|[;\n])\s*(?:import|export)\b[^;]*?\bfrom\s*['"](\.[^'"]+)['"]/g;
const DYNAMIC_IMPORT = /(?:^|[;\n])\s*[^;\n]*?\b(?:import|require)\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

const errors = [];
const warnings = [];

for (const path of sourcePaths) {
    const lines = contents.get(path);
    if (!lines) continue;
    const cleaned = stripComments(lines.join('\n'));

    const specs = new Set();
    for (const m of cleaned.matchAll(STATIC_IMPORT)) specs.add(m[1]);
    for (const m of cleaned.matchAll(DYNAMIC_IMPORT)) specs.add(m[1]);

    const slash = path.lastIndexOf('/');
    const dir = slash === -1 ? '' : path.slice(0, slash);

    for (const spec of specs) {
        const base = spec.startsWith('./') || spec.startsWith('../')
            ? posix.normalize(posix.join(dir, spec))
            : spec;
        if ([...candidatesFor(base)].some((c) => tracked.has(c))) continue;

        const entry = `${path}  ->  ${spec}`;
        if (path.startsWith('tests/')) warnings.push(entry);
        else errors.push(entry);
    }
}

if (errors.length || warnings.length) {
    if (errors.length) {
        console.error(`Unresolved relative imports in the ${ref} tree (${errors.length}):`);
        for (const e of errors) console.error('  ' + e);
        console.error('');
        console.error('These paths are imported by committed code but are not committed.');
        console.error('Commit them before pushing, or the deployment will not build.');
    }
    if (warnings.length) {
        console.warn(`Unresolved relative imports under tests/ (${warnings.length}) — not part of the deploy build:`);
        for (const w of warnings) console.warn('  ' + w);
    }
    if (errors.length) process.exitCode = 1;
} else {
    console.log(`All relative imports in the ${ref} tree resolve to committed files (${tracked.size} files).`);
}
