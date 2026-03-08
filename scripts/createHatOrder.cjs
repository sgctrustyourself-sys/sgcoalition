require('dotenv').config();

async function createOrderViaApi() {
    console.log('🎩 Creating sold order via API...\n');

    const orderId = crypto.randomUUID();

    const order = {
        id: orderId,
        orderNumber: 'ORD-TRUSTHAT01',
        customerName: 'Custom Order',
        customerEmail: 'sgctrustyourself@gmail.com',
        customerPhone: '',
        isGuest: true,
        items: [{
            productId: 'prod_trust_yourself_hat_01',
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
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        orderType: 'in-person',
        shippingAddress: null,
        notes: '1/1 Custom Hat - Trust Yourself Trucker. Sold and delivered.',
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        sgCoinReward: 0
    };

    try {
        const response = await fetch('https://sgcoalition.xyz/api/complete-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Order created successfully!');
            console.log('   Order ID:', orderId);
            console.log('   Response:', JSON.stringify(data, null, 2));
        } else {
            console.error('❌ API error:', response.status, JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error('❌ Request failed:', err.message);
    }
}

createOrderViaApi();
