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

const BASE_SELECT_COLUMNS = 'id,name,price,stock,images,description,category,is_featured,sizes,size_inventory,archived';
const SIZES = ['S', 'M', 'L', 'XL'] as const;
const sizeInventory = { S: 1, M: 1, L: 1, XL: 1 };
const createdAt = '2026-07-01T00:00:00-04:00';

const products = [
    {
        id: 'prod_womens_above_as_below_contrast_shorts',
        name: "WOMEN'S COALITION ABOVE AS BELOW CONTRAST SHORTS",
        price: 40,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.front,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.back,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setBack,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setAngledFront
        ],
        image_roles: {
            primaryUrl: PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.front,
            hoverUrl: null
        },
        description: "Women's Above as Below contrast shorts in black with white trim, red Coalition artwork, and a red waistband label. Available S-M-L-XL. $40 separately, or grab the matching crop tank and shorts set for $75.",
        category: 'shorts',
        is_featured: false,
        sizes: [...SIZES],
        size_inventory: sizeInventory,
        archived: false
    },
    {
        id: 'prod_womens_above_as_below_crop_tank',
        name: "WOMEN'S COALITION ABOVE AS BELOW CREWNECK CROP TANK",
        price: 40,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.front,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.back,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setBack,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setAngledFront
        ],
        image_roles: {
            primaryUrl: PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.front,
            hoverUrl: null
        },
        description: "Women's Above as Below crewneck crop tank in black with front SG artwork, back Above as Below graphic, and red Coalition hem label. $40 separately, or pair it with the contrast shorts as a $75 set.",
        category: 'shirt',
        is_featured: false,
        sizes: [...SIZES],
        size_inventory: sizeInventory,
        archived: false
    },
    {
        id: 'prod_womens_above_as_below_set',
        name: "WOMEN'S COALITION ABOVE AS BELOW SET",
        price: 75,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setBack,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setAngledFront,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.front,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowCropTank.back,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.front,
            PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.back
        ],
        image_roles: {
            primaryUrl: PRODUCT_IMAGE_URLS.womensAboveAsBelowContrastShorts.setFront,
            hoverUrl: null
        },
        description: "Women's Above as Below set with the crewneck crop tank and contrast shorts together. Black body, red-and-white Coalition artwork, and matching set styling. $75 as a set, sized S-M-L-XL.",
        category: 'apparel',
        is_featured: false,
        sizes: [...SIZES],
        size_inventory: sizeInventory,
        archived: false
    }
];

async function upsertWithOptionalColumns(product: typeof products[number]) {
    const { image_roles, ...baseProduct } = product;
    const optionalColumns: Record<string, unknown> = {
        is_limited_edition: true,
        image_roles,
        created_at: createdAt
    };

    let result;

    while (true) {
        const optionalColumnNames = Object.keys(optionalColumns);
        const selectColumns = [BASE_SELECT_COLUMNS, ...optionalColumnNames].join(',');
        result = await supabase
            .from('products')
            .upsert([{ ...baseProduct, ...optionalColumns }])
            .select(selectColumns);

        if (result.error?.code !== 'PGRST204') break;

        const missingColumn = optionalColumnNames.find(column => result.error?.message.includes(column));
        if (!missingColumn) break;

        console.warn(`products.${missingColumn} is not in the live schema yet; retrying without that optional column.`);
        delete optionalColumns[missingColumn];
    }

    const { data, error } = result;

    if (error) {
        console.error(`Error upserting ${product.name}:`, error);
        process.exit(1);
    }

    console.log(`Upserted ${product.name}:`, data);
}

async function main() {
    for (const product of products) {
        await upsertWithOptionalColumns(product);
    }
}

main();
