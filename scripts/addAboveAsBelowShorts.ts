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

const BASE_SELECT_COLUMNS = 'id,name,price,stock,images,archived,size_inventory';

async function addAboveAsBelowShorts() {
    const sizeInventory = { S: 9, M: 9, L: 9, XL: 9, '2XL': 8 };
    const product = {
        id: 'prod_shorts_above_as_below',
        name: 'COALITION ABOVE AS BELOW SHORTS',
        price: 75,
        stock: Object.values(sizeInventory).reduce((sum, count) => sum + count, 0),
        images: [
            '/images/above-as-below-set-front.png',
            '/images/above-as-below-set-back.png'
        ],
        description: "The matching Above as Below shorts. Same hand-crafted red-and-white Coalition lineage as the tee - heavyweight cotton, deep set pocket, raw-hem finished. Sold at $75 individually, or grab the set with the tee for $120 and save $30.",
        category: 'apparel',
        is_featured: false,
        sizes: ['S', 'M', 'L', 'XL', '2XL'],
        size_inventory: sizeInventory,
        archived: false
    };

    const optionalColumns: Record<string, unknown> = {
        is_limited_edition: true
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
        console.error('Error upserting Above as Below Shorts:', error);
        process.exit(1);
    }

    console.log('Upserted Above as Below Shorts:', data);
}

addAboveAsBelowShorts();
