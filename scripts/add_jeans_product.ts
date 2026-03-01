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

async function addJeansProduct() {
    console.log('👖 Adding Coalition x True Religion 1/1 Jeans S1...');

    const product = {
        id: 'Coalition_x_True_Religion_S1',
        name: 'Coalition x True Religion 1/1 Jeans S1',
        price: 240,
        stock: 1,
        category: 'jeans',
        images: [
            'https://i.imgur.com/2VU7MEr.jpg',
            'https://i.imgur.com/hJgvL2K.jpg',
            'https://i.imgur.com/EsvBcv4.jpg',
            'https://i.imgur.com/J9EmRZq.jpg'
        ],
        description: 'One-of-one Coalition x True Religion collaboration jeans. Season 1 exclusive — custom distressed denim with premium detailing. Size 33. Once it\'s gone, it\'s gone.',
        is_featured: true,
        sizes: ['33'],
        size_inventory: { '33': 1 },
        nft_metadata: null,
        archived: false,
    };

    const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select();

    if (error) {
        console.error('❌ Error inserting product:', error);
        process.exit(1);
    }

    console.log('✅ Product added successfully!');
    console.log(`   Name: ${data[0].name}`);
    console.log(`   Price: $${data[0].price}`);
    console.log(`   Category: ${data[0].category}`);
    console.log(`   ID: ${data[0].id}`);
    console.log(`   Images: ${data[0].images.length}`);
}

addJeansProduct()
    .then(() => { console.log('\n🎉 Done!'); process.exit(0); })
    .catch((err) => { console.error('\n💥 Failed:', err); process.exit(1); });
