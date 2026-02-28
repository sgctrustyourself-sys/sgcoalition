import { Resend } from 'resend';
import { Order } from '../types';

// Initialize Resend with API key
// Default to empty string if not set, logic will handle the error gracefully
const resend = new Resend(process.env.RESEND_API_KEY);

interface NotifyOrderRequest {
  order: Order;
  customerEmail: string;
  customerName: string;
  total: number;
  items: Array<{ name: string; quantity: number }>;
  paymentMethod: string;
  shippingAddress: {
    city: string;
    state: string;
    country: string;
    line1?: string;
  };
}

export default async function handler(request: Request) {
  // CORS Headers for client-side access
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body: NotifyOrderRequest = await request.json();
    const { order, customerEmail, customerName, total, items, paymentMethod, shippingAddress } = body;

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is missing');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Donation Logic Check
    const isDonationEligible = true; // All orders currently contribute

    // SMART SUBJECT LINE LOGIC
    let subjectPrefix = '🟢'; // Default: Standard
    if (total >= 200) subjectPrefix = '🔥'; // High Value
    if (shippingAddress.line1?.toLowerCase().includes('express') || paymentMethod.toLowerCase().includes('express')) subjectPrefix = '📦'; // Express (Simulated logic, ideally pass shippingMethod)

    const subject = `${subjectPrefix} New Order – $${total.toFixed(0)} – Order #${order.id}`;

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #000;">${subject}</h2>
        <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} (ET)</p>
        
        <div style="background: #fdf2f8; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #fbcfe8;">
          <h3 style="color: #be185d; margin-top: 0;">💜 Donation Signal</h3>
          <ul style="list-style: none; padding: 0; color: #831843;">
            <li><strong>Item Count:</strong> ${items.reduce((acc, item) => acc + item.quantity, 0)} (Simulated 1:1)</li>
            <li><strong>Program:</strong> This Month's Local Partner</li>
            <li><strong>Region:</strong> ${shippingAddress.city}, ${shippingAddress.state}</li>
          </ul>
        </div>

        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        
        <h3>Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${items.map(item => `
            <tr>
              <td style="padding: 8px 0;">${item.name} (x${item.quantity})</td>
            </tr>
          `).join('')}
        </table>
        
        <p style="font-size: 18px; font-weight: bold; margin-top: 20px;">
          Total: $${total.toFixed(2)}
        </p>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        
        <h3>Details</h3>
        <ul style="list-style: none; padding: 0;">
          <li><strong>Payment Method:</strong> ${paymentMethod}</li>
          <li><strong>Shipping:</strong> ${shippingAddress.city}, ${shippingAddress.state}, ${shippingAddress.country}</li>
        </ul>
      </div>
    `;

    // Send Email
    const response = await resend.emails.send({
      from: 'SG Coalition <orders@resend.dev>', // Default Resend test domain or configured domain
      to: ['sgctrustyourself@gmail.com'],
      subject: subject,
      html: emailHtml,
    });

    if (response.error) {
      console.error('Error sending order email:', response.error);
      return new Response(JSON.stringify({ error: response.error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, id: response.data?.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error sending order email:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}
