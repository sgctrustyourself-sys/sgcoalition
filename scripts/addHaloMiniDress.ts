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
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Confirmed-live columns only. The optional columns below are stripped on
// retry if the live schema doesn't yet have them.
const BASE_SELECT_COLUMNS = 'id,name,price,stock,images,description,category,is_featured,sizes,size_inventory,archived,created_at';

// Standard live catalog release, not a numbered or limited drop.
const sizeInventory = { S: 12, M: 13, L: 13, XL: 12 };

async function addHaloMiniDress() {
    const product = {
        id: 'prod_halo_mini_dress',
        name: 'COALITION HALO MINI DRESS',
        price: 50,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            PRODUCT_IMAGE_URLS.haloMiniDress.modelFaceFront,
            PRODUCT_IMAGE_URLS.haloMiniDress.modelFront,
            PRODUCT_IMAGE_URLS.haloMiniDress.modelAngledFront,
            PRODUCT_IMAGE_URLS.haloMiniDress.modelSide,
            PRODUCT_IMAGE_URLS.haloMiniDress.modelBackAngled,
            PRODUCT_IMAGE_URLS.haloMiniDress.modelBack
        ],
        description: 'Coalition Halo Mini Dress in black with a fitted cami mini silhouette, gold Coalition chest logo, low scoop back, and gold cross-backed Coalition graphic. Standard live catalog release priced at $50.',
        category: 'dress',
        is_featured: false,
        sizes: ['S', 'M', 'L', 'XL'],
        size_inventory: sizeInventory,
        archived: false
    };

    const optionalColumns: Record<string, unknown> = {
        is_limited_edition: false,
        image_roles: {
            primaryUrl: PRODUCT_IMAGE_URLS.haloMiniDress.modelFaceFront,
            hoverUrl: PRODUCT_IMAGE_URLS.haloMiniDress.modelBackAngled
        },
        edition_size: null,
        pricing_tiers: null,
        created_at: '2026-07-01T00:00:00-04:00'
    };

    let result;

    while (true) {
        const optionalColumnNames = Object.keys(optionalColumns);
        const mergedPayload: Record<string, unknown> = { ...product, ...optionalColumns };

        result = await supabase
            .from('products')
            .upsert([mergedPayload])
            .select(BASE_SELECT_COLUMNS);

        if (result.error?.code !== 'PGRST204' && result.error?.code !== '42703') break;

        const missingColumn = optionalColumnNames.find(column => result.error?.message.includes(column));
        if (!missingColumn) break;

        console.warn(`products.${missingColumn} is not in the live schema yet; retrying without that optional column.`);
        delete optionalColumns[missingColumn];
    }

    const { data, error } = result;

    if (error) {
        console.error('Error upserting Halo Mini Dress:', error);
        process.exit(1);
    }

    console.log('Upserted Coalition Halo Mini Dress (standard live catalog release):', data);
}

addHaloMiniDress();
