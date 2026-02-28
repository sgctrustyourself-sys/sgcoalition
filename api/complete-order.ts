import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-change-in-prod';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ CRITICAL: Missing Supabase env vars in complete-order. URL:', !!supabaseUrl, 'Key:', !!supabaseServiceKey);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

function verifyToken(req: any) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        return decoded && decoded.role === 'admin';
    } catch (e) {
        return false;
    }
}

export default async function handler(req: any, res: any) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PATCH, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        const isAdmin = verifyToken(req);
        const debugDb = req.headers['x-debug-db'] === 'true';

        if (!isAdmin) {
            res.status(401).json({ error: 'Unauthorized: Invalid or missing admin token' });
            return;
        }

        if (debugDb) {
            try {
                const results: any = {};
                const tables = ['orders', 'orders_v2', 'stripe_orders', 'paypal_orders', 'payments', 'transactions', 'order_items'];
                for (const t of tables) {
                    const { count, error } = await supabaseAdmin.from(t).select('*', { count: 'exact', head: true });
                    results[t] = error ? ('Error: ' + error.message) : count;
                }
                return res.status(200).json(results);
            } catch (err: any) {
                return res.status(500).json({ error: err.message });
            }
        }

        try {
            console.log('🔍 Fetching all orders via admin bypass...');
            const { data, error } = await supabaseAdmin
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.status(200).json(data);
            return;
        } catch (error: any) {
            console.error('❌ Error fetching orders via bypass:', error);
            res.status(500).json({ error: error.message });
            return;
        }
    }

    if (req.method === 'PATCH') {
        const isAdmin = verifyToken(req);
        if (!isAdmin) {
            res.status(401).json({ error: 'Unauthorized: Invalid or missing admin token' });
            return;
        }

        const { id, updates } = req.body;
        if (!id || !updates) {
            res.status(400).json({ error: 'Missing id or updates in request body' });
            return;
        }

        try {
            console.log(`📝 Updating order ${id}...`);
            const { data, error } = await supabaseAdmin
                .from('orders')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return res.status(200).json({ success: true, data });
        } catch (error: any) {
            console.error('❌ Error updating order:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { order } = req.body;

    if (!order || !order.items || !order.id) {
        res.status(400).json({ error: 'Missing order data' });
        return;
    }

    try {
        console.log(`📦 Processing order ${order.orderNumber} (${order.id})...`);

        // 1. Deduct Inventory
        for (const item of order.items) {
            const { data: product, error: fetchError } = await supabaseAdmin
                .from('products')
                .select('name, size_inventory')
                .eq('id', item.productId)
                .single();

            if (fetchError || !product) {
                console.warn(`⚠️ Product ${item.productId} not found for inventory deduction`);
                continue;
            }

            const sizeInventory = product.size_inventory || {};
            if (sizeInventory[item.selectedSize] !== undefined) {
                const currentStock = sizeInventory[item.selectedSize];
                const newStock = Math.max(0, currentStock - item.quantity);
                sizeInventory[item.selectedSize] = newStock;

                // Auto-Archive Logic
                const totalStock = Object.values(sizeInventory).reduce((a: any, b: any) => a + b, 0);
                const updates: any = { size_inventory: sizeInventory };

                if (totalStock === 0) {
                    const now = new Date().toISOString();
                    updates.archived = true;
                    updates.archived_at = now;
                    updates.sold_at = now;
                    console.log(`🔥 Product ${product.name} sold out! Auto-archiving...`);
                }

                const { error: updateError } = await supabaseAdmin
                    .from('products')
                    .update(updates)
                    .eq('id', item.productId);

                if (updateError) {
                    console.error(`❌ Failed to update inventory for ${product.name}:`, updateError);
                } else {
                    console.log(`✅ Inventory updated for ${product.name} (${item.selectedSize}: ${currentStock} -> ${newStock})`);
                }
            }
        }

        // 2. Insert Order Record
        const dbOrder = {
            id: order.id,
            order_number: order.orderNumber,
            user_id: order.userId && !order.userId.startsWith('user_eth_') ? order.userId : null,
            is_guest: order.isGuest,
            customer_name: order.customerName,
            customer_email: order.customerEmail,
            customer_phone: order.customerPhone,
            items: order.items,
            subtotal: order.subtotal,
            tax: order.tax,
            discount: order.discount,
            total: order.total,
            total_amount: order.total,
            payment_method: order.paymentMethod,
            payment_status: order.paymentStatus,
            order_type: order.orderType,
            shipping_address: order.shippingAddress,
            shipping_info: order.shippingAddress || { name: order.customerName, email: order.customerEmail },
            notes: order.notes,
            created_at: order.createdAt || new Date().toISOString(),
            paid_at: order.paidAt || (order.paymentStatus === 'paid' ? new Date().toISOString() : null),
            sg_coin_reward: order.sgCoinReward || 0
        };

        const { error: orderError } = await supabaseAdmin
            .from('orders')
            .insert([dbOrder]);

        if (orderError) {
            console.error('❌ Failed to save order to database:', orderError);
            throw orderError;
        }

        console.log('✅ Order saved to Supabase history');

        // 3. Send Notifications
        if (process.env.RESEND_API_KEY) {
            try {
                const { Resend } = await import('resend');
                const resend = new Resend(process.env.RESEND_API_KEY);

                // --- Customer Confirmation ---
                const itemsHtml = order.items.map((item: any) => `
                    <tr>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                            <strong>${item.name}</strong><br>
                            <span style="color: #6b7280; font-size: 14px;">Size: ${item.selectedSize} • Qty: ${item.quantity}</span>
                        </td>
                        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                            $${item.price.toFixed(2)}
                        </td>
                    </tr>
                `).join('');

                const customerEmailHtml = `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #fff; padding: 20px; border-radius: 8px;">
                        <h1 style="text-align: center; color: #000; letter-spacing: 2px;">COALITION</h1>
                        <h2 style="text-align: center; color: #111827;">Order Confirmed!</h2>
                        <p>Hi ${order.customerName},</p>
                        <p>Thank you for your purchase. Your order <strong>#${order.orderNumber}</strong> has been received and is being processed.</p>
                        
                        <table width="100%" style="border-collapse: collapse; margin: 20px 0;">
                            <thead>
                                <tr style="background: #f9fafb;">
                                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
                                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsHtml}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td style="padding: 12px; font-weight: bold;">Total</td>
                                    <td style="padding: 12px; text-align: right; font-weight: bold;">$${order.total.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>

                        <div style="background: #eff6ff; padding: 15px; border-radius: 8px;">
                            <h3 style="margin-top: 0; color: #1e40af;">What's Next?</h3>
                            <ul style="color: #1e40af; font-size: 14px;">
                                <li>Your order will be processed within 1-2 business days.</li>
                                <li>You'll receive a shipping confirmation once it's on the way.</li>
                            </ul>
                        </div>
                        <p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 30px;">
                            © ${new Date().getFullYear()} Coalition Brand. Baltimore, MD.
                        </p>
                    </div>
                `;

                await resend.emails.send({
                    from: 'SG Coalition <orders@resend.dev>',
                    to: [order.customerEmail],
                    subject: `Order Confirmation - #${order.orderNumber}`,
                    html: customerEmailHtml,
                });

                // --- Admin Notification ---
                const adminEmailHtml = `
                    <div style="font-family: sans-serif; background: #fdf2f8; padding: 20px; border-radius: 8px;">
                        <h2 style="color: #be185d;">🟢 New Order Received: #${order.orderNumber}</h2>
                        <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
                        <p><strong>Total:</strong> $${order.total.toFixed(2)}</p>
                        <p><strong>Payment:</strong> ${order.paymentMethod} (${order.paymentStatus})</p>
                        <p><strong>Shipping:</strong> ${order.shippingAddress.city}, ${order.shippingAddress.state}, ${order.shippingAddress.country}</p>
                        <hr style="border: none; border-top: 1px solid #fbcfe8; margin: 20px 0;" />
                        <h3>Items:</h3>
                        <ul>
                            ${order.items.map((i: any) => `<li>${i.name} (${i.selectedSize}) x${i.quantity}</li>`).join('')}
                        </ul>
                    </div>
                `;

                await resend.emails.send({
                    from: 'System <orders@resend.dev>',
                    to: ['sgctrustyourself@gmail.com'],
                    subject: `🔥 New Order Alert - $${order.total.toFixed(0)} - #${order.orderNumber}`,
                    html: adminEmailHtml,
                });

                console.log('📧 Confirmation emails sent to customer and admin');
            } catch (emailErr) {
                console.error('❌ Failed to send confirmation emails:', emailErr);
                // We don't throw here to avoid failing the whole request if emails fail
            }
        }

        res.status(200).json({ success: true, orderId: order.id });

    } catch (error: any) {
        console.error('❌ Order Completion Error:', error);

        // Send Error Notification to Admin
        if (process.env.RESEND_API_KEY) {
            try {
                const { Resend } = await import('resend');
                const resend = new Resend(process.env.RESEND_API_KEY);

                await resend.emails.send({
                    from: 'System <errors@resend.dev>',
                    to: ['sgctrustyourself@gmail.com'],
                    subject: `🚨 FAILED Order Attempt - #${order.orderNumber}`,
                    html: `
                        <div style="font-family: sans-serif; background: #fee2e2; padding: 20px; border-radius: 8px; border: 1px solid #ef4444;">
                            <h2 style="color: #991b1b;">🚨 Critical Order Failure</h2>
                            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                            <p><strong>Error Message:</strong> ${error.message}</p>
                            <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
                            <hr style="border: none; border-top: 1px solid #f87171; margin: 20px 0;" />
                            <p style="font-size: 12px; color: #7f1d1d;">This error occurred during server-side processing. Inventory or order records may be incomplete.</p>
                        </div>
                    `
                });
            } catch (emailErr) {
                console.error('❌ Failed to send error notification:', emailErr);
            }
        }

        res.status(500).json({ error: error.message });
    }
}
