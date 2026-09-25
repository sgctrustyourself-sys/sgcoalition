// scripts/addCheckoutTestProduct.ts
//
// List the $1 checkout-test item on the storefront.
//
// Why this exists: exercising the live checkout end to end (Stripe
// Element mounted, a real charge, a real order row) needs a purchasable
// listing at a price a card minimum will accept. This creates exactly
// one, and is safe to re-run: the id is static, so a second run
// overwrites the same row instead of adding a second listing.
//
// Usage
//   npx.cmd tsx scripts/addCheckoutTestProduct.ts            # print, then write
//
// Shape follows the sibling scripts/addX.ts one-offs: static id +
// upsert so re-runs are idempotent, service-role key (RLS on the
// `products` bucket rejects storage writes for the anon key), and
// fail-fast with no rollback because the id makes a re-run the fix.
//
// The image is deliberately NOT a product photo: this is not
// merchandise, and it must be obvious at a glance in the shop grid.
//
// To remove the listing after testing: delete row
// `prod_checkout_test_dollar` (and the object
// `products/images/checkout-test-item.png`).

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error(
        '!! .env must contain VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
            '   The anon key (VITE_SUPABASE_ANON_KEY) will NOT work here: RLS on the products\n' +
            '   bucket rejects storage writes for it. See Vercel project settings -> Environment Variables.'
    );
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

export const PRODUCT_ID = 'prod_checkout_test_dollar';
const STORAGE_OBJECT = 'images/checkout-test-item.png';
const LOCAL_IMAGE = path.resolve(__dirname, '../public/hero-cinematic.png');

// One size, one unit. `size_inventory` is what makes the listing buyable
// (pages/ProductDetails.tsx sums it for totalStock, and the order path
// enforces it per size); `stock` is the same number so the SEO/prerender
// sellability check in utils/seo.ts agrees with the page.
const SIZE_INVENTORY = { 'One Size': 1 };

const PRODUCT = {
    id: PRODUCT_ID,
    name: 'Checkout Test Item — $1',
    price: 1,
    stock: Object.values(SIZE_INVENTORY).reduce((sum, count) => sum + count, 0),
    images: [`${SUPABASE_URL}/storage/v1/object/public/products/${STORAGE_OBJECT}`],
    description:
        'Live checkout test listing. A real $1 charge (plus shipping) placed on purpose to ' +
        'exercise the production payment path end to end. Not merchandise — archive this ' +
        'listing once testing is done.',
    category: 'accessory',
    is_featured: false,
    sizes: ['One Size'],
    size_inventory: SIZE_INVENTORY,
    archived: false,
};

async function main() {
    if (!fs.existsSync(LOCAL_IMAGE)) {
        console.error(`!! source image missing: ${LOCAL_IMAGE}`);
        process.exit(1);
    }

    console.log(`Target: ${SUPABASE_URL}`);
    console.log('Row to write:');
    console.log(JSON.stringify(PRODUCT, null, 2));

    const imageUrl = PRODUCT.images[0];

    // 1. Upload the test image (upsert: a re-run overwrites, never orphans).
    const bytes = fs.readFileSync(LOCAL_IMAGE);
    const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(STORAGE_OBJECT, bytes, { upsert: true, contentType: 'image/png' });

    if (uploadError) {
        console.error('!! image upload failed:', uploadError.message);
        process.exit(1);
    }
    console.log(`\nuploaded ${STORAGE_OBJECT} (${bytes.length} bytes)`);
    console.log(`public url ${imageUrl}`);

    // 2. Upsert the listing. `select()` so a silent no-op cannot look
    //    like success — the failure mode this repo has been bitten by.
    const { data, error } = await supabase
        .from('products')
        .upsert([PRODUCT])
        .select('id,name,price,stock,category,archived,size_inventory');

    if (error) {
        console.error('!! upsert failed:', error.message, error.code);
        process.exit(1);
    }
    if (!data || data.length === 0) {
        console.error('!! upsert reported no error but wrote nothing');
        process.exit(1);
    }

    console.log('\nwritten:');
    console.log(JSON.stringify(data, null, 2));
    console.log(`\nStorefront: ${new URL(`/product/${PRODUCT_ID}`, 'https://sgcoalition.xyz').href}`);
}

main();
