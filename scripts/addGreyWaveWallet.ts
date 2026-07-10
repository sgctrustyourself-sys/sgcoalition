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

async function addGreyWaveWallet() {
    console.log("🌊 Adding Coalition 'Grey Wave' Wallet 1/2...");

    const soldAt = '2026-06-25T02:40:12.191+00:00';
    const sizeInventory = { 'One Size': 0 };
    const product = {
        id: 'Coalition_Grey_Wave_Wallet_1_2',
        name: "Coalition 'Grey Wave' Wallet 1/2",
        price: 35,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            PRODUCT_IMAGE_URLS.greyWaveWallet.front,
            PRODUCT_IMAGE_URLS.greyWaveWallet.back
        ],
        description: "First piece in the Coalition 'Grey Wave' wallet run. Hand-finished with a custom charcoal-grey dye pattern inspired by Baltimore harbor at dawn. Built as a limited 1/2 collectible \u2014 once sold, it's gone forever.",
        category: 'wallet',
        is_featured: false,
        // Tightened round-trip: services/retryQueue.ts, context/AppContext.tsx
        // addProduct/updateProduct, scripts/syncProducts.ts (DB -> constants.ts),
        // and components/ProductCard.tsx all read this same flag now that the
        // products.is_limited_edition column exists.
        is_limited_edition: true,
        sizes: ['One Size'],
        size_inventory: sizeInventory,
        archived: true,
        archived_at: soldAt,
        sold_at: soldAt,
        archive_note: "This exact Grey Wave wallet has sold. Request a similar custom if you want the same charcoal-grey direction rebuilt for a future drop."
    };

    const { data, error } = await supabase
        .from('products')
        .upsert([product])
        .select();

    if (error) {
        console.error('❌ Error adding product:', error);
        console.warn('💡 If this is an RLS policy issue, add it through the admin ProductManager instead.');
        console.warn('💡 If the error mentions is_limited_edition does not exist, apply supabase/migrations/20260620_add_is_limited_edition_to_products.sql first.');
        process.exit(1);
    }

    console.log("✅ Successfully upserted Coalition 'Grey Wave' Wallet 1/2:", data);
    console.log('🔗 View at: https://sgcoalition.xyz/#/shop');
    console.log("🏷️  is_limited_edition=true — the Limited Edition badge will render on the deployed shop.");
}

addGreyWaveWallet();
