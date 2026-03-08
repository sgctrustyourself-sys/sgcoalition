const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function findDistortionTee() {
    console.log('🔍 Searching for "Distortion Tee"...');
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%distortion%');

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('❓ No product found with "distortion" in the name.');
        // Try id search
        const { data: data2 } = await supabase
            .from('products')
            .select('*')
            .ilike('id', '%distortion%');
        console.log('Search by ID results:', data2);
    } else {
        console.log('✅ Found product(s):', JSON.stringify(data, null, 2));
    }
}

findDistortionTee();
