import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const resend = new Resend(process.env.RESEND_API_KEY);

async function testInquiryEmail() {
    console.log('Testing Inquiry Email Logic...');

    // Mock Data
    const customerName = 'Antigravity Test';
    const customerEmail = 'sgctrustyourself@gmail.com';
    const customerPhone = '(555) 123-4567';
    const productType = 'apparel-shirt';
    const title = 'Custom Hoodie Design';
    const description = 'I want a black oversized hoodie with a puff print logo on the back and embroidery on the sleeve. Fabric should be 400gsm heavyweight cotton.';
    const budgetRange = '100-250';
    const timeline = '2-4-weeks';
    const referenceImages = [
        'https://via.placeholder.com/150',
        'https://via.placeholder.com/150'
    ];

    // --- LOGIC FROM api/notify-inquiry.ts ---
    const isProd = false; // Simulating local
    const envPrefix = isProd ? '' : '[TEST] ';

    const subject = `${envPrefix}📝 New Custom Inquiry: ${title} (${productType})`;

    const emailHtml = `
  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #6d28d9;">${subject}</h2>
    
    <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0;"><strong>Customer:</strong> ${customerName}</p>
      <p style="margin: 5px 0;"><strong>Email:</strong> <a href="mailto:${customerEmail}">${customerEmail}</a></p>
      ${customerPhone ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${customerPhone}</p>` : ''}
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Type:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${productType}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Budget:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${budgetRange}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Timeline:</strong></td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${timeline}</td>
      </tr>
    </table>

    <h3>Project Description</h3>
    <p style="background: #fff; border: 1px solid #eee; padding: 15px; border-radius: 8px; white-space: pre-wrap;">${description}</p>

    ${referenceImages.length > 0 ? `
      <h3>Reference Images (${referenceImages.length})</h3>
      <ul style="padding-left: 20px;">
        ${referenceImages.map((url, i) => `<li><a href="${url}">Image ${i + 1}</a></li>`).join('')}
      </ul>
    ` : ''}
    
    <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;" />
    <p style="font-size: 12px; color: #666;">This inquiry was submitted via the Custom Product form.</p>
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
            console.log('Success! Inquiry Email sent.');
            console.log('Subject:', subject);
            console.log('Response:', JSON.stringify(response.data, null, 2));
        }
    } catch (error) {
        console.error('Exception:', error);
    }
}

testInquiryEmail();
