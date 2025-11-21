import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: any, res: any) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { order } = req.body;

        if (!order || !order.customerEmail) {
            res.status(400).json({ error: 'Order and customer email required' });
            return;
        }

        // Generate order items HTML
        const itemsHtml = order.items.map((item: any) => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    <strong>${item.name}</strong><br>
                    <span style="color: #6b7280; font-size: 14px;">Size: ${item.size} • Qty: ${item.quantity}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    $${item.price.toFixed(2)}
                </td>
            </tr>
        `).join('');

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #000000 0%, #1f2937 100%); padding: 40px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
                                COALITION
                            </h1>
                            <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 14px;">
                                BALTIMORE, MARYLAND
                            </p>
                        </td>
                    </tr>

                    <!-- Success Message -->
                    <tr>
                        <td style="padding: 40px; text-align: center;">
                            <div style="width: 80px; height: 80px; background-color: #10b981; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                <span style="color: white; font-size: 48px;">✓</span>
                            </div>
                            <h2 style="margin: 0 0 10px 0; font-size: 28px; font-weight: bold; color: #111827;">
                                Order Confirmed!
                            </h2>
                            <p style="margin: 0; color: #6b7280; font-size: 16px;">
                                Thank you for your purchase, ${order.customerName || 'valued customer'}
                            </p>
                        </td>
                    </tr>

                    <!-- Order Details -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; padding: 20px;">
                                <tr>
                                    <td style="padding-bottom: 15px;">
                                        <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Order Number</strong><br>
                                        <span style="font-family: monospace; font-size: 14px; color: #111827;">${order.id}</span>
                                    </td>
                                    <td style="padding-bottom: 15px; text-align: right;">
                                        <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Order Total</strong><br>
                                        <span style="font-size: 24px; font-weight: bold; color: #111827;">$${order.total.toFixed(2)}</span>
                                    </td>
                                </tr>
<tr>
  <td colspan="2" style="padding-bottom: 15px;">
    <strong style="color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Shipping Method</strong><br>
    <span style="font-size: 14px; color: #111827;">${order.shippingMethod === 'express' ? `Express (+$${order.shippingCost})` : 'Standard (Free)'}</span>
  </td>
</tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Order Items -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px;">
                            <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold; color: #111827;">
                                Order Items
                            </h3>
                            <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                                ${itemsHtml}
                                <tr>
                                    <td style="padding: 12px; background-color: #f9fafb;">
                                        <strong>Total</strong>
                                    </td>
                                    <td style="padding: 12px; background-color: #f9fafb; text-align: right;">
                                        <strong>$${order.total.toFixed(2)}</strong>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    ${order.sgCoinReward > 0 ? `
                    <!-- SGCoin Reward -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px;">
                            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); border-radius: 8px; padding: 20px; text-align: center;">
                                <p style="margin: 0 0 5px 0; color: #ffffff; font-size: 14px;">
                                    SGCoin Reward Earned
                                </p>
                                <p style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">
                                    +${order.sgCoinReward.toLocaleString()}
                                </p>
                            </div>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- What's Next -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px;">
                            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px;">
                                <h3 style="margin: 0 0 15px 0; font-size: 16px; font-weight: bold; color: #1e40af;">
                                    What's Next?
                                </h3>
                                <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 14px; line-height: 1.8;">
                                    <li>Your order will be processed within 1-2 business days</li>
                                    <li>You'll receive a shipping confirmation with tracking number</li>
                                    <li>Track your order status in your profile</li>
                                    ${order.paymentMethod === 'crypto' ? '<li>We\'re verifying your crypto payment (usually within 24 hours)</li>' : ''}
                                </ul>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="padding: 40px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                                Need help? Contact us at <a href="mailto:sgctrustyourself@gmail.com" style="color: #8b5cf6; text-decoration: none;">sgctrustyourself@gmail.com</a>
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                © ${new Date().getFullYear()} Coalition Brand. All rights reserved.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        // Send email using Resend
        const data = await resend.emails.send({
            from: 'Coalition Brand <onboarding@resend.dev>',
            to: [order.customerEmail],
            subject: `Order Confirmation - ${order.id}`,
            html: emailHtml,
        });

        res.status(200).json({ success: true, data });
    } catch (err: any) {
        console.error('Email send error:', err);
        res.status(500).json({ error: err.message || 'Failed to send email' });
    }
}
