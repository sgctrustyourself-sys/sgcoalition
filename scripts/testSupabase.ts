import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase URL or Key is missing in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('Testing Supabase connection...');
    console.log('URL:', supabaseUrl);

    try {
        const { data, error } = await supabase.from('products').select('*');

        if (error) {
            console.error('Error fetching products:', error);
        } else {
            console.log('Successfully fetched products:', data.length);
            if (data.length > 0) {
                console.log('First product:', data[0]);
            } else {
                console.log('No products found in the database.');
            }
        }
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

testConnection();
