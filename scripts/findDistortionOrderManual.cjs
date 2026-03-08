const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function findOrder() {
    console.log('🔍 Fetching all orders to find Distortion Tee...');
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*');

    if (error) {
        console.error('❌ Error fetching orders:', error);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log('❓ No orders found in the database.');
        return;
    }

    console.log(`✅ Found ${orders.length} orders total. Filtering for "Distortion Tee"...`);

    const relevantOrders = orders.filter(order => {
        if (!order.items) return false;
        const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        return items.some(item =>
            item.productId === 'prod_1771428520137' ||
            (item.name && item.name.toLowerCase().includes('distortion'))
        );
    });

    if (relevantOrders.length === 0) {
        console.log('❓ No relevant orders found.');
    } else {
        console.log('🎯 Found relevant order(s):', JSON.stringify(relevantOrders, null, 2));
    }
}

findOrder();
