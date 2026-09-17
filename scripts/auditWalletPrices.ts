/**
 * scripts/auditWalletPrices.ts — a live wallet/accessory price audit.
 *
 * A price has two owners: the `products` table (what the shop charges) and
 * constants/products.ts (the fallback the storefront renders when Supabase is
 * unreachable). This script reads the table and asks the shared rule
 * (scripts/productSeed.ts) whether the seed agrees, so a disagreement is defined in
 * the same one place the admin drift line and Sync Code use — preserve mode reports
 * every difference and applies none.
 *
 * It used to compare against full_products.json as well: an eight-row dump of an
 * older, smaller table. That copy is retired. A checked-in dump of the table goes
 * stale in silence, and while it agrees with an equally stale seed it certifies the
 * pair as correct — which is how the Shark Tee stayed at $60 here while checkout
 * charged $40. tests/productPriceConsistency.test.ts now fails if such a copy
 * reappears.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { refreshSeed } from './productSeed';
import type { ProductRow } from './productSeed';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

interface DbProduct {
    id: string;
    name: string;
    price: number;
    category: string;
    archived: boolean;
    updated_at?: string;
}

const normalizeCategory = (category: string) => category?.toLowerCase() ?? '';

async function audit() {
    console.log('🔍 Auditing wallet/accessory prices in live Supabase...\n');

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('category', ['wallet', 'accessory']);

    if (error) {
        console.error('❌ Supabase error:', error.message);
        process.exit(1);
    }

    const wallets = ((data ?? []) as DbProduct[])
        .filter(p => {
            const cat = normalizeCategory(p.category);
            return cat === 'wallet' || cat === 'accessory';
        })
        .sort((a, b) => a.id.localeCompare(b.id));

    const seedText = fs.readFileSync(path.resolve(__dirname, '../constants/products.ts'), 'utf8');
    const { report } = refreshSeed(seedText, wallets as ProductRow[], []);
    const priceDrift = report.drift.filter(entry => entry.field === 'price');

    const stale35 = wallets.filter(p => p.price === 35);

    console.log(`Found ${wallets.length} wallet/accessory rows in Supabase:\n`);
    console.table(wallets.map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category, archived: p.archived })));

    if (stale35.length > 0) {
        console.error(`\n Found ${stale35.length} wallet(s) still priced at $35 in the live DB:`);
        console.table(stale35.map(p => ({ id: p.id, name: p.name, price: p.price })));
    } else {
        console.log('\n✅ No wallets are priced at $35 in the live DB.');
    }

    if (priceDrift.length > 0) {
        console.error(`\n❌ ${priceDrift.length} wallet price(s) in the live DB disagree with constants/products.ts:`);
        console.table(priceDrift.map(entry => ({
            id: entry.id,
            'live DB': entry.db,
            'seed (fallback)': entry.seed,
        })));
        console.error('\nSync Code rewrites every product the table holds, so the next sync corrects the seed from these rows.');
        process.exit(1);
    } else {
        console.log('\n✅ Live wallet prices match constants/products.ts, the fallback the storefront renders.');
    }
}

audit().catch(err => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
