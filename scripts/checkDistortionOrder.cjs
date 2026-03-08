const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDistortionOrder() {
    console.log('🔍 Searching for orders containing product "prod_1771428520137"...');
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .contains('items', [{ productId: 'prod_1771428520137' }]);

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('❓ No orders found for this product.');
    } else {
        console.log('✅ Found order(s):', JSON.stringify(data, null, 2));
    }
}

checkDistortionOrder();
