// scripts/addRacingTeamWallet2_4.ts
//
// Upsert the Coalition 'Racing Team' Wallet 2/4 row into the live Supabase
// `products` table. Mirrors scripts/addRacingTeamWallet1_4.ts exactly so the
// post-write row matches the INITIAL_PRODUCTS entry in constants.ts.
//
// Front:  https://i.imgur.com/IRhVbhN.jpg
// Back:   https://i.imgur.com/7ScdBnE.jpg
//
// Wholesale bundle context (see also: 1_4, 3_4, 4_4):
// 7 wallets sold to @friiqy on 2026-05-22. INITIAL_ORDERS
// .public-md-wholesale-wallets-2026_05_22.
//
// Why this script: CoRacing Team 2/4 currently has an archiveNote override
// in PRODUCT_LOCAL_OVERRIDES but no `products` row, no INITIAL_PRODUCTS
// entry, and no PDP on /product/Coalition_Racing_Team_Wallet_2_4.
//
// USAGE:  npx tsx scripts/addRacingTeamWallet2_4.ts

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

async function addRacingTeamWallet2_4() {
    console.log("🏎️  Adding Coalition 'Racing Team' Wallet 2/4...");

    const soldAt = '2026-05-22T22:33:38+00:00';
    const sizeInventory = { 'One Size': 0 };
    const product = {
        id: 'Coalition_Racing_Team_Wallet_2_4',
        name: "Coalition 'Racing Team' Wallet 2/4",
        price: 85,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            PRODUCT_IMAGE_URLS.racingTeamWallet2_4.front,
            PRODUCT_IMAGE_URLS.racingTeamWallet2_4.back,
        ],
        description:
            "Second piece of the Coalition 'Racing Team' limited wallet run. Hand-finished detailing and Coalition mark on a numbered carry. Sold as part of the May 2026 wholesale bundle — once sold, gone forever.",
        category: 'wallet',
        is_featured: false,
        is_limited_edition: true,
        sizes: ['One Size'],
        size_inventory: sizeInventory,
        archived: true,
        archived_at: soldAt,
        sold_at: soldAt,
        archive_note: 'Part of the 7-wallet wholesale bundle sold to @friiqy in May 2026.',
    };

    const { data, error } = await supabase
        .from('products')
        .upsert([product])
        .select();

    if (error) {
        console.error('❌ Error upserting Coalition Racing Team Wallet 2/4:', error);
        console.warn('💡 If this is an RLS policy issue, add it through the admin ProductManager instead.');
        console.warn('💡 If the error mentions is_limited_edition does not exist, apply supabase/migrations/20260620_add_is_limited_edition_to_products.sql first.');
        process.exit(1);
    }

    console.log("✅ Successfully upserted Coalition 'Racing Team' Wallet 2/4:", data);
    console.log('🔗 View at: https://sgcoalition.xyz/product/Coalition_Racing_Team_Wallet_2_4');
}

addRacingTeamWallet2_4();
