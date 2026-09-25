// scripts/addPartsWallet4_4.ts
//
// Upsert the Coalition 'Parts' Wallet 4/4 row into the live Supabase
// `products` table. Mirrors scripts/addPartsWallet1_4.ts.
//
// Front:  https://i.imgur.com/RqcU0I9.jpg
// Back:   https://i.imgur.com/Lnimi33.jpg
//
// USAGE:  npx tsx scripts/addPartsWallet4_4.ts

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRODUCT_IMAGE_URLS } from '../utils/localImageAssets';

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

async function addPartsWallet4_4() {
    console.log("🔧 Adding Coalition 'Parts' Wallet 4/4...");

    const sizeInventory = { 'One Size': 1 };
    const product = {
        id: 'Coalition_Parts_Wallet_4_4',
        name: "Coalition 'Parts' Wallet 4/4",
        price: 85,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            PRODUCT_IMAGE_URLS.partsWallet4_4.front,
            PRODUCT_IMAGE_URLS.partsWallet4_4.back,
        ],
        description:
            "Fourth and final piece of the Coalition 'Parts' limited wallet run. Hand-finished with industrial detailing, raw-edge construction, and the Coalition mark on a numbered carry. The closing piece — once sold, the full four-part assembly is gone forever.",
        category: 'wallet',
        is_featured: false,
        is_limited_edition: true,
        sizes: ['One Size'],
        size_inventory: sizeInventory,
        archived: false,
    };

    const { data, error } = await supabase
        .from('products')
        .upsert([product])
        .select();

    if (error) {
        console.error("❌ Error upserting Coalition 'Parts' Wallet 4/4:", error);
        console.warn('💡 If this is an RLS policy issue, add it through the admin ProductManager instead.');
        console.warn('💡 If the error mentions is_limited_edition does not exist, apply supabase/migrations/20260620_add_is_limited_edition_to_products.sql first.');
        process.exit(1);
    }

    console.log("✅ Successfully upserted Coalition 'Parts' Wallet 4/4:", data);
    console.log('🔗 View at: https://sgcoalition.xyz/product/Coalition_Parts_Wallet_4_4');
}

addPartsWallet4_4();
