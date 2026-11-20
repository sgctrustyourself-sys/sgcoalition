import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const PRODUCT_ID = 'Coalition_Grey_Wave_Wallet_2_2';
const now = new Date().toISOString();

async function markGreyWaveWallet22Sold() {
    const { data, error } = await supabase
        .from('products')
        .update({
            stock: 0,
            size_inventory: { 'One Size': 0 },
            archived: true,
            archived_at: now,
            sold_at: now,
            updated_at: now,
        })
        .eq('id', PRODUCT_ID)
        .select('id,name,stock,size_inventory,archived,sold_at,updated_at');

    if (error) {
        console.error('Error marking Grey Wave Wallet 2/2 as sold:', error);
        process.exit(1);
    }

    if (!data || data.length === 0) {
        console.error(`No product row found with id=${PRODUCT_ID}. It may already be deleted or the table may be empty.`);
        process.exit(1);
    }

    console.log('Marked Grey Wave Wallet 2/2 as sold:', data);
}

markGreyWaveWallet22Sold();
