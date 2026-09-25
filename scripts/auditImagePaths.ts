// scripts/auditImagePaths.ts
//
// Image-Path Audit (dry-run, no writes).
//
// Reads `constants.ts` and (optionally) the live Supabase products table,
// then prints a 3-section report:
//   [Section 1] Local:  constants.ts INITIAL_PRODUCTS image URLs
//   [Section 2] Remote: Supabase products.images (all rows incl. archived)
//   [Section 3] Cross-check: Local vs Remote drift on shared product ids
//
// Operator fixes drift by:
//   - Editing constants.ts directly (local drift)
//   - Re-running scripts/uploadAboveAsBelowImages.ts (broken remote URLs)
//   - Running scripts/syncImageFieldsToSupabase.ts (local↔remote mismatch)
//
// Today's incident — Supabase had stale /images/* paths overriding the
// freshly-fixed constants.ts via the React app's `{ ...local, ...sp }`
// spread merge — is exactly the failure mode Sections 2 + 3 prevent.
//
// USAGE:   npx.cmd tsx scripts/auditImagePaths.ts
// EXIT:    0 clean. 1 any drift / any broken URL / fetch error.
//
// SCOPE:   INITIAL_PRODUCTS only — PRODUCT_LOCAL_OVERRIDES has no `images`
//          overrides (its unquoted keys don't match the BLOCK_BOUNDARY
//          anchor). Supabase section fetches ALL rows so archived entries
//          are flagged before the operator un-archives them.
//
// AUTHENTICATION (graceful degradation):
//   - Prefers SUPABASE_SERVICE_ROLE_KEY (full read, RLS bypass)
//   - Falls back to VITE_SUPABASE_ANON_KEY if only that is present
//   - If neither is set, Sections 2 + 3 print SKIPPED; exit code still
//     reflects Section 1's outcome (so CI without secrets still gates the
//     local-only check).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { urlsEqual } from '../utils/imageUrlEquality';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONSTANTS_PATH = join(__dirname, '..', 'constants.ts');
dotenv.config({ path: join(__dirname, '..', '.env') });

// ── URL classification ──────────────────────────────────────────────────────

// Canonical hosts the storefront's <img> tags can resolve cleanly.
const CANONICAL_PATTERNS: ReadonlyArray<RegExp> = [
    /^https:\/\/i\.imgur\.com\//i,
    /^https:\/\/tvacscfbzcmjlcekjcsn\.supabase\.co\/storage\//i,
];

const BROKEN_PATTERNS: ReadonlyArray<{ name: BrokenReason; re: RegExp }> = [
    { name: 'LOCAL_RELATIVE_PATH', re: /^\/(?!\/)/ },
    { name: 'INSECURE_HTTP', re: /^http:\/\//i },
];

type BrokenReason =
    | 'LOCAL_RELATIVE_PATH'
    | 'INSECURE_HTTP'
    | 'NON_CANONICAL_HOST'
    | 'OTHER';

interface ImageIssue {
    url: string;
    reason: BrokenReason;
}

/**
 * Per-product scan result. `images` is the parsed URL list (always
 * populated, even when full of broken URLs) so the cross-check can
 * compare apples-to-apples between local and remote.
 */
interface ProductImageAudit {
    id: string;
    name: string;
    images: string[];
    issues: ImageIssue[];
}

function unescape(s: string): string {
    return s
        .replace(/\\\\/g, '\\')
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t');
}

function classify(url: string): BrokenReason | null {
    if (CANONICAL_PATTERNS.some((re) => re.test(url))) return null;
    for (const p of BROKEN_PATTERNS) {
        if (p.re.test(url)) return p.name;
    }
    if (!/^https?:\/\//i.test(url)) return 'OTHER';
    return 'NON_CANONICAL_HOST';
}

// ── Section 1: Local audit (constants.ts) ──────────────────────────────────

// Each INITIAL_PRODUCTS row opens with `{\n  "id":` (JSON.stringify-style
// after a syncProductsToCode run). The quoted-key anchor deliberately
// skips PRODUCT_LOCAL_OVERRIDES (unquoted keys) AND hand-written INITIAL
// rows that haven't been through a code→db sync. Future enhancement:
// widen the anchor to also catch unquoted `id: "..."` if needed.
const BLOCK_BOUNDARY = /(?=\{\s*\n\s*"id"\s*:\s*")/g;

function auditLocal(
    src: string,
): { products: Map<string, ProductImageAudit>; dupIds: string[] } {
    const products = new Map<string, ProductImageAudit>();
    const dupIds: string[] = [];
    const blocks = src.split(BLOCK_BOUNDARY);

    for (const block of blocks) {
        const idMatch = block.match(/^\s*"id"\s*:\s*"((?:[^"\\]|\\.)*)"/m);
        if (!idMatch) continue;
        const id = unescape(idMatch[1]);
        const nameMatch = block.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const name = nameMatch ? unescape(nameMatch[1]) : '(unknown)';

        const arrMatch = block.match(/"images"\s*:\s*\[([\s\S]*?)\]/);
        const urls: string[] = [];
        if (arrMatch) {
            const urlRe = /"((?:https?:\/\/|\/)[^"]+)"/g;
            let m: RegExpExecArray | null;
            while ((m = urlRe.exec(arrMatch[1]))) urls.push(m[1]);
        }

        const issues: ImageIssue[] = [];
        for (const u of urls) {
            const r = classify(u);
            if (r !== null) issues.push({ url: u, reason: r });
        }

        if (products.has(id)) {
            dupIds.push(id);
            continue; // first-wins; the warning at print time is the operator hint
        }
        products.set(id, { id, name, images: urls, issues });
    }

    return { products, dupIds };
}

// ── Section 2: Remote audit (Supabase products.images) ──────────────────────

interface SupabaseConfig {
    readonly url: string;
    readonly key: string;
}

function resolveSupabaseConfig(): SupabaseConfig | null {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || (!svcKey && !anonKey)) return null;
    return { url, key: (svcKey || anonKey) as string };
}

type AuditRemoteOutcome =
    | { kind: 'skipped' }
    | { kind: 'fetchError'; message: string }
    | { kind: 'ok'; products: Map<string, ProductImageAudit> };

async function auditRemote(): Promise<AuditRemoteOutcome> {
    const cfg = resolveSupabaseConfig();
    if (!cfg) return { kind: 'skipped' };

    const supabase = createClient(cfg.url, cfg.key);
    const { data, error } = await supabase.from('products').select('id, name, images');

    if (error) return { kind: 'fetchError', message: error.message };
    if (!data) return { kind: 'ok', products: new Map() };

    const products = new Map<string, ProductImageAudit>();
    for (const row of data as Array<{
        id: string;
        name?: string | null;
        images?: string[] | null;
    }>) {
        // Defensive normalize: null column → empty array. Empty arrays audit clean.
        const rawImages = Array.isArray(row.images) ? row.images : [];
        const urls = rawImages.filter((u): u is string => typeof u === 'string');
        const issues: ImageIssue[] = [];
        for (const u of urls) {
            const r = classify(u);
            if (r !== null) issues.push({ url: u, reason: r });
        }
        products.set(row.id, {
            id: row.id,
            name: row.name ?? '(unknown)',
            images: urls,
            issues,
        });
    }
    return { kind: 'ok', products };
}

// ── Section 3: Cross-check drift detection ──────────────────────────────────

interface DriftInstance {
    id: string;
    /**
     * - 'BOTH_HAVE_ISSUES'   : one or both sides have at least one broken URL.
     *                          Today's pre-fix state: local clean (after edit),
     *                          remote still has /images/ paths.
     * - 'MISMATCH'           : neither side has broken URLs but the URL arrays
     *                          differ (order-sensitive). React's spread merge
     *                          would silently use whichever side won.
     * - 'REMOTE_ONLY_BROKEN' : product exists in Supabase but not in
     *                          INITIAL_PRODUCTS, and it has at least one
     *                          broken URL.
     */
    kind: 'BOTH_HAVE_ISSUES' | 'MISMATCH' | 'REMOTE_ONLY_BROKEN';
    localCount?: number;
    remoteCount?: number;
    brokenSamples?: ImageIssue[];
}

function crossCheck(
    local: Map<string, ProductImageAudit>,
    remote: Map<string, ProductImageAudit> | null,
): DriftInstance[] {
    if (!remote) return [];
    const drift: DriftInstance[] = [];
    const allIds = new Set<string>([...local.keys(), ...remote.keys()]);
    for (const id of allIds) {
        const l = local.get(id);
        const r = remote.get(id);
        const localBroken = !!l && l.issues.length > 0;
        const remoteBroken = !!r && r.issues.length > 0;
        const sameArrays = urlsEqual(l?.images, r?.images);

        if (l && r) {
            if (localBroken || remoteBroken) {
                const samples: ImageIssue[] = [];
                for (const i of l.issues) samples.push(i);
                for (const i of r.issues) samples.push(i);
                drift.push({
                    id,
                    kind: 'BOTH_HAVE_ISSUES',
                    localCount: l.images.length,
                    remoteCount: r.images.length,
                    brokenSamples: samples.slice(0, 4),
                });
            } else if (!sameArrays) {
                drift.push({
                    id,
                    kind: 'MISMATCH',
                    localCount: l.images.length,
                    remoteCount: r.images.length,
                });
            }
            // else: both clean + same arrays → no drift
        } else if (r && remoteBroken) {
            drift.push({
                id,
                kind: 'REMOTE_ONLY_BROKEN',
                remoteCount: r.images.length,
                brokenSamples: r.issues.slice(0, 4),
            });
        }
        // Local-only / remote-only-clean → not a bug; intentional drift.
    }
    return drift;
}

// ── Print + exit-code glue ────────────────────────────────────────────────

function printReport(
    local: Map<string, ProductImageAudit>,
    dupIds: string[],
    remote: AuditRemoteOutcome,
    drift: DriftInstance[],
): void {
    const localBroken = [...local.values()].filter((p) => p.issues.length > 0);

    console.log('========================================================');
    console.log(' Coalition Image-Path Audit (dry-run, no writes)');
    console.log('========================================================');
    console.log();

    // ── Section 1 ──
    console.log('[Section 1] Local: constants.ts (INITIAL_PRODUCTS)');
    if (localBroken.length === 0) {
        console.log(`  ✓ All ${local.size} local product(s) have clean images.`);
    } else {
        for (const p of localBroken.sort((a, b) =>
            b.issues.length - a.issues.length || a.id.localeCompare(b.id),
        )) {
            console.log(`  ${p.id} — ${p.name}`);
            console.log(`    Broken: ${p.issues.length} / ${p.images.length}`);
            for (const i of p.issues) console.log(`    - [${i.reason}] ${i.url}`);
        }
    }
    if (dupIds.length > 0) {
        console.log(`  ⚠️  duplicate product ids in constants.ts: ${dupIds.join(', ')}`);
    }
    console.log();

    // ── Sections 2 + 3 ──
    if (remote.kind === 'skipped') {
        console.log('[Section 2 & 3] Remote: Supabase (products.images)');
        console.log(
            '  ⚠️  SKIPPED: VITE_SUPABASE_URL and a Supabase key are not set in .env.',
        );
        console.log(
            '   Set VITE_SUPABASE_URL + (SUPABASE_SERVICE_ROLE_KEY | VITE_SUPABASE_ANON_KEY) to enable.',
        );
        console.log('   Local-only drift will still cause exit 1.');
    } else if (remote.kind === 'fetchError') {
        console.log('[Section 2] Remote: Supabase (products.images)');
        console.log(`  ⚠️  fetch error: ${remote.message}`);
        console.log('  Resolve .env + Supabase connectivity; re-run.');
    } else {
        const remoteBroken = [...remote.products.values()].filter(
            (p) => p.issues.length > 0,
        );
        console.log(
            `[Section 2] Remote: Supabase (products.images)` +
                ` — ${remote.products.size} row(s) scanned`,
        );
        if (remoteBroken.length === 0) {
            console.log(`  ✓ All ${remote.products.size} remote product(s) have clean images.`);
        } else {
            for (const p of remoteBroken.sort((a, b) =>
                b.issues.length - a.issues.length || a.id.localeCompare(b.id),
            )) {
                console.log(`  ${p.id} — ${p.name}`);
                console.log(`    Broken: ${p.issues.length} / ${p.images.length}`);
                for (const i of p.issues) console.log(`    - [${i.reason}] ${i.url}`);
            }
        }
        console.log();

        console.log('[Section 3] Cross-check: Local vs Remote');
        if (drift.length === 0) {
            const sharedCount = [...local.keys()].filter((id) => remote.products.has(id))
                .length;
            console.log(
                `  ✓ No drift across ${sharedCount} shared product id(s).`,
            );
        } else {
            for (const d of drift.sort((a, b) => a.id.localeCompare(b.id))) {
                console.log(`  ${d.id}  [${d.kind}]`);
                if (d.localCount !== undefined) console.log(`    Local:  ${d.localCount} URLs`);
                if (d.remoteCount !== undefined) console.log(`    Remote: ${d.remoteCount} URLs`);
                if (d.brokenSamples && d.brokenSamples.length > 0) {
                    console.log(`    Broken preview (first ${d.brokenSamples.length}):`);
                    for (const i of d.brokenSamples) {
                        console.log(`      - [${i.reason}] ${i.url}`);
                    }
                }
            }
        }
    }
    console.log();

    // ── Summary + repair guidance ──
    const hasLocalBroken = localBroken.length > 0;
    const hasRemoteBroken =
        remote.kind === 'ok' &&
        [...remote.products.values()].some((p) => p.issues.length > 0);
    const hasFetchError = remote.kind === 'fetchError';
    const hasDrift = remote.kind === 'ok' && drift.length > 0;

    console.log('--- Summary ---');
    if (hasLocalBroken || hasRemoteBroken || hasFetchError || hasDrift) {
        console.log('STATUS: FAIL (exit 1)');
        if (hasLocalBroken) {
            console.log('  → constant.ts has broken image paths. Edit INITIAL_PRODUCTS directly.');
        }
        if (hasRemoteBroken) {
            console.log(
                '  → Supabase has broken image paths. Re-upload via admin dashboard, or run',
            );
            console.log('    scripts/uploadAboveAsBelowImages.ts --confirm (idempotent).');
        }
        if (hasDrift) {
            console.log(
                '  → local and remote disagree on a shared product. Run',
            );
            console.log('    scripts/syncImageFieldsToSupabase.ts --confirm to align DB with constants.ts.');
        }
        if (hasFetchError) {
            console.log('  → Supabase fetch errored out. Check .env + connectivity.');
        }
    } else {
        console.log('STATUS: PASS (exit 0)');
        console.log('  ✓ No drift detected across any section. Safe to deploy.');
    }
}

(async () => {
    try {
        const src = readFileSync(CONSTANTS_PATH, 'utf8');
        const { products: local, dupIds } = auditLocal(src);
        const remote = await auditRemote();

        const remoteMap = remote.kind === 'ok' ? remote.products : null;
        const drift = crossCheck(local, remoteMap);

        printReport(local, dupIds, remote, drift);

        const hasLocalBroken = [...local.values()].some((p) => p.issues.length > 0);
        const hasRemoteBroken =
            remote.kind === 'ok' &&
            [...remote.products.values()].some((p) => p.issues.length > 0);
        const hasDrift = remote.kind === 'ok' && drift.length > 0;

        process.exit(hasLocalBroken || hasRemoteBroken || hasDrift ? 1 : 0);
    } catch (err) {
        console.error('\n!! Audit crashed:');
        console.error(err);
        process.exit(1);
    }
})();
