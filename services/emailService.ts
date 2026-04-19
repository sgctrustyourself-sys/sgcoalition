/**
 * Email notification service for SGCoin purchase requests
 * Integrated with Resend API
 */

export interface EmailData {
    to: string;
    subject: string;
    html: string;
}

/**
 * Send approval email to customer
 */
export async function sendApprovalEmail(
    email: string,
    amount: number,
    walletAddress: string
): Promise<void> {
    const subject = 'Your SGCoin Purchase Request Approved! 🎉';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .highlight { background: #e0e7ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Request Approved!</h1>
                </div>
                <div class="content">
                    <p>Great news! Your SGCoin purchase request has been approved.</p>
                    
                    <div class="highlight">
                        <strong>Amount:</strong> ${amount.toLocaleString()} SGCoin<br>
                        <strong>Wallet Address:</strong> ${walletAddress}
                    </div>
                    
                    <p>Your SGCoin has been sent to your wallet address. Please allow a few minutes for the transaction to complete on the blockchain.</p>
                    
                    <p>You can verify the transaction in your wallet or on a blockchain explorer.</p>
                    
                    <a href="https://sgcoalition.xyz/#/profile" class="button">View My Profile</a>
                    
                    <p>Thank you for being part of the Coalition!</p>
                </div>
                <div class="footer">
                    <p>SG Coalition | <a href="https://sgcoalition.xyz">sgcoalition.xyz</a></p>
                    <p>This is an automated email. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    await sendEmail({ to: email, subject, html });
}

/**
 * Send rejection email to customer
 */
export async function sendRejectionEmail(
    email: string,
    amount: number,
    reason: string
): Promise<void> {
    const subject = 'Update on Your SGCoin Purchase Request';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .highlight { background: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ef4444; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Purchase Request Update</h1>
                </div>
                <div class="content">
                    <p>We're writing to inform you about your SGCoin purchase request for ${amount.toLocaleString()} SGCoin.</p>
                    
                    <div class="highlight">
                        <strong>Status:</strong> Unable to Process<br><br>
                        <strong>Reason:</strong><br>
                        ${reason}
                    </div>
                    
                    <p>If you believe this was an error or have questions, please contact our support team.</p>
                    
                    <a href="mailto:support@sgcoalition.xyz" class="button">Contact Support</a>
                    
                    <p>You can submit a new request at any time through our website.</p>
                </div>
                <div class="footer">
                    <p>SG Coalition | <a href="https://sgcoalition.xyz">sgcoalition.xyz</a></p>
                    <p>This is an automated email. Please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
    `;

    await sendEmail({ to: email, subject, html });
}

/**
 * Send giveaway entry validation confirmation
 */
export async function sendGiveawayValidationEmail(
    email: string,
    name: string,
    giveawayTitle: string
): Promise<void> {
    const subject = `Confirmed! You're in the Drawing: ${giveawayTitle} 🎉`;

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background: #000; color: #fff; }
                .header { background: #111; padding: 40px; text-align: center; border-bottom: 1px solid #333; }
                .content { padding: 40px; background: #000; }
                .status-box { border: 1px solid rgba(255,255,255,0.1); padding: 25px; border-radius: 12px; margin: 30px 0; background: rgba(255,255,255,0.03); text-align: center; }
                .highlight { color: #fff; font-weight: 800; font-size: 24px; letter-spacing: -0.02em; text-transform: uppercase; }
                .footer { text-align: center; padding: 30px; color: #666; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; }
                .button { display: inline-block; background: #fff; color: #000; padding: 15px 35px; text-decoration: none; border-radius: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 25px 0; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="https://sgcoalition.xyz/logo-white.png" alt="Coalition" style="height: 30px; margin-bottom: 20px;">
                    <h1 style="font-family: 'Helvetica', sans-serif; font-weight: 900; margin: 0; letter-spacing: -2px; font-style: italic;">ACCESS CONFIRMED</h1>
                </div>
                <div class="content">
                    <p style="color: #888; text-transform: uppercase; font-weight: bold; font-size: 12px; letter-spacing: 2px;">Attention: ${name}</p>
                    <p>Your proof of entry has been reviewed and manually verified by the Coalition team. You are officially entered into the drawing for:</p>
                    
                    <div class="status-box">
                        <span class="highlight">${giveawayTitle}</span>
                        <div style="margin-top: 10px; color: #4ade80; font-weight: 900; font-size: 12px; letter-spacing: 4px;">ENTRY STATUS: VERIFIED</div>
                    </div>
                    
                    <p>We're tracking your engagement. The winner will be selected via weighted raffle and announced on the official SGCoalition YouTube channel.</p>
                    
                    <div style="text-align: center;">
                        <a href="https://sgcoalition.xyz/#/ecosystem" class="button">Visit the Ecosystem</a>
                    </div>
                    
                    <p style="color: #666; font-size: 14px; line-height: 1.8;">Stay focused. Trust Yourself.</p>
                </div>
                <div class="footer">
                    <p>Coalition Access Protocol • Private Secure Cloud</p>
                    <p>sgcoalition.xyz</p>
                </div>
            </div>
        </body>
        </html>
    `;

    await sendEmail({ to: email, subject, html });
}

/**
 * Send email using Resend API
 */
async function sendEmail(data: EmailData): Promise<void> {
    const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;

    // If no API key, log to console (development mode)
    if (!RESEND_API_KEY) {
        console.log('📧 Email would be sent (no API key configured):', {
            to: data.to,
            subject: data.subject
        });
        return;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'SG Coalition <noreply@sgcoalition.xyz>',
                to: data.to,
                subject: data.subject,
                html: data.html
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Resend API error:', error);
            throw new Error(`Failed to send email: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Email sent successfully:', result.id);
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
}

/**
 * Send new request notification to admin
 */
export async function sendAdminNotification(
    email: string,
    subject: string,
    message: string
): Promise<void> {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Courier New', monospace; line-height: 1.6; color: #333; background: #f5f5f5; }
                .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                .content { padding: 30px; }
                .message { background: #f9f9f9; padding: 20px; border-radius: 5px; border-left: 4px solid #667eea; white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 13px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>🔔 ${subject}</h2>
                </div>
                <div class="content">
                    <div class="message">${message}</div>
                    <p style="margin-top: 20px;"><a href="https://sgcoalition.xyz/#/admin" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Review in Admin Dashboard</a></p>
                </div>
                <div class="footer">
                    <p>SG Coalition | <a href="https://sgcoalition.xyz">sgcoalition.xyz</a></p>
                </div>
            </div>
        </body>
        </html>
    `;

    // Send to admin email
    const adminEmail = 'sgctrustyourself@gmail.com';
    await sendEmail({ to: adminEmail, subject, html });
}
