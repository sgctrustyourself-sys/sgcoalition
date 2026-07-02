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

// Confirmed-live columns only (verified via REST probe 2026-06-28).
// is_limited_edition, sale_end_date, free_shipping, founder_note etc. live in
// INITIAL_PRODUCTS so the merged product still exposes them via local-fallback
// (AppContext.fetchProducts uses {...local, ...sp}). We deliberately do NOT
// include them in this SELECT clause: PostgREST would error on a non-existent
// column, and the retry loop can only strip optionalColumns, not the
// hard-coded BASE_SELECT_COLUMNS.
const BASE_SELECT_COLUMNS = 'id,name,price,stock,images,description,category,is_featured,sizes,size_inventory,archived,created_at';

async function addOverwhelminglyPatientHoodie() {
    const sizeInventory = { S: 1, M: 1, L: 1, XL: 1, '2XL': 1 };
    const totalStock = Object.values(sizeInventory).reduce((sum, count) => sum + count, 0);

    const product = {
        id: 'prod_hoodie_overwhelmingly_patient',
        name: 'COALITION OVERWHELMINGLY PATIENT HOODIE',
        price: 100,
        stock: totalStock,
        images: [
            PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.flatFront,
            PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.flatBack,
            PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.modelFront,
            PRODUCT_IMAGE_URLS.overwhelminglyPatientHoodie.modelBack
        ],
        description: 'Pre-order release of the Coalition Overwhelmingly Patient Hoodie at $100. Inspired by the Sacral Chakra (Svadhisthana) - creativity, pleasure, flow. Hand-cut heavyweight fleece, burnt-orange mark centered over the lower abdomen. Free shipping when paired with any other item. Reservations capped at one per size; ships in 4-6 weeks from the close of the pre-order window.',
        // Must match constants.ts INITIAL_PRODUCTS for prod_hoodie_overwhelmingly_patient
        // (and PRODUCT_LOCAL_OVERRIDES, which pins the same value). Was 'apparel'
        // originally — that drift caused the hoodie to surface under the APPAREL
        // parent filter on /shop but NOT under the SWEATSHIRTS sub-filter. Mirror
        // this in scripts/syncProductCategories.cjs if you add or remove products.
        category: 'sweatshirt',
        is_featured: false,
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        size_inventory: sizeInventory,
        archived: false
    };

    // Defense in depth: if any optional column doesn't exist in the live
    // schema yet, retry without it. Mirrors addAboveAsBelowShorts.ts.
    // NOTE: keep these in optionalColumns (NOT in `product`) so the retry
    // loop can fully strip a missing column. Putting them in product too
    // would defeat retry (product is never mutated by the loop).
    //
    // Live-schema reality (verified via REST probe 2026-06-28):
    // - is_limited_edition, sale_end_date, free_shipping, founder_note,
    //   archive_note, making_video_url, pricing_tiers, edition_size,
    //   edition_sold_count: NOT in the live products schema. The chakra
    //   narrative + Limited Edition badge still render via AppContext's
    //   local-fallback merge from INITIAL_PRODUCTS in constants.ts, so
    //   omitting them here is intentional and safe.
    const optionalColumns: Record<string, unknown> = {
        is_limited_edition: true,
        sale_end_date: '2026-07-26T23:59:59.999Z',
        created_at: '2026-06-28T00:00:00-04:00'
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
        console.error('Error upserting Overwhelmingly Patient Hoodie:', error);
        process.exit(1);
    }

    console.log(`Upserted Overwhelmingly Patient Hoodie (stock: ${totalStock}, sizes: S-2XL x1 each):`, data);
    console.log('View at: https://sgcoalition.xyz/#/shop');
}

addOverwhelminglyPatientHoodie();
