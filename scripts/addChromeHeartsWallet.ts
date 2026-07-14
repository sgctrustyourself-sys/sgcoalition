import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { clearOtherFeaturedProducts } from '../utils/featuredExclusivity';

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

    // Mirror api/_handlers/admin-products.ts featured-exclusivity hook so
    // the new Chrome Hearts wallet doesn't leave a stale featured row
    // from a previous drop. The wallet row has no explicit id (Postgres
    // generates one), so we read it off the returned insert result. A
    // missing id (rare — driver / RLS edge case) surfaces as a loud
    // warning rather than a silent catalog invariant breach.
    if (product.is_featured) {
        const insertedId = data?.[0]?.id;
        if (!insertedId) {
            console.warn(
                '⚠️ [addChromeHeartsWallet] Insert succeeded but no row id was returned — skipping featured-exclusivity clear. Verify is_featured on other rows in the admin ProductManager.'
            );
        } else {
            await clearOtherFeaturedProducts(supabase, insertedId, product.is_featured);
        }
    }

    console.log('✅ Product added successfully!\n');
    console.log('📦 Product Details:');
    console.log(JSON.stringify(data[0], null, 2));
    console.log('\n🎉 The wallet is now live on your shop!');
    console.log('🔗 View at: https://sgcoalition.xyz/#/shop\n');
}

addChromeHeartsWallet();
