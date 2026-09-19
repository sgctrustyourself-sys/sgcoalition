import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { clearOtherFeaturedProducts } from '../utils/featuredExclusivity';

// Load environment variables
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

async function addSkyyWallet() {
    console.log('💎 Adding Coalition Skyy Blue Wallet...');

    const product = {
        id: 'prod_wallet_skyy',
        name: 'Coalition Skyy Blue Wallet',
        price: 45.0,
        images: [
            'https://i.imgur.com/v5y7tPa.jpg',
            'https://i.imgur.com/B72Iael.jpg'
        ],
        description: 'Premium custom Coalition wallet in a stunning Skyy Blue finish. Hand-crafted with high-quality materials and signature branding. A perfect blend of style and utility.',
        category: 'accessory',
        is_featured: true,
        sizes: ['One Size'],
        size_inventory: {
            'One Size': 1
        },
        archived: false
    };

    const { data, error } = await supabase
        .from('products')
        .upsert([product])
        .select();

    if (error) {
        console.error('❌ Error adding product:', error);
        process.exit(1);
    }

    // Mirror api/_handlers/admin-products.ts featured-exclusivity hook:
    // the new Skyy wallet becomes the sole featured row; existing featured
    // rows get is_featured=false so the storefront's featured-slot logic
    // (utils/storefront.ts selectFeaturedProduct) keeps returning just one.
    if (product.is_featured) {
        await clearOtherFeaturedProducts(supabase, product.id, product.is_featured);
    }

    console.log('✅ Successfully added Coalition Skyy Blue Wallet:', data);
}

addSkyyWallet();
