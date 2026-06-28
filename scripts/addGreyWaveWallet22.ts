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
const MAKING_VIDEO_URL = 'https://www.instagram.com/p/DZ8z0t0Tfws/';
const PRODUCT_IMAGES = [
    'https://i.imgur.com/FVMHZoq.jpeg',
    'https://i.imgur.com/LLoGORu.jpeg'
];

const BASE_SELECT_COLUMNS = 'id,name,price,stock,images,archived,size_inventory';

async function addGreyWaveWallet22() {
    const sizeInventory = { 'One Size': 1 };
    const product = {
        id: 'Coalition_Grey_Wave_Wallet_2_2',
        name: "Coalition 'Grey Wave' Wallet 2/2",
        price: 35,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: PRODUCT_IMAGES,
        description: "Second and final piece in the Coalition 'Grey Wave' wallet run. Hand-finished with a storm-grey wave pattern, raw edge stitching, copper grommet, and Coalition mark. Built as a limited 2/2 collectible - once sold, it's gone forever.",
        category: 'wallet',
        is_featured: false,
        sizes: ['One Size'],
        size_inventory: sizeInventory,
        archived: false
    };

    const optionalColumns: Record<string, unknown> = {
        is_limited_edition: true,
        making_video_url: MAKING_VIDEO_URL
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
        console.error('Error upserting Grey Wave Wallet 2/2:', error);
        process.exit(1);
    }

    console.log('Upserted Grey Wave Wallet 2/2:', data);
}

addGreyWaveWallet22();
