// scripts/fixProd1784012446238Sizing.ts
//
// One-shot operator script for the live PDP sizing bug on
// https://sgcoalition.xyz/product/prod_1784012446238 ("COALITION ABOVE AS
// BELOW 2/4 WALLET"). The wallet renders with apparel-style sizing
// (S/M/L/XL with size S = 1 left). Its sibling
// https://sgcoalition.xyz/product/prod_1784012355221 ("COALITION ABOVE AS
// BELOW 3/4 WALLET", $85) renders correctly with the wallet shape:
// category=wallet, sizes=['One Size'], size_inventory={'One Size':1}.
//
// Root cause: React admin ProductManager.initNewProduct() defaults
// category='apparel' and sizes=['S','M','L','XL']; the operator changed
// the name+price but did not change Category nor Size selector. The PDP
// falls through its 'ONE SIZE' branch to the S/M/L/XL grid.
//
// WHAT THIS DOES
//   1. Fetches WRONG row + GOOD row side-by-side.
//   2. Lists ALL OTHER active products whose name suggests a wallet but
//      whose shape doesn't match the wallet invariant. Archived rows are
//      excluded; their allowed mismatches are intentional recordkeeping.
//   3. Without --confirm: prints the intended diff and exits.
//   4. With --confirm: pre-flight wallet-shape guard on the GOOD row,
//      then applies only the shape-corrective fields to the WRONG row.
//      Leaves name, price, description, images untouched.
//
// SAFETY
//   - SUPABASE_SERVICE_ROLE_KEY bypasses RLS -- writes go to production.
//   - Two-step pattern: audit dry-run, inspect, then --confirm to apply.
//   - The --confirm path computes the diff from the live good row at run
//     time so a future drift in the good row's data surfaces BEFORE any
//     write.
//   - PRE-FLIGHT GUARD (--confirm only): refuses the write if
//     good.category !== 'wallet' or good.sizes is not the single
//     'One Size' entry. The dry-run phase bypasses this guard so the
//     operator can still inspect state even when the GOOD row drifts.
//
// KNOWN SCHEMA LIMITATIONS (as of 2026-07-14)
//   The live `products` table does NOT have a `gender` column -- only the
//   TypeScript Product type union widened to include 'gender' (commit
//   "feat(shop): add gender field..."). This script therefore does NOT
//   touch gender.

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// .env lives in the project root, which is process.cwd() when the operator
// runs the script from the project dir via `cd /c/.../SGCoalition && npx.cmd tsx scripts/...`.
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const WRONG_ID = 'prod_1784012446238';
const GOOD_ID = 'prod_1784012355221';

// Schema-confirmed wallet-shape fields. `gender` is intentionally absent
// because the live products table has no `gender` column as of writing.
const SHAPE_FIELDS = ['category', 'sizes', 'size_inventory', 'stock', 'is_limited_edition'] as const;

async function fetchRow(id: string) {
    // Pick from a known-safe column set so the SELECT never trips on a
    // missing column (e.g. gender). If a future field is added to the
    // wallet shape contract, append it here AND to SHAPE_FIELDS above.
    const { data, error } = await supabase
        .from('products')
        .select('id, name, category, sizes, size_inventory, stock, is_limited_edition, price, archived')
        .eq('id', id)
        .single();
    if (error) throw new Error(`Failed to fetch ${id}: ${error.message}`);
    return data as Record<string, unknown>;
}

async function findOtherMismatchedWallets() {
    const { data, error } = await supabase
        .from('products')
        .select('id, name, category, sizes, size_inventory, archived')
        // Active products only -- archives are intentional recordkeeping.
        .or('archived.is.null,archived.eq.false')
        .ilike('name', '%wallet%');
    if (error) throw new Error(`Failed to query wallet-shaped rows: ${error.message}`);
    return (data ?? []).filter((row) => {
        if (row.id === WRONG_ID || row.id === GOOD_ID) return false;
        const isWalletCategory = row.category === 'wallet';
        const sizes: unknown = row.sizes;
        const hasOneSize = Array.isArray(sizes) && sizes.length === 1
            && typeof sizes[0] === 'string'
            && sizes[0].toLowerCase().includes('one');
        return !isWalletCategory || !hasOneSize;
    });
}

function describeRow(label: string, row: Record<string, unknown>) {
    console.log(`\n--- ${label} (${row.id}) ---`);
    console.log(`name:                ${row.name}`);
    console.log(`price:               $${row.price}`);
    console.log(`archived:            ${row.archived}`);
    console.log(`category:            ${JSON.stringify(row.category)}`);
    console.log(`sizes:               ${JSON.stringify(row.sizes)}`);
    console.log(`size_inventory:      ${JSON.stringify(row.size_inventory)}`);
    console.log(`stock:               ${JSON.stringify(row.stock)}`);
    console.log(`is_limited_edition:  ${JSON.stringify(row.is_limited_edition)}`);
}

function computeUpdate(good: Record<string, unknown>) {
    const update: Record<string, unknown> = {};
    for (const key of SHAPE_FIELDS) {
        if (good[key] !== undefined && good[key] !== null) {
            update[key] = good[key];
        }
    }
    const si = good.size_inventory as Record<string, number> | undefined;
    if (si && typeof si === 'object') {
        const sum = Object.values(si).reduce((a, n) => a + Number(n || 0), 0);
        if (good.stock === undefined || good.stock === null) {
            update.stock = sum;
        }
    }
    return update;
}

function isWalletShape(row: Record<string, unknown>): boolean {
    if (row.category !== 'wallet') return false;
    const sizes: unknown = row.sizes;
    return Array.isArray(sizes)
        && sizes.length === 1
        && typeof sizes[0] === 'string'
        && sizes[0].toLowerCase().includes('one');
}

async function main() {
    const confirmed = process.argv.includes('--confirm');

    console.log('=== AUDIT: prod_1784012446238 (WRONG) ===');
    const wrong = await fetchRow(WRONG_ID);
    describeRow('WRONG (current)', wrong);

    console.log('\n=== REFERENCE: prod_1784012355221 (GOOD) ===');
    const good = await fetchRow(GOOD_ID);
    describeRow('GOOD (reference)', good);

    const update = computeUpdate(good);

    console.log('\n=== INTENDED UPDATE on WRONG row ===');
    for (const key of SHAPE_FIELDS) {
        const current = wrong[key];
        const target = update[key];
        const same = JSON.stringify(current) === JSON.stringify(target);
        console.log(`  ${key.padEnd(20)} ${same ? 'UNCHANGED' : 'UPDATE'}`);
        if (!same) {
            console.log(`    before: ${JSON.stringify(current)}`);
            console.log(`    after:  ${JSON.stringify(target)}`);
        }
    }

    const others = await findOtherMismatchedWallets();
    if (others.length > 0) {
        console.log('\n=== OTHER ACTIVE WALLET-NAMED ROWS WITH MISMATCHED SHAPE ===');
        for (const row of others) {
            console.log(`  ${row.id}  ${row.name}  category=${row.category}  sizes=${JSON.stringify(row.sizes)}`);
        }
        console.log(`(${others.length} additional rows may need the same review -- the script does NOT auto-fix them.)`);
    } else {
        console.log('\n=== No other active wallet-named rows with mismatched shape. ===');
    }

    if (!confirmed) {
        console.log('\n=== DRY RUN -- no writes performed ===');
        console.log('Re-run with `--confirm` to apply the update on the WRONG row.');
        return;
    }

    // PRE-FLIGHT GUARD -- checked ONLY in the --confirm branch so dry-runs
    // always run to completion and print the GOOD row + diff for inspection.
    // Mirroring an un-wallet-shaped GOOD row would silently propagate the
    // wrong invariant, so we abort the write here.
    if (!isWalletShape(good)) {
        console.error(`\nABORT: reference row ${GOOD_ID} does not match the wallet shape -- refusing to write. Reconcile manually.`);
        process.exit(1);
    }
    console.log('\n=== Pre-flight passed: GOOD reference row matches wallet shape. ===');

    console.log('\n=== APPLYING UPDATE -- service-role write to production ===');
    const { data: written, error: writeErr } = await supabase
        .from('products')
        .update(update)
        .eq('id', WRONG_ID)
        .select('id, name, category, sizes, size_inventory, stock, is_limited_edition')
        .single();
    if (writeErr) {
        console.error(`Update failed: ${writeErr.message}`);
        process.exit(1);
    }
    console.log('\n--- WRONG (after update) ---');
    describeRow('WRONG (after)', written as Record<string, unknown>);
    console.log(`\nFixed: ${WRONG_ID} now matches the wallet shape.`);
    console.log('Next: reload https://sgcoalition.xyz/product/prod_1784012446238 in a browser to confirm ONE SIZE - 1 LEFT.');
}

main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
