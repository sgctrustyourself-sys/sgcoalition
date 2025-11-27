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

// Create local Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

const PRODUCT_ID = 'prod_nft_001';
const NEW_IMAGE_URL = '/images/coalition-nf-tee-lifestyle.jpg';
const INSERT_INDEX = 2; // 3rd position (0-indexed)

async function addProductImage() {
    console.log(`🖼️ Adding image to product: ${PRODUCT_ID}`);

    try {
        // Fetch current product
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('name, images')
            .eq('id', PRODUCT_ID)
            .single();

        if (fetchError) {
            console.error('❌ Error fetching product:', fetchError.message);
            return;
        }

        if (!product) {
            console.log('⚠️ Product not found.');
            return;
        }

        console.log(`Found product: "${product.name}"`);
        console.log('Current images:', product.images);

        // Prepare new images array
        const currentImages = product.images || [];
        const newImages = [...currentImages];

        // Insert at specific index or append if index is out of bounds
        if (INSERT_INDEX >= newImages.length) {
            newImages.push(NEW_IMAGE_URL);
        } else {
            newImages.splice(INSERT_INDEX, 0, NEW_IMAGE_URL);
        }

        console.log('New images array:', newImages);

        // Update product
        const { error: updateError } = await supabase
            .from('products')
            .update({ images: newImages })
            .eq('id', PRODUCT_ID);

        if (updateError) {
            console.error('❌ Error updating product:', updateError.message);
            throw updateError;
        }

        console.log(`✅ Successfully added image to ${product.name}`);

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    }
}

addProductImage();
