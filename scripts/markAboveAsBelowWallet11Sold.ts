import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Marks the Above as Below 1/1 wallet sold in the live catalog.
 *
 * The wallet was sold in person on 2026-10-19 (INITIAL_ORDERS
 * public-md-above-as-below-wallet-david-2026_10_19 / ORD-SG-AAB-DAVID) and
 * constants/products.ts has carried it as archived since then, but the live
 * `products` row was never updated: archived=false, stock 1, sold_at null. That
 * left a one-of-one that had already left the studio purchasable on the
 * storefront (tests/soldYetBuyableAudit.test.ts flags it as BUYABLE BUT SOLD,
 * and /api/pricing-preview still quotes it).
 *
 * Same shape as scripts/markGreyWaveWallet22Sold.ts. Dates are the sale date,
 * not today, so the live row agrees with the seed instead of inventing a
 * second sale date.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PRODUCT_ID = 'Coalition_Above_As_Below_Wallet_1_1';
// The in-person sale this row is being reconciled to.
const SOLD_AT = '2026-10-19T00:00:00+00:00';

async function markAboveAsBelowWallet11Sold() {
    const { data, error } = await supabase
        .from('products')
        .update({
            stock: 0,
            size_inventory: { 'One Size': 0 },
            archived: true,
            archived_at: SOLD_AT,
            sold_at: SOLD_AT,
            updated_at: new Date().toISOString(),
        })
        .eq('id', PRODUCT_ID)
        .select('id,name,stock,size_inventory,archived,archived_at,sold_at');

    if (error) {
        console.error('Error marking Above as Below 1/1 wallet as sold:', error);
        process.exit(1);
    }

    if (!data || data.length === 0) {
        console.error(`No product row found with id=${PRODUCT_ID}.`);
        process.exit(1);
    }

    console.log('Marked Above as Below 1/1 wallet as sold:', data);
}

markAboveAsBelowWallet11Sold();
