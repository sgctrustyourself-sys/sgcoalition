
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase keys in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing Supabase Connection...');
    console.log('URL:', supabaseUrl);

    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .limit(5);

        if (error) {
            console.error('Supabase Error:', error);
        } else {
            console.log('Successfully fetched products:', data.length);
            if (data.length > 0) {
                console.log('Sample Product:', data[0].name);
            } else {
                console.warn('No products found in the table.');
            }
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
    }
}

testConnection();
