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

const BASE_SELECT_COLUMNS = 'id,name,price,stock,images,description,category,is_featured,sizes,size_inventory,archived,created_at';

async function addAboveAsBelowSet() {
    const sizeInventory = { S: 4, M: 4, L: 4, XL: 4, '2XL': 4 };
    const product = {
        id: 'prod_set_above_as_below',
        name: 'COALITION ABOVE AS BELOW SET',
        price: 120,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setFront,
            PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setBack,
            PRODUCT_IMAGE_URLS.aboveAsBelowTee.front,
            PRODUCT_IMAGE_URLS.aboveAsBelowTee.back,
            PRODUCT_IMAGE_URLS.aboveAsBelowShorts.front,
            PRODUCT_IMAGE_URLS.aboveAsBelowShorts.back
        ],
        description: "Above as Below tee and shorts together in one set. Each piece is $75 on its own ($150 total); the set is $120, saving $30 off the combined price. Sized S-M-L-XL-2XL.",
        category: 'apparel',
        is_featured: false,
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        size_inventory: sizeInventory,
        archived: false
    };

    const optionalColumns: Record<string, unknown> = {
        is_limited_edition: true,
        image_roles: {
            primaryUrl: PRODUCT_IMAGE_URLS.aboveAsBelowShorts.setFront,
            hoverUrl: null
        },
        created_at: '2026-07-01T00:00:00-04:00'
    };

    let result;

    while (true) {
        const optionalColumnNames = Object.keys(optionalColumns);
        const selectColumns = [BASE_SELECT_COLUMNS, ...optionalColumnNames].join(',');
        result = await supabase
            .from('products')
            .upsert([{ ...product, ...optionalColumns }])
            .select(selectColumns);

        if (result.error?.code !== 'PGRST204') break;

        const missingColumn = optionalColumnNames.find(column => result.error?.message.includes(column));
        if (!missingColumn) break;

        console.warn(`products.${missingColumn} is not in the live schema yet; retrying without that optional column.`);
        delete optionalColumns[missingColumn];
    }

    const { data, error } = result;

    if (error) {
        console.error('Error upserting Above as Below Set:', error);
        process.exit(1);
    }

    console.log('Upserted Above as Below Set:', data);
}

addAboveAsBelowSet();
