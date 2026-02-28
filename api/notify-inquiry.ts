import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface NotifyInquiryRequest {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    productType: string;
    title: string;
    description: string;
    budgetRange: string;
    timeline: string;
    referenceImages: string[];
}

export default async function handler(request: Request) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    try {
        const body: NotifyInquiryRequest = await request.json();
        const {
            customerName,
            customerEmail,
            customerPhone,
            productType,
            title,
            description,
            budgetRange,
            timeline,
            referenceImages
        } = body;

        if (!process.env.RESEND_API_KEY) {
            console.error('RESEND_API_KEY is missing');
            return new Response(JSON.stringify({ error: 'Server configuration error' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Environment Tagging
        const isProd = process.env.VERCEL_ENV === 'production';
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

        const response = await resend.emails.send({
            from: 'SG Coalition <inquiries@resend.dev>',
            to: ['sgctrustyourself@gmail.com'],
            subject: subject,
            replyTo: customerEmail,
            html: emailHtml,
        });

        if (response.error) {
            console.error('Resend API Error:', response.error);
            throw new Error(response.error.message);
        }

        return new Response(JSON.stringify({ success: true, id: response.data?.id }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Error sending inquiry email:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}
