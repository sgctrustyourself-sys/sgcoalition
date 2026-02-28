import { Resend } from 'resend';

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY);

interface NotifyMembershipRequest {
    orderId: string;
    userId: string;
    userEmail: string;
    amount: string;
    tier: string;
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
        const body: NotifyMembershipRequest = await request.json();
        const { orderId, userId, userEmail, amount, tier } = body;

        if (!process.env.RESEND_API_KEY) {
            console.error('RESEND_API_KEY is missing');
            return new Response(JSON.stringify({ error: 'Server configuration error' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const subject = `🏆 New VIP Membership Promotion – $${amount} – PayPal #${orderId}`;

        const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6366f1;">${subject}</h2>
        <p>A new user has just upgraded to the Elite Circle.</p>
        
        <div style="background: #f5f3ff; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #ddd6fe;">
          <h3 style="color: #4338ca; margin-top: 0;">Subscription Details</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Tier:</strong> ${tier} Member</li>
            <li><strong>Amount:</strong> $${amount} (USD)</li>
            <li><strong>PayPal ID:</strong> ${orderId}</li>
          </ul>
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <h3 style="color: #334155; margin-top: 0;">User Profile</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Email:</strong> ${userEmail}</li>
            <li><strong>User ID:</strong> ${userId}</li>
          </ul>
        </div>

        <p style="font-size: 14px; color: #64748b; margin-top: 30px;">
          Action Required: Ensure the user's role is updated in the database if not automated, and confirm their monthly store credit is active.
        </p>
      </div>
    `;

        // Send Email to Admin
        const response = await resend.emails.send({
            from: 'SG Coalition <memberships@resend.dev>',
            to: ['sgctrustyourself@gmail.com'],
            subject: subject,
            html: emailHtml,
        });

        if (response.error) {
            console.error('Error sending membership email:', response.error);
            return new Response(JSON.stringify({ error: response.error.message }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Notify Discord via Webhook
        try {
            const discordWebhookUrl = process.env.VITE_DISCORD_BOT_URL || 'http://localhost:5001/webhook/membership';
            await fetch(discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId,
                    tier,
                    amount,
                    userEmail,
                    secret: process.env.WEBHOOK_SECRET
                }),
            });
            console.log('✅ Discord membership notification triggered.');
        } catch (discordError) {
            console.error('Failed to notify Discord:', discordError);
            // Don't fail the whole request if Discord notification fails
        }

        return new Response(JSON.stringify({ success: true, id: response.data?.id }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Error in notify-membership handler:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}
