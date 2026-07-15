// scripts/addRacingTeamWallet1_4.ts
//
// Upsert the Coalition 'Racing Team' Wallet 1/4 row into the live Supabase
// `products` table. Mirrors scripts/addGreyWaveWallet.ts exactly so the
// post-write row matches the INITIAL_PRODUCTS entry in constants.ts.
//
// Front:  https://i.imgur.com/3UUmYQa.jpg
// Back:   https://i.imgur.com/vRqjRG4.jpg
//
// Wholesale bundle context: this row was sold to @friiqy on 2026-05-22
// alongside Coalition_Racing_Team_Wallet_2_4, _3_4, _4_4, GreenCamoWallet,
// SKYYBLUEWALLET1_2, and prod_wallet_004. INITIAL_ORDERS
// .order_wholesale_wallets_2026_05_22.
//
// Why this script: the live Vercel preview at
//   /product/Coalition_Racing_Team_Wallet_1_4
// returns no PDP because there is no row in the products table. constants.ts
// has the LOCAL fallback (offline mode) + the archiveNote override, but the
// live build reads Supabase first, so a row is required.
//
// Mirror set: re-running this script is idempotent thanks to upsert(id=...).
// USAGE:  npx tsx scripts/addRacingTeamWallet1_4.ts

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

async function addRacingTeamWallet1_4() {
    console.log("🏎️  Adding Coalition 'Racing Team' Wallet 1/4...");

    // soldAt mirrors the wholesale-bundle date locked in
    // tests/archiveSort.test.ts (slot 3 in the canonical 14-product archive
    // ordering on the live /archive page).
    const soldAt = '2026-05-22T22:33:38+00:00';
    const sizeInventory = { 'One Size': 0 };
    const product = {
        id: 'Coalition_Racing_Team_Wallet_1_4',
        name: "Coalition 'Racing Team' Wallet 1/4",
        price: 85,
        // Stock = sum of size_inventory; archived/sold wallets report 0
        // so the storefront stops surfacing them on /shop and the PDP
        // add-to-cart button stays locked. Mirrors addGreyWaveWallet.ts.
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            PRODUCT_IMAGE_URLS.racingTeamWallet1_4.front,
            PRODUCT_IMAGE_URLS.racingTeamWallet1_4.back,
        ],
        description:
            "First piece of the Coalition 'Racing Team' 1/4 limited wallet run. Hand-finished detailing and Coalition mark on a numbered carry. Sold as part of the May 2026 wholesale bundle — once sold, gone forever.",
        category: 'wallet',
        is_featured: false,
        // products.is_limited_edition column exists per
        // supabase/migrations/20260620_add_is_limited_edition_to_products.sql
        is_limited_edition: true,
        sizes: ['One Size'],
        size_inventory: sizeInventory,
        archived: true,
        archived_at: soldAt,
        sold_at: soldAt,
        // Matches PRODUCT_LOCAL_OVERRIDES[Coalition_Racing_Team_Wallet_1_4]
        // so the same story surfaces regardless of whether the fetch path
        // overlays from constants.ts (offline) or reads from Supabase (live).
        archive_note: 'Part of the 7-wallet wholesale bundle sold to @friiqy in May 2026.',
    };

    const { data, error } = await supabase
        .from('products')
        .upsert([product])
        .select();

    if (error) {
        console.error('❌ Error upserting Coalition Racing Team Wallet 1/4:', error);
        console.warn('💡 If this is an RLS policy issue, add it through the admin ProductManager instead.');
        console.warn('💡 If the error mentions is_limited_edition does not exist, apply supabase/migrations/20260620_add_is_limited_edition_to_products.sql first.');
        process.exit(1);
    }

    console.log("✅ Successfully upserted Coalition 'Racing Team' Wallet 1/4:", data);
    console.log('🔗 View at: https://sgcoalition.xyz/product/Coalition_Racing_Team_Wallet_1_4');
}

addRacingTeamWallet1_4();
