import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addHatBlogPost() {
    console.log('🎩 Adding Custom 1/1 Hat Vlog Post...');

    const post = {
        title: 'CRAFTING THE 1/1: THE TRUST YOURSELF CUSTOM TRUCKER',
        slug: 'custom-hat-vlog-01',
        content: `
This piece is more than just a hat—it's a statement of identity and craftsmanship. 

### The Vision
I wanted to create something that felt both tactile and digital. The "TRUST YOURSELF" 3D puff embroidery is the centerpiece, creating a silhouette that stands out in any light. But the real magic is in the details.

### The Details
- **D20 Precision**: We've embedded a custom red D20 pin into the mesh, a nod to the RNG and strategy that drives the Coalition.
- **Distressed to Perfection**: Every tear and fray on the brim was hand-worked to ensure no two pieces ever feel the same.
- **3D Texture**: The foam front provides the perfect canvas for our signature high-density puff print.

### Sold Out
This specific 1/1 has already found its home, but it serves as a prototype for the next evolution of Coalition headwear. Stay tuned to the network for the next drop.

*Trust the process. Trust yourself.*
        `.trim(),
        excerpt: 'A deep dive into the making of the 1/1 "Trust Yourself" custom trucker hat. From 3D puff embroidery to hand-distressed details.',
        author: 'Founder',
        category: 'community',
        cover_image: 'https://i.imgur.com/8Q9Z5bX.png', // Temporary placeholder for now, user can update
        tags: ['custom', 'vlog', 'craftsmanship', '1of1'],
        is_published: true,
        upvote_power: 100,
        downvote_power: 0,
        published_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('posts')
        .insert([post])
        .select();

    if (error) {
        console.error('❌ Error inserting post:', error);
        process.exit(1);
    }

    console.log('✅ Blog post added successfully!');
    console.log(`   URL: https://sgcoalition.xyz/blog/${data[0].slug}`);
}

addHatBlogPost();
