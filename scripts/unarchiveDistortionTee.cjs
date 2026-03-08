const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function unarchiveProduct() {
    const productId = 'prod_1771428520137';
    console.log(`🔓 Unarchiving product ${productId}...`);

    const { data, error } = await supabase
        .from('products')
        .update({
            archived: false,
            archived_at: null,
            sold_at: null,
            stock: 1,
            size_inventory: {
                "S": 0,
                "M": 0,
                "L": 0,
                "XL": 1
            }
        })
        .eq('id', productId)
        .select();

    if (error) {
        console.error('❌ Error unarchiving product:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('✅ Product unarchived successfully!');
        console.log('Updated details:', JSON.stringify(data[0], null, 2));
    } else {
        console.log('❓ No product found to update.');
    }
}

unarchiveProduct();
