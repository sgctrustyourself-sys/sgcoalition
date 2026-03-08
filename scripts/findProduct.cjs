const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function findProduct() {
    // Search for the NF Tee product
    const { data, error } = await supabase
        .from('products')
        .select('id, name, description, nft_metadata')
        .ilike('id', '%NF%');

    if (error) console.error('Error:', error);

    if (!data || data.length === 0) {
        // Try searching by name
        const { data: data2 } = await supabase
            .from('products')
            .select('id, name, description, nft_metadata')
            .ilike('name', '%NF%');
        console.log('Search by name:', data2);
    } else {
        console.log('Found products:', JSON.stringify(data, null, 2));
    }
}

findProduct();
