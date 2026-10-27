/**
 * scripts/syncProducts.ts — fold the live `products` table into
 * `constants/products.ts` under the rule owned by scripts/productSeed.ts.
 *
 *   npx tsx scripts/syncProducts.ts                # preserve: new rows are appended,
 *                                                  # drift is reported, nothing else changes
 *   npx tsx scripts/syncProducts.ts --only <id>    # ...and that entry is rewritten from its DB row
 *
 * `drop:list --confirm` runs this with `--only <its listing id>`, so publishing a
 * drop corrects that release's entry and touches nothing else. Entries the DB has
 * no row for are kept; nothing is ever deleted. See scripts/productSeed.ts for the
 * rule itself and why it is not a wholesale mirror.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { argValue, hasFlag, logHeader, logRow } from './cli';
import {
    formatSeedMergeReport,
    mergeSeedProducts,
    parseSeedEntries,
    replaceSeedArray,
    unknownSeedIds,
} from './productSeed';
import type { ProductRow } from './productSeed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

// Lazy, so `--list` answers "which ids can I target?" without a database at all.
function getClient() {
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing Supabase environment variables');
        process.exit(1);
    }
    return createClient(supabaseUrl, supabaseKey);
}

async function syncProducts() {
    const argv = process.argv.slice(2);
    const only = argValue(argv, 'only');
    const targetedIds = only
        ? only.split(',').map((id) => id.trim()).filter(Boolean)
        : [];
    const productsPath = path.resolve(__dirname, '../constants/products.ts');

    if (hasFlag(argv, 'list')) {
        logHeader('🔄 syncProducts — ids the seed knows');
        for (const entry of parseSeedEntries(fs.readFileSync(productsPath, 'utf8'))) {
            console.log(`  ${entry.id}`);
        }
        return;
    }

    logHeader('🔄 syncProducts');
    logRow('mode', targetedIds.length ? `preserve + rewrite ${targetedIds.join(', ')}` : 'preserve (no --only)');

    const { data: dbProducts, error } = await getClient()
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('❌ Error fetching products:', error);
        process.exit(1);
    }

    const rows = (dbProducts ?? []) as ProductRow[];
    console.log(`  fetched${' '.repeat(7)} ${rows.length} rows`);

    const before = fs.readFileSync(productsPath, 'utf8');
    const existing = parseSeedEntries(before);

    // A named id that matches nothing is a typo, not a silent no-op: the publish path
    // passes --only, so failing to act must not look like succeeding.
    const unknown = unknownSeedIds(existing, rows, targetedIds);
    if (unknown.length) {
        console.error(
            `\n❌ syncProducts: unknown --only id${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`,
        );
        console.error('   An id must be a seed entry in constants/products.ts or a row in the products table.');
        console.error('   Ids the seed knows: npx tsx scripts/syncProducts.ts --list');
        // Exit code rather than process.exit(): the Supabase client still holds open
        // handles here, and a hard exit asserts inside libuv on Windows.
        process.exitCode = 1;
        return;
    }

    const { products, report } = mergeSeedProducts(existing, rows, targetedIds);
    const after = replaceSeedArray(before, products);

    for (const line of formatSeedMergeReport(report, targetedIds.length > 0)) console.log(line);

    if (after === before) {
        console.log(`  · no change              constants/products.ts left untouched (${existing.length} entries)`);
        return;
    }

    fs.writeFileSync(productsPath, after);
    console.log(`  ✓ written                constants/products.ts (${existing.length} → ${products.length} entries)`);
}

syncProducts().catch(err => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
});
