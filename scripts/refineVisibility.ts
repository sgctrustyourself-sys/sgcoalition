import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateVisibility() {
    console.log('--- Updating Product Visibility ---');

    // 1. Unarchive Chrome Hearts
    const { error: err1 } = await supabase
        .from('products')
        .update({ archived: false, archived_at: null })
        .eq('id', 'prod_003');

    if (err1) console.error('Error unarchiving Chrome Hearts:', err1);
    else console.log('✅ Unarchived Chrome Hearts Wallet (prod_003)');

    // 2. Archive Skyy Blue
    const { error: err2 } = await supabase
        .from('products')
        .update({ archived: true, archived_at: new Date().toISOString() })
        .eq('id', 'prod_wallet_skyy');

    if (err2) console.error('Error archiving Skyy Blue:', err2);
    else console.log('✅ Archived Skyy Blue Wallet (prod_wallet_skyy)');

    // 3. Rename Green Camo Wallet
    const { error: err3 } = await supabase
        .from('products')
        .update({ name: 'Coalition Green Camo Wallet' })
        .eq('id', 'prod_002');

    if (err3) console.error('Error renaming Camo Wallet:', err3);
    else console.log('✅ Renamed Custom Wallet to Coalition Green Camo Wallet (prod_002)');

    console.log('--- Done ---');
}

updateVisibility();
