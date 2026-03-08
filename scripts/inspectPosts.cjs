const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectTable() {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select('*')
            .limit(1);

        if (error) {
            console.error('❌ Error:', error);
        } else if (data && data.length > 0) {
            console.log('✅ Sample Post Keys:', Object.keys(data[0]));
        } else {
            console.log('⚠️ No posts found to inspect.');
        }
    } catch (err) {
        console.error('💥 Crash:', err);
    }
}

inspectTable();
