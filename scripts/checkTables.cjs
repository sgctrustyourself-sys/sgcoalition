const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTables() {
    console.log('=== TABLE CHECK ===\n');

    // Check post_votes table
    const { data: votes, error: votesErr } = await supabase
        .from('post_votes')
        .select('*')
        .limit(1);

    if (votesErr) {
        console.error('❌ post_votes table error:', votesErr.message, votesErr.code);
    } else {
        console.log('✅ post_votes table accessible, rows:', votes?.length);
    }

    // Check post_comments table
    const { data: comments, error: commentsErr } = await supabase
        .from('post_comments')
        .select('*')
        .limit(1);

    if (commentsErr) {
        console.error('❌ post_comments table error:', commentsErr.message, commentsErr.code);
    } else {
        console.log('✅ post_comments table accessible, rows:', comments?.length);
    }

    // Time the full blog post query
    console.log('\n--- QUERY TIMING ---');
    const start = Date.now();
    const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('slug', 'custom-hat-blog-01')
        .single();
    const elapsed = Date.now() - start;

    if (error) {
        console.error('❌ Post query error:', error);
    } else {
        console.log(`✅ Post query completed in ${elapsed}ms`);
    }
}

checkTables();
