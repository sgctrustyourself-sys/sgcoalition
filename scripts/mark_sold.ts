import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('👖 Marking True Religion Jeans as sold...');

    const { error: updateError } = await supabase
        .from('products')
        .update({ stock: 0, size_inventory: { '33': 0 } })
        .eq('id', 'Coalition_x_True_Religion_S1');

    if (updateError) {
        console.error('❌ Error updating product:', updateError.message);
    } else {
        console.log('✅ Jeans marked as sold.');
    }

    console.log('🧾 Creating invoice...');

    const orderId = 'pi_invoice_' + Math.random().toString(36).substr(2, 9);
    const orderNumber = 'INV-' + Math.floor(Math.random() * 1000000);

    const invoiceData = {
        id: orderId,
        order_number: orderNumber,
        is_guest: true,
        customer_name: 'Pending Details',
        customer_email: 'pending@example.com',
        items: [{
            id: 'Coalition_x_True_Religion_S1',
            name: 'Coalition x True Religion 1/1 Jeans S1',
            price: 240,
            quantity: 1,
            size: '33'
        }],
        subtotal: 240,
        tax: 0,
        discount: 0,
        total: 240,
        payment_method: 'manual_invoice',
        payment_status: 'pending',
        order_type: 'custom_invoice'
    };

    const { error: insertError } = await supabase
        .from('orders')
        .insert([invoiceData]);

    if (insertError) {
        console.error('❌ Error creating invoice:', insertError.message);
    } else {
        console.log(`✅ Invoice created! Order Number: ${orderNumber}`);
    }
}

run();
