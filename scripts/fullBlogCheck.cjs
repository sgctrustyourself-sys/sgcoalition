const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fullCheck() {
    console.log('=== FULL BLOG POST DIAGNOSTIC ===\n');

    // 1. Check post exists and is published
    const { data: post, error } = await supabase
        .from('posts')
        .select('*')
        .eq('slug', 'custom-hat-blog-01')
        .single();

    if (error) {
        console.error('❌ QUERY ERROR:', error);
        return;
    }

    if (!post) {
        console.error('❌ POST NOT FOUND');
        return;
    }

    console.log('✅ Post found:', post.title);
    console.log('   ID:', post.id);
    console.log('   Published:', post.is_published);
    console.log('   Published At:', post.published_at);
    console.log('   Created At:', post.created_at);
    console.log('   Cover Image:', post.cover_image);
    console.log('   Category:', post.category);
    console.log('   Author:', post.author);
    console.log('   Tags:', post.tags);
    console.log('   Upvote Power:', post.upvote_power);
    console.log('   Downvote Power:', post.downvote_power);
    console.log('   Content Length:', post.content?.length, 'chars');
    console.log('   Content Preview:', post.content?.substring(0, 200));
    console.log('\n--- All column keys ---');
    console.log(Object.keys(post));

    // 2. Check for null/undefined dangerous values
    console.log('\n--- NULL CHECK ---');
    for (const [key, value] of Object.entries(post)) {
        if (value === null || value === undefined) {
            console.log(`⚠️  ${key} is ${value}`);
        }
    }

    // 3. Verify dates are parseable
    console.log('\n--- DATE CHECK ---');
    for (const field of ['published_at', 'created_at', 'updated_at']) {
        const val = post[field];
        if (val) {
            const d = new Date(val);
            console.log(`   ${field}: "${val}" => ${d.toISOString()} (valid: ${!isNaN(d.getTime())})`);
        } else {
            console.log(`   ${field}: NULL/UNDEFINED`);
        }
    }
}

fullCheck();
