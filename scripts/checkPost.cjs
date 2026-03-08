const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPost() {
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('slug', 'custom-hat-blog-01')
        .single();

    if (error) {
        console.error('❌ Error fetching post:', error);
    } else {
        console.log('✅ Found Post:', JSON.stringify(data, null, 2));
    }
}

checkPost();
