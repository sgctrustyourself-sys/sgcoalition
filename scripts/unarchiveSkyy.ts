import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function unarchiveSkyy() {
    console.log('--- Unarchiving Skyy Blue Wallet ---');

    const { error } = await supabase
        .from('products')
        .update({ archived: false, archived_at: null })
        .eq('id', 'prod_wallet_skyy');

    if (error) {
        console.error('Error unarchiving Skyy Blue:', error);
    } else {
        console.log('✅ Successfully unarchived Skyy Blue Wallet (prod_wallet_skyy)');
    }

    console.log('--- Done ---');
}

unarchiveSkyy();
