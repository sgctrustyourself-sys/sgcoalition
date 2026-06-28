import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRODUCT_IMAGE_URLS } from '../utils/localImageAssets';

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

async function addSharkTee() {
    console.log('🦈 Upserting Coalition Shark Tee (1/1)...');

    // 1/1 identity — only size S is in stock. M/L/XL are listed so the size
    // selector renders cleanly if the operator later offers the same build
    // in additional sizes; mirrors the existing Supabase row shape.
    const sizeInventory = { S: 1, M: 0, L: 0, XL: 0 };

    // Keep the original auto-generated product id so the upsert hits the
    // existing Supabase row. A new id would create a duplicate; renaming
    // the row id would orphan the original record.
    const product = {
        id: 'prod_1773860269374',
        name: 'Coalition Shark Tee - 1/1 Exclusive',
        price: 60.0,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            PRODUCT_IMAGE_URLS.sharkTee.main,
            PRODUCT_IMAGE_URLS.sharkTee.back,
            PRODUCT_IMAGE_URLS.sharkTee.frontFlat,
            PRODUCT_IMAGE_URLS.sharkTee.backFlat,
        ],
        description: "Unique SGCoalition tie-dye 'Trust Yourself' tee with a striking blue spiral pattern and the iconic crowned-bird graphic. This one-of-a-kind piece features premium print details and a motivational streetwear vibe. Size Small, in excellent condition with no flaws - ideal for collectors or anyone looking to add a standout Coalition piece to their wardrobe.",
        category: 'shirt',
        is_featured: false,
        // Mirrors services/retryQueue.ts mapProductToDb; column added in
        // supabase/migrations/20260620_add_is_limited_edition_to_products.sql.
        is_limited_edition: true,
        sizes: ['S', 'M', 'L', 'XL'],
        size_inventory: sizeInventory,
        archived: false
    };

    const { data, error } = await supabase
        .from('products')
        .upsert([product])
        .select();

    if (error) {
        console.error('❌ Error upserting product:', error);
        console.warn('💡 If the error mentions is_limited_edition does not exist, apply supabase/migrations/20260620_add_is_limited_edition_to_products.sql first.');
        process.exit(1);
    }

    console.log('✅ Successfully upserted Coalition Shark Tee (1/1):', data);
    console.log('🔗 View at: https://sgcoalition.xyz/#/shop');
    console.log('🏷️  is_limited_edition=true — the Limited Edition badge will render on the deployed shop.');
}

addSharkTee();
