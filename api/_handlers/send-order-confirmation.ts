import { Resend } from 'resend';
import { EXTENDED_CORS_HEADERS, setCorsHeaders } from '../_helpers';
import type {
    ApiRequest,
    ApiResponse,
    OrderInput,
    OrderItemInput,
    ResendEmailPayload,
    ShippingAddress,
} from '../_types';

const resend = new Resend(process.env.RESEND_API_KEY);
const DEFAULT_ORDER_NOTIFICATION_EMAIL = 'sgctrustyourself@gmail.com';

function getOrderNotificationRecipients() {
    return (process.env.ORDER_NOTIFICATION_EMAIL || process.env.ADMIN_ORDER_EMAIL || DEFAULT_ORDER_NOTIFICATION_EMAIL)
        .split(',')
        .map(email => email.trim())
        .filter(Boolean);
}

function getResendFromAddress() {
    return process.env.RESEND_FROM_EMAIL || 'SG Coalition <onboarding@resend.dev>';
}

async function sendResendEmail(payload: ResendEmailPayload) {
    const result = await resend.emails.send({
        ...payload,
        from: getResendFromAddress(),
    } as Parameters<Resend['emails']['send']>[0]);

    const error = result?.error;
    if (error) {
        throw new Error(error.message || 'Resend rejected the email request.');
    }

    return result;
}

function escapeHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function sendAdminOrderNotification(order: OrderInput): Promise<void> {
    const recipients = getOrderNotificationRecipients();
    if (recipients.length === 0) return;

    const itemsHtml = (order.items ?? []).map((item: OrderItemInput) => {
        const unitPrice = Number(item.price) || 0;
        const quantity = Math.max(1, Number(item.quantity || 1));
        return `
        <tr>
            <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
                <strong>${escapeHtml(item.name || item.productName || 'Product')}</strong><br>
                <span style="color:#6b7280;font-size:13px;">Size: ${escapeHtml(item.size || item.selectedSize || 'One Size')} - Qty: ${escapeHtml(quantity)}</span>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$${unitPrice.toFixed(2)}</td>
            <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;text-align:right;">$${(unitPrice * quantity).toFixed(2)}</td>
        </tr>
    `;
    }).join('');

    const shippingRaw = order.shippingInfo || order.shippingAddress || {};
    const shipping = (typeof shippingRaw === 'object' && shippingRaw !== null ? shippingRaw : {}) as ShippingAddress;
    await sendResendEmail({
        to: recipients,
        subject: `ACTION REQUIRED: Prepare Coalition order ${order.id}`,
        html: `
            <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:28px;background:#ffffff;color:#111827;">
                <h1 style="margin:0 0 8px;letter-spacing:2px;text-transform:uppercase;">Order Ready To Fulfill</h1>
                <p style="margin:0 0 24px;color:#6b7280;">A paid order was placed on sgcoalition.xyz. Prepare, pack, and ship the items below.</p>
                <div style="background:#111827;color:#ffffff;border-radius:8px;padding:18px;margin-bottom:24px;">
                    <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">Fulfillment Summary</div>
                    <div style="font-size:28px;font-weight:bold;margin-top:4px;">${escapeHtml(order.id)}</div>
                    <div style="margin-top:8px;">Total: <strong>$${Number(order.total || 0).toFixed(2)}</strong> | Payment: <strong>${escapeHtml(order.paymentMethod || order.payment_method || 'unknown')}</strong></div>
                </div>
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
                    <tr><td style="padding:12px;background:#f9fafb;"><strong>Order</strong></td><td style="padding:12px;text-align:right;">${escapeHtml(order.id)}</td></tr>
                    <tr><td style="padding:12px;background:#f9fafb;"><strong>Total</strong></td><td style="padding:12px;text-align:right;">$${Number(order.total || 0).toFixed(2)}</td></tr>
                    <tr><td style="padding:12px;background:#f9fafb;"><strong>Payment</strong></td><td style="padding:12px;text-align:right;">${escapeHtml(order.paymentMethod || order.payment_method || 'unknown')}</td></tr>
                    <tr><td style="padding:12px;background:#f9fafb;"><strong>Shipping</strong></td><td style="padding:12px;text-align:right;">${escapeHtml(order.shippingMethod || shipping.shippingMethod || 'standard')} ($${Number(order.shippingCost || shipping.shippingCost || 0).toFixed(2)})</td></tr>
                </table>
                <h2 style="font-size:18px;margin:0 0 10px;">Customer</h2>
                <p style="margin:0 0 20px;line-height:1.6;">
                    ${escapeHtml(order.customerName || '')}<br>
                    <a href="mailto:${escapeHtml(order.customerEmail || '')}">${escapeHtml(order.customerEmail || '')}</a>
                </p>
                <h2 style="font-size:18px;margin:0 0 10px;">Ship To</h2>
                <p style="margin:0 0 20px;line-height:1.6;">
                    ${escapeHtml(shipping.address1 || '')}<br>
                    ${escapeHtml(shipping.city || '')}${shipping.city && shipping.state ? ', ' : ''}${escapeHtml(shipping.state || '')} ${escapeHtml(shipping.zip || '')}<br>
                    ${escapeHtml(shipping.country || '')}
                </p>
                <h2 style="font-size:18px;margin:0 0 10px;">Items</h2>
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                        <th align="left" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Item</th>
                        <th align="right" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Unit</th>
                        <th align="right" style="padding:0 0 8px;color:#6b7280;font-size:12px;text-transform:uppercase;">Line</th>
                    </tr>
                    ${itemsHtml}
                </table>
                <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:16px;margin-bottom:24px;">
                    <strong>Next step:</strong> Pull the items, verify size/quantity, pack the order, then update the admin dashboard when it ships.
                </div>
                <p style="margin-top:24px;">
                    <a href="https://sgcoalition.xyz/#/admin" style="background:#111827;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Open Admin Dashboard</a>
                </p>
            </div>
        `,
    });
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
    // Set CORS headers
    setCorsHeaders(req, res, {
        methods: 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
        allowedHeaders: EXTENDED_CORS_HEADERS,
    });

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const body = (req.body ?? {}) as { order?: OrderInput };
        const order = body.order;

        if (!order || !order.customerEmail) {
            res.status(400).json({ error: 'Order and customer email required' });
            return;
        }

        // Generate order items HTML
        const itemsHtml = (order.items || []).map((item: OrderItemInput) => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    <strong>${item.name || item.productName || 'Item'}</strong><br>
                    <span style="color: #6b7280; font-size: 14px;">Size: ${item.size || item.selectedSize || 'One Size'} • Qty: ${item.quantity || 1}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
                    $${(Number(item.price) || 0).toFixed(2)}
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
                                        <span style="font-size: 24px; font-weight: bold; color: #111827;">$${(Number(order.total) || 0).toFixed(2)}</span>
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
                                        <strong>$${(Number(order.total) || 0).toFixed(2)}</strong>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    ${(order.sgCoinReward ?? 0) > 0 ? `
                    <!-- SGCoin Reward -->
                    <tr>
                        <td style="padding: 0 40px 40px 40px;">
                            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); border-radius: 8px; padding: 20px; text-align: center;">
                                <p style="margin: 0 0 5px 0; color: #ffffff; font-size: 14px;">
                                    SGCoin Reward Earned
                                </p>
                                <p style="margin: 0; color: #ffffff; font-size: 32px; font-weight: bold;">
                                    +${Number(order.sgCoinReward ?? 0).toLocaleString()}
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
        const data = await sendResendEmail({
            to: [order.customerEmail],
            subject: `Order Confirmation - ${order.id}`,
            html: emailHtml,
        });

        let adminNotification = null;
        try {
            adminNotification = await sendAdminOrderNotification(order);
        } catch (emailError: unknown) {
            console.warn('Admin order notification failed:', emailError);
        }

        res.status(200).json({ success: true, data, adminNotification });
    } catch (err: unknown) {
        console.error('Email send error:', err);
        const message = err instanceof Error ? err.message : 'Failed to send email';
        res.status(500).json({ error: message });
    }
}
