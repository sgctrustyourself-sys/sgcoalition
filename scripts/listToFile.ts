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

async function listToFile() {
    const { data, error } = await supabase.from('products').select('id, name, archived');
    if (error) {
        fs.writeFileSync('product_ids.txt', JSON.stringify(error));
        return;
    }
    const lines = data.map(p => `ID: ${p.id} | NAME: ${p.name.trim()} | ARCHIVED: ${p.archived}`);
    fs.writeFileSync('product_ids.txt', lines.join('\n'));
}
listToFile();
