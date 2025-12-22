import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateIds() {
    console.log('--- Migrating Product IDs ---');

    // Fetch current products to get full data
    const { data: products, error: fetchErr } = await supabase.from('products').select('*');
    if (fetchErr) {
        console.error('Error fetching products:', fetchErr);
        return;
    }

    for (const product of products) {
        let newId = product.id;
        if (product.id === 'prod_003') newId = 'prod_wallet_001'; // Chrome Hearts
        if (product.id === 'prod_002') newId = 'prod_wallet_002'; // Green Camo

        if (newId !== product.id) {
            console.log(`Migrating ${product.id} -> ${newId} (${product.name})`);

            // Since ID is PK, we need to insert new and delete old
            const { error: insertErr } = await supabase.from('products').insert([{
                ...product,
                id: newId
            }]);

            if (insertErr) {
                console.error(`Failed to insert ${newId}:`, insertErr);
                continue;
            }

            const { error: deleteErr } = await supabase.from('products').delete().eq('id', product.id);
            if (deleteErr) {
                console.error(`Failed to delete old ${product.id}:`, deleteErr);
            } else {
                console.log(`✅ Successfully migrated to ${newId}`);
            }
        }
    }

    console.log('--- Migration Finished ---');
}

migrateIds();
