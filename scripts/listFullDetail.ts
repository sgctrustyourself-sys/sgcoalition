import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listFullDetail() {
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
        console.error(error);
        return;
    }
    fs.writeFileSync('full_products.json', JSON.stringify(data, null, 2));
    console.log(`Success: Found ${data.length} products. Details written to full_products.json`);
}
listFullDetail();
