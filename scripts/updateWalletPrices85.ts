import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const WALLET_IDS = [
    'Coalition_Grey_Wave_Wallet_1_2',
    'Coalition_Grey_Wave_Wallet_2_2',
    'SKYYBLUEWALLET1_2',
    'GreenCamoWallet',
];

const TARGET_PRICE = 85;

async function updateWalletPrices() {
    console.log(`🔄 Updating ${WALLET_IDS.length} wallet prices to $${TARGET_PRICE}...\n`);

    for (const id of WALLET_IDS) {
        const { data, error } = await supabase
            .from('products')
            .update({ price: TARGET_PRICE })
            .eq('id', id)
            .select('id, name, price');

        if (error) {
            console.error(`❌ Error updating ${id}:`, error.message);
            continue;
        }

        if (!data || data.length === 0) {
            console.warn(`⚠️ No row found for ${id}`);
            continue;
        }

        const row = data[0];
        console.log(`✅ ${row.id}: "${row.name}" -> $${row.price}`);
    }

    console.log('\n🎉 Wallet price update complete.');
}

updateWalletPrices().catch((err) => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
