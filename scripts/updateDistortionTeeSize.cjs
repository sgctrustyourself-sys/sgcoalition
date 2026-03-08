const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function updateToSizeSmall() {
    const productId = 'prod_1771428520137';
    console.log(`📏 Updating product ${productId} size to Small...`);

    const { data, error } = await supabase
        .from('products')
        .update({
            size_inventory: {
                "S": 1,
                "M": 0,
                "L": 0,
                "XL": 0
            }
        })
        .eq('id', productId)
        .select();

    if (error) {
        console.error('❌ Error updating product size:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('✅ Product size updated to Small successfully!');
        console.log('Updated inventory:', JSON.stringify(data[0].size_inventory, null, 2));
    } else {
        console.log('❓ No product found to update.');
    }
}

updateToSizeSmall();
