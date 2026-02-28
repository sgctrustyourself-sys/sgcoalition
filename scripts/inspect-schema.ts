import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
    console.log('🔍 Checking orders table schema...');

    // Get one row to see columns
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Error:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log('✅ Columns found:', Object.keys(data[0]).join(', '));
    } else {
        console.log('⚠️ No orders found to inspect columns.');
    }
}

checkSchema();
