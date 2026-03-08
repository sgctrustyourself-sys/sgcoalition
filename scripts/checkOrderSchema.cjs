const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
    console.log('🔍 Checking "orders" table schema...');
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('✅ Found an order, column types:');
        for (const [key, value] of Object.entries(data[0])) {
            console.log(`   - ${key}: ${typeof value} (${value === null ? 'null' : (Array.isArray(value) ? 'array' : typeof value)})`);
        }
        console.log('\nSample items structure:', JSON.stringify(data[0].items, null, 2));
    } else {
        console.log('❓ No orders found to inspect.');
    }
}

checkSchema();
