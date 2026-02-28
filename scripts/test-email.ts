import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);

async function testEmail() {
  console.log('Testing Smart Email Logic...');

  const orderId = 'TEST-SMART-001';
  const customerName = 'Antigravity Test';
  const customerEmail = 'sgctrustyourself@gmail.com';
  const total = 250.00; // High value to trigger 🔥
  const items = [
    { name: 'Premium Hoodie', quantity: 2 },
    { name: 'Cap', quantity: 1 }
  ];
  const paymentMethod = 'Crypto (USDC)';
  const shippingAddress = { city: 'New York', state: 'NY', country: 'USA', line1: '123 Broadway' };

  // --- LOGIC FROM api/notify-order.ts ---
  // SMART SUBJECT LINE LOGIC
  let subjectPrefix = '🟢'; // Default: Standard
  if (total >= 200) subjectPrefix = '🔥'; // High Value
  if (shippingAddress.line1?.toLowerCase().includes('express') || paymentMethod.toLowerCase().includes('express')) subjectPrefix = '📦'; // Express

  const subject = `${subjectPrefix} [TEST] New Order – $${total.toFixed(0)} – Order #${orderId}`;

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
  // --------------------------------------

  try {
    const response = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: ['sgctrustyourself@gmail.com'],
      subject: subject,
      html: emailHtml,
    });

    if (response.error) {
      console.error('Failed to send email:', response.error);
    } else {
      console.log('Success! Smart Email sent.');
      console.log('Subject:', subject);
      console.log('Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.error('Exception:', error);
  }
}

testEmail();
