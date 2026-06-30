import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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
const PRODUCT_IMAGES = [
    'https://i.imgur.com/9NF3LzM.jpg',
    'https://i.imgur.com/UoY42bg.jpg'
];

async function addAboveAsBelowWallet1_1() {
    const sizeInventory = { 'One Size': 1 };
    const totalStock = Object.values(sizeInventory).reduce((sum, count) => sum + count, 0);
    const product = {
        id: 'Coalition_Above_As_Below_Wallet_1_1',
        name: 'COALITION ABOVE AS BELOW 1/1 WALLET',
        price: 85,
        stock: totalStock,
        images: PRODUCT_IMAGES,
        description: '1/1 Above as Below wallet. Hand-finished with the same storm-and-balance motif as the matching Above as Below tee - single piece, one red-and-white Coalition mark, scaled for everyday carry. Once sold, gone forever.',
        category: 'wallet',
        is_featured: false,
        sizes: ['One Size'],
        size_inventory: sizeInventory,
        archived: false
    };

    const optionalColumns: Record<string, unknown> = {
        is_limited_edition: true,
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
        console.error('Error upserting Above as Below Wallet 1/1:', error);
        process.exit(1);
    }

    console.log(`Upserted Above as Below Wallet 1/1 (stock: ${totalStock}):`, data);
}

addAboveAsBelowWallet1_1();
