const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkComments() {
    const { data: posts } = await supabase.from('posts').select('id, title');
    console.log('Posts:', posts);

    for (const post of posts || []) {
        const { data: comments, error } = await supabase
            .from('post_comments')
            .select('*')
            .eq('post_id', post.id);

        if (error) {
            console.error(`Error for post ${post.title}:`, error);
        } else {
            console.log(`Comments for ${post.title}:`, comments);
        }
    }
}

checkComments();
