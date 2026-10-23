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

const ids = [
    'Coalition_Grey_Wave_Wallet_1_2',
    'Coalition_Grey_Wave_Wallet_2_2',
    'SKYYBLUEWALLET1_2',
    'GreenCamoWallet',
];

async function verify() {
    const { data, error } = await supabase.from('products').select('id,name,price').in('id', ids);
    if (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
    console.table(data!.sort((a, b) => a.id.localeCompare(b.id)));
    const off = data!.filter((p) => p.price !== 85);
    if (off.length > 0) {
        console.error('❌ Price mismatch:', off);
        process.exit(1);
    }
    console.log('✅ All 4 wallets are priced at $85 in Supabase.');
}

verify();
