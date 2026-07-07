import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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

const PRODUCT_ID = 'prod_002';

async function updateWalletProduct() {
    console.log(`🔄 Updating product: ${PRODUCT_ID}`);

    const updates = {
        name: 'Custom Wallet (1/1)',
        price: 45,
        stock: 1,
        category: 'accessory',
        description: 'Exclusive 1/1 custom wallet featuring camo green aesthetic and signature Coalition branding. Hand-crafted and unique.',
        sizes: ['One Size'],
        size_inventory: { 'One Size': 1 },
        images: [
            'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_aphcZ2t.jpg',
            'https://tvacscfbzcmjlcekjcsn.supabase.co/storage/v1/object/public/products/images/migrated/imgur_e7M0POe.jpg'
        ],
        is_featured: true
    };

    try {
        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', PRODUCT_ID)
            .select();

        if (error) {
            console.error('❌ Error updating product:', error.message);
            throw error;
        }

        console.log('✅ Product updated successfully!');
        console.log('New Data:', data[0]);

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    }
}

updateWalletProduct();
