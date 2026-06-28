/**
 * removeAboveAsBelowSet.ts
 *
 * Removes the retired `prod_set_above_as_below` product row from the live
 * Supabase DB so its PDP URL (/product/prod_set_above_as_below) 404s. Replaced
 * by an auto-applied $30 cart discount when both prod_tee_above_as_below and
 * prod_shorts_above_as_below are in the cart together.
 *
 * Idempotent: if the row is already gone, the script logs and exits 0.
 *
 * Usage:
 *   npx tsx scripts/removeAboveAsBelowSet.ts
 *   npx tsx scripts/removeAboveAsBelowSet.ts --yes   # skip interactive confirm
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RETIRED_PRODUCT_ID = 'prod_set_above_as_below';
const SKIP_PROMPT = process.argv.includes('--yes');

async function removeAboveAsBelowSet() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('-- Missing Supabase environment variables. Aborting.');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Verify the row exists before deletion so we log something useful.
    const { data: existing, error: lookupError } = await supabase
        .from('products')
        .select('id,name,price,archived')
        .eq('id', RETIRED_PRODUCT_ID)
        .maybeSingle();

    if (lookupError) {
        console.error('-- Failed to look up retired product:', lookupError.message);
        process.exit(1);
    }

    if (!existing) {
        console.log('== ', RETIRED_PRODUCT_ID, ' already removed from Supabase. Nothing to do.');
        return;
    }

    console.log('== Found retired product:');
    console.log('   id:      ', existing.id);
    console.log('   name:    ', existing.name);
    console.log('   price:   $', existing.price);
    console.log('   archived:', existing.archived);

    if (!SKIP_PROMPT) {
        console.log('\n     !! About to DELETE this row. Pass --yes to skip this confirm.');
        console.log('     Re-running without --yes is safe (idempotent).');
        process.exit(2);
    }

    const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', RETIRED_PRODUCT_ID);

    if (deleteError) {
        console.error('-- Failed to delete retired product:', deleteError.message);
        process.exit(1);
    }

    console.log('-- Deleted', RETIRED_PRODUCT_ID, 'from Supabase.');
    console.log('-- The /product/prod_set_above_as_below PDP will now 404.');
}

removeAboveAsBelowSet().catch(err => {
    console.error('-- Unhandled error:', err);
    process.exit(1);
});
