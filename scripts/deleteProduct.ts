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

const PRODUCT_ID = 'prod_003';

async function deleteProduct() {
    console.log(`🗑️ Attempting to delete product: ${PRODUCT_ID}`);

    try {
        // First check if it exists and get its name for confirmation
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('name')
            .eq('id', PRODUCT_ID)
            .single();

        if (fetchError) {
            console.error('❌ Error fetching product (it might not exist):', fetchError.message);
            return;
        }

        if (!product) {
            console.log('⚠️ Product not found.');
            return;
        }

        console.log(`found product: "${product.name}". Deleting...`);

        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .eq('id', PRODUCT_ID);

        if (deleteError) {
            console.error('❌ Error deleting product:', deleteError.message);
            throw deleteError;
        }

        console.log(`✅ Successfully deleted product: ${product.name} (${PRODUCT_ID})`);

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    }
}

deleteProduct();
