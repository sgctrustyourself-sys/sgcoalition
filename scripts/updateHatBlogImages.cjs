const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateBlogImages() {
    console.log('🎩 Updating "Trust Yourself" blog post with hat images...');

    const coverImage = 'https://i.imgur.com/iYBlwm8.png';

    const content = `
<img src="https://i.imgur.com/iYBlwm8.png" alt="Trust Yourself Custom Trucker Hat - Front View" style="width:100%;border-radius:16px;margin-bottom:24px;" />

This piece is more than just a hat—it's a statement of identity and craftsmanship.

<h2>THE VISION</h2>

I wanted to create something that felt both tactile and digital. The "TRUST YOURSELF" 3D puff embroidery is the centerpiece, creating a silhouette that stands out in any light. But the real magic is in the details.

<img src="https://i.imgur.com/jwnVHoI.png" alt="Trust Yourself Hat - Close-up Detail" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>THE DETAILS</h2>

<ul>
<li><strong>D20 Precision</strong>: We've embedded a custom red D20 pin into the mesh, a nod to the RNG and strategy that drives the Coalition.</li>
<li><strong>Distressed to Perfection</strong>: Every tear and fray on the brim was hand-worked to ensure no two pieces ever feel the same.</li>
<li><strong>3D Texture</strong>: The foam front provides the perfect canvas for our signature high-density puff print.</li>
</ul>

<img src="https://i.imgur.com/YNiTSFA.png" alt="Trust Yourself Hat - Side Profile" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>THE CRAFT</h2>

Every 1/1 starts as a blank trucker and gets built by hand. The embroidery is punched with custom stitch files to get that aggressive 3D puff. The distressing is all manual — no shortcuts, no templates.

<img src="https://i.imgur.com/HqcoV24.png" alt="Trust Yourself Hat - Back Detail" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<h2>SOLD OUT</h2>

This specific 1/1 has already found its home, but it serves as a prototype for the next evolution of Coalition headwear. Stay tuned to the network for the next drop.

<img src="https://i.imgur.com/6179VgH.png" alt="Trust Yourself Hat - Full Display" style="width:100%;border-radius:16px;margin-bottom:24px;" />

<em>Trust the process. Trust yourself.</em>
    `.trim();

    const { data, error } = await supabase
        .from('posts')
        .update({
            content: content,
            cover_image: coverImage
        })
        .eq('slug', 'custom-hat-blog-01')
        .select();

    if (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }

    console.log('✅ Blog post updated with 5 images!');
    console.log(`   Cover: ${coverImage}`);
    console.log(`   URL: https://sgcoalition.xyz/blog/${data[0].slug}`);
}

updateBlogImages();
