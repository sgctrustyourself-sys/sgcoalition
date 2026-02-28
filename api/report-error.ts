import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: any, res: any) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

    const { error, context, metadata } = req.body;

    try {
        if (!process.env.RESEND_API_KEY) {
            throw new Error('RESEND_API_KEY is missing');
        }

        const emailHtml = `
            <div style="font-family: sans-serif; background: #fffcf0; padding: 25px; border-radius: 8px; border: 1px solid #f59e0b;">
                <h2 style="color: #92400e; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">⚠️ Transaction Error Report</h2>
                <p><strong>Context:</strong> ${context || 'General Transaction Failure'}</p>
                <p><strong>Error Detail:</strong> ${error || 'Unknown Error'}</p>
                <hr style="border: none; border-top: 1px solid #fef3c7; margin: 20px 0;" />
                <h3>Metadata</h3>
                <pre style="background: #fdf6b2; padding: 15px; border-radius: 4px; font-size: 12px; overflow-x: auto;">
${JSON.stringify(metadata, null, 2)}
                </pre>
                <p style="font-size: 11px; color: #b45309; margin-top: 20px;">Reported automatically by Coalition Checkout System.</p>
            </div>
        `;

        await resend.emails.send({
            from: 'Alert System <alerts@resend.dev>',
            to: ['sgctrustyourself@gmail.com'],
            subject: `⚠️ ${context || 'Checkout Error'} Alert`,
            html: emailHtml,
        });

        res.status(200).json({ success: true });
    } catch (err: any) {
        console.error('❌ Failed to report error:', err);
        res.status(500).json({ error: err.message });
    }
}
