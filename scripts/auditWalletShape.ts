// scripts/auditWalletShape.ts
//
// Wallet-Shape Audit (dry-run, no writes).
//
// Generalized version of scripts/fixProd1784012446238Sizing.ts: scans
// EVERY active wallet-named row in the live Supabase `products` table
// and flags any whose shape drifts from the 3-field wallet invariant
// documented in `README.md > Storefront Display Utilities > Wallet
// shape invariant`:
//
//   1. category    = 'wallet'
//   2. sizes       = ['One Size']
//   3. size_inventory = { 'One Size': N }
//
// Row detection (the union of):
//   - name ilike '%wallet%' (catches the prod_1784012446238 failure
//     mode: a row whose name is "Wallet" but whose category was left
//     at the admin-default 'apparel')
//   - category = 'wallet' (catches rows the operator correctly marked
//     as wallet, whose name might not contain the word "wallet")
//
// Active filter (per the operator's intent — archived/sold rows are
// intentional recordkeeping, same as the audit's BLOCK_BOUNDARY in
// constants.ts):
//   - archived is null  OR  archived = false
//
// USAGE:   npx.cmd tsx scripts/auditWalletShape.ts
// EXIT:    0 all active wallet-named rows match the invariant.
//          1 any drift detected OR any Supabase fetch error.
//
// Non-mutating. Wire into the same .github/workflows/image-path-audit.yml
// gate that already runs the image-path audit + the featured-exclusivity
// tests so a single CI run surfaces all three classes of drift.

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
            '   The anon key will NOT work for full read access due to RLS.',
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Shape validation ───────────────────────────────────────────────────────

interface ShapeIssue {
    field: 'category' | 'sizes' | 'size_inventory';
    expected: string;
    actual: string;
}

const ACTIVE_FILTER = 'archived.is.null,archived.eq.false';

/**
 * Checks the 3-field wallet-shape invariant on a single row.
 *
 * - category must be exactly 'wallet'
 * - sizes must be the single-element array ['One Size']
 * - size_inventory must be a single-key object {'One Size': N}
 *   where N is a finite non-negative integer
 *
 * Returns the list of issues (empty if the row matches the invariant).
 */
function checkWalletShape(row: WalletRow): ShapeIssue[] {
    const issues: ShapeIssue[] = [];

    // Field 1: category
    if (row.category !== 'wallet') {
        issues.push({
            field: 'category',
            expected: '"wallet"',
            actual: JSON.stringify(row.category),
        });
    }

    // Field 2: sizes
    const sizesOk =
        Array.isArray(row.sizes) &&
        row.sizes.length === 1 &&
        typeof row.sizes[0] === 'string' &&
        row.sizes[0].toLowerCase().includes('one');
    if (!sizesOk) {
        issues.push({
            field: 'sizes',
            expected: '["One Size"]',
            actual: JSON.stringify(row.sizes),
        });
    }

    // Field 3: size_inventory
    const si = row.size_inventory;
    const siOk =
        si !== null &&
        typeof si === 'object' &&
        !Array.isArray(si) &&
        Object.keys(si).length === 1 &&
        'One Size' in si &&
        typeof (si as Record<string, unknown>)['One Size'] === 'number' &&
        Number.isFinite((si as Record<string, number>)['One Size']) &&
        (si as Record<string, number>)['One Size'] >= 0;
    if (!siOk) {
        issues.push({
            field: 'size_inventory',
            expected: '{"One Size": N}',
            actual: JSON.stringify(si),
        });
    }

    return issues;
}

// ── Row fetch (name-based + category-based union, deduped by id) ────────────

interface WalletRow {
    id: string;
    name: string;
    category: string;
    sizes: string[] | null;
    size_inventory: Record<string, number> | null;
    archived?: boolean | null;
}

async function fetchAllActiveWalletRows(): Promise<WalletRow[]> {
    const selectFields = 'id, name, category, sizes, size_inventory, archived';

    // Query 1: name-based detection (catches the prod_1784012446238
    // failure mode where the operator named the product "WALLET" but
    // left the admin-default 'apparel' category).
    const { data: byName, error: nameErr } = await supabase
        .from('products')
        .select(selectFields)
        .or(ACTIVE_FILTER)
        .ilike('name', '%wallet%');
    if (nameErr) {
        throw new Error(`Name-based wallet scan failed: ${nameErr.message}`);
    }

    // Query 2: category-based detection (catches rows the operator
    // correctly marked as wallet category but whose name doesn't
    // contain the word "wallet" — defensive).
    const { data: byCategory, error: catErr } = await supabase
        .from('products')
        .select(selectFields)
        .or(ACTIVE_FILTER)
        .eq('category', 'wallet');
    if (catErr) {
        throw new Error(`Category-based wallet scan failed: ${catErr.message}`);
    }

    // Union + dedupe by id
    const merged = new Map<string, WalletRow>();
    for (const row of (byName ?? []) as WalletRow[]) merged.set(row.id, row);
    for (const row of (byCategory ?? []) as WalletRow[]) merged.set(row.id, row);
    return Array.from(merged.values());
}

// ── Print + exit-code glue ─────────────────────────────────────────────────

interface DriftRecord {
    row: WalletRow;
    issues: ShapeIssue[];
}

function printReport(
    scanned: ReadonlyArray<WalletRow>,
    drift: ReadonlyArray<DriftRecord>,
): void {
    console.log('========================================================');
    console.log(' Coalition Wallet-Shape Audit (dry-run, no writes)');
    console.log('========================================================');
    console.log();

    // ── Section 1: scanned + clean count ──
    console.log('[Section 1] Active wallet-named rows scanned');
    console.log(`  ${scanned.length} active row(s) matched the wallet-detector (name ilike '%wallet%' OR category='wallet').`);
    if (drift.length === 0) {
        console.log(`  ✓ All ${scanned.length} match the 3-field wallet-shape invariant.`);
    } else {
        const clean = scanned.length - drift.length;
        console.log(`  ✓ ${clean} match the 3-field invariant.`);
        console.log(`  - ${drift.length} drift from the invariant:`);
        console.log();
        const sorted = [...drift].sort((a, b) => a.row.id.localeCompare(b.row.id));
        for (const d of sorted) {
            console.log(`  ${d.row.id} — ${d.row.name}`);
            for (const i of d.issues) {
                console.log(`    - ${i.field}: ${i.actual} (expected ${i.expected})`);
            }
            console.log();
        }
    }

    // ── Section 2: drift details ──
    if (drift.length > 0) {
        console.log('[Section 2] Drift details');
        const sorted = [...drift].sort((a, b) => a.row.id.localeCompare(b.id));
        for (const d of sorted) {
            console.log(`  ${d.row.id}: ${d.issues.length} issue(s)`);
            for (const i of d.issues) {
                console.log(`    - ${i.field} mismatch`);
            }
        }
        console.log();
    }

    // ── Section 3: repair guidance ──
    console.log('[Section 3] Repair guidance');
    if (drift.length > 0) {
        console.log('  - For the canonical 2/4 vs 3/4 wallet pair (prod_1784012446238 vs');
        console.log('    prod_1784012355221), use scripts/fixProd1784012446238Sizing.ts with');
        console.log('    --confirm to repair against the known-good reference row.');
        console.log('  - For other drifted rows, use the admin ProductManager at');
        console.log('    /admin > Products to set:');
        console.log('      * category = wallet');
        console.log('      * sizes = ["One Size"]');
        console.log('      * size_inventory = {"One Size": N}');
        console.log('  - The 3-field invariant is documented in');
        console.log('    README.md > Storefront Display Utilities > Wallet shape invariant.');
    } else {
        console.log('  ✓ No drift to repair. The wallet-shape invariant holds across');
        console.log('    every active wallet-named row in the live catalog.');
    }
    console.log();

    // ── Summary ──
    console.log('--- Summary ---');
    if (drift.length === 0) {
        console.log(`STATUS: PASS (exit 0)`);
        console.log(`  ✓ ${scanned.length} active wallet-named row(s), all match the invariant.`);
    } else {
        console.log(`STATUS: FAIL (exit 1)`);
        console.log(`  ${drift.length} active wallet-named row(s) drift from the invariant.`);
        console.log(`  Fix via scripts/fixProd1784012446238Sizing.ts --confirm (canonical pair)`);
        console.log(`  or the admin ProductManager (one-off rows).`);
    }
}

(async () => {
    try {
        const scanned = await fetchAllActiveWalletRows();
        const drift: DriftRecord[] = [];
        for (const row of scanned) {
            const issues = checkWalletShape(row);
            if (issues.length > 0) drift.push({ row, issues });
        }
        printReport(scanned, drift);
        process.exit(drift.length === 0 ? 0 : 1);
    } catch (err) {
        console.error('\n!! Audit crashed:');
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
