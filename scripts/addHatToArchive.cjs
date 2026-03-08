const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function addHatProductAndOrder() {
    console.log('🎩 Adding Trust Yourself Hat to archive + creating sold order...\n');

    // --- STEP 1: Add the product ---
    const productId = 'prod_trust_yourself_hat_01';
    const product = {
        id: productId,
        name: 'Trust Yourself Custom Trucker (1/1)',
        price: 50,
        stock: 0,
        category: 'headwear',
        images: [
            'https://i.imgur.com/iYBlwm8.png',
            'https://i.imgur.com/jwnVHoI.png',
            'https://i.imgur.com/YNiTSFA.png',
            'https://i.imgur.com/HqcoV24.png',
            'https://i.imgur.com/6179VgH.png'
        ],
        description: 'A one-of-one custom trucker hat featuring 3D puff "TRUST YOURSELF" embroidery, hand-distressed brim, and a custom D20 pin. This piece represents the next evolution of Coalition headwear.',
        is_featured: false,
        sizes: ['One Size'],
        size_inventory: { 'One Size': 0 },
        archived: true,
        archived_at: new Date().toISOString(),
        sold_at: new Date().toISOString()
    };

    const { data: productData, error: productErr } = await supabase
        .from('products')
        .upsert([product], { onConflict: 'id' })
        .select();

    if (productErr) {
        console.error('❌ Product insert error:', productErr);
        return;
    }
    console.log('✅ Product added to archive:', productData[0].name);
    console.log('   ID:', productData[0].id);
    console.log('   Price: $' + productData[0].price);
    console.log('   Archived:', productData[0].archived);

    // --- STEP 2: Create the sold order ---
    const orderNumber = 'ORD-TRUSTHAT01';
    const order = {
        order_number: orderNumber,
        customer_name: 'Custom Order',
        customer_email: '',
        is_guest: true,
        items: [{
            productId: productId,
            name: 'Trust Yourself Custom Trucker (1/1)',
            price: 50,
            quantity: 1,
            selectedSize: 'One Size',
            image: 'https://i.imgur.com/iYBlwm8.png'
        }],
        subtotal: 50,
        tax: 0,
        discount: 0,
        total: 50,
        payment_method: 'cash',
        payment_status: 'paid',
        order_type: 'in-person',
        notes: '1/1 Custom Hat - Trust Yourself Trucker. Sold and delivered.',
        paid_at: new Date().toISOString(),
        sg_coin_reward: 0
    };

    const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .insert([order])
        .select();

    if (orderErr) {
        console.error('❌ Order insert error:', orderErr);
        return;
    }
    console.log('\n✅ Order created:', orderData[0].order_number);
    console.log('   Total: $' + orderData[0].total);
    console.log('   Status:', orderData[0].payment_status);
    console.log('   Type:', orderData[0].order_type);

    console.log('\n🎉 Done! Hat is archived and order is marked as sold.');
}

addHatProductAndOrder();
