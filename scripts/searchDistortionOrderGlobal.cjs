const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function searchAllTables() {
    const tables = ['orders', 'orders_v2', 'stripe_orders', 'paypal_orders'];
    console.log('🔍 Searching across all order tables...');

    for (const table of tables) {
        console.log(`\n--- Checking ${table} ---`);
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(10);

        if (error) {
            console.log(`❌ Error in ${table}: ${error.message}`);
            continue;
        }

        if (data && data.length > 0) {
            console.log(`✅ Found ${data.length} records in ${table}.`);
            const found = data.filter(d => JSON.stringify(d).includes('prod_1771428520137') || JSON.stringify(d).toLowerCase().includes('distortion'));
            if (found.length > 0) {
                console.log(`🎯 MATCH FOUND in ${table}:`, JSON.stringify(found, null, 2));
            } else {
                console.log('🤷 No match in this batch.');
            }
        } else {
            console.log(`∅ Table ${table} is empty.`);
        }
    }
}

searchAllTables();
