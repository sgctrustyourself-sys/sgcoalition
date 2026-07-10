import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addChromeHeartsWallet() {
    console.log('🔄 Adding Custom Coalition x Chrome Hearts Wallet...\n');

    const product = {
        name: 'Custom Coalition x Chrome Hearts Wallet',
        description: 'Exclusive 1/1 custom Coalition x Chrome Hearts collaboration wallet. This unique piece features premium leather construction with signature Chrome Hearts detailing and Coalition branding. A rare collector\'s item that combines luxury craftsmanship with streetwear culture. One of a kind - once it\'s gone, it\'s gone forever.',
        price: 45.00,
        stock: 1,
        category: 'Accessories',
        images: [
            'https://i.imgur.com/SS6KbOQ.jpeg',
            'https://i.imgur.com/NUXZizv.jpeg'
        ],
        sizes: ['One Size'],
        is_featured: true,
        archived: false
    };

    const { data, error } = await supabase
        .from('products')
        .insert([product])
        .select();

    if (error) {
        console.error('❌ Error adding product:', error);
        process.exit(1);
    }

    console.log('✅ Product added successfully!\n');
    console.log('📦 Product Details:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\n🎉 The wallet is now live on your shop!');
    console.log('🔗 View at: https://sgcoalition.xyz/#/shop\n');
}

addChromeHeartsWallet();
