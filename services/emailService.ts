/**
 * Email notification service for SGCoin purchase requests
 * Integrated with Resend API
 */

export interface EmailData {
    to: string;
    subject: string;
    html: string;
}
import { renderReferralCodeOnboardingHtml, REFERRAL_CODE_EMAIL_SUBJECT } from '../utils/referralEmailTemplate';

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
                    
                    <a href="mailto:sgctrustyourself@gmail.com" class="button">Contact Support</a>
                    
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
 * Send email via secure server-side API route (RESEND_API_KEY never exposed to frontend)
 */
async function sendEmail(data: EmailData): Promise<void> {
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: data.to,
                subject: data.subject,
                html: data.html
            })
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Send email API error:', error);
            throw new Error(`Failed to send email: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Email sent successfully:', result.data?.id);
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

/**
 * Send admin notification when a customer submits a new SGCOIN payout request.
 * Routed to the admin email so the review queue gets a heads-up.
 */
export async function sendAdminPayoutNotification(
    email: string,
    amount: number,
    walletAddress: string,
    requestId: string
): Promise<void> {
    const subject = `New SGCOIN Payout Request: ${amount.toLocaleString()} SGC`;
    const message = `
New SGCOIN payout request received.

Amount Requested: ${amount.toLocaleString()} SGCoin
Polygon Wallet:    ${walletAddress}
Customer Email:   ${email}
Request ID:       ${requestId}

Action required: review the queue, then Approve (decrements balance) or Reject (with reason).
    `.trim();
    await sendAdminNotification(email, subject, message);
}

/**
 * Send approval email to customer (Pending -> Approved).
 * Balance has been decremented at this point.
 */
export async function sendPayoutApprovedEmail(
    email: string,
    amount: number,
    walletAddress: string
): Promise<void> {
    const subject = 'Your SGCOIN Payout Request Has Been Approved';
    const html = `
        <!DOCTYPE html>
        <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1>SGCOIN Payout Approved</h1>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p>Your SGCOIN payout request has been reviewed and approved.</p>
                    <div style="background: #e0e7ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <strong>Amount:</strong> ${amount.toLocaleString()} SGCoin<br>
                        <strong>Wallet Address:</strong> ${walletAddress}
                    </div>
                    <p>${amount.toLocaleString()} SGCoin has been deducted from your store-credit balance and is queued for on-chain transfer to your Polygon wallet. You will receive a follow-up email once the transaction is confirmed on-chain.</p>
                    <p>The transaction typically completes within 24 hours.</p>
                    <a href="https://sgcoalition.xyz/#/profile" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0;">View My Profile</a>
                </div>
                <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
                    <p>SG Coalition | <a href="https://sgcoalition.xyz">sgcoalition.xyz</a></p>
                </div>
            </div>
        </body></html>
    `;
    await sendEmail({ to: email, subject, html });
}

/**
 * Send completed email (Approved -> Completed with on-chain tx hash).
 */
export async function sendPayoutCompletedEmail(
    email: string,
    amount: number,
    txHash: string
): Promise<void> {
    const subject = 'Your SGCOIN Has Been Sent';
    const polkascan = `https://polkascan.io/polygon-erc20/transaction/${txHash}`;
    const html = `
        <!DOCTYPE html>
        <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1>SGCOIN Sent</h1>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p>${amount.toLocaleString()} SGCoin has been sent to your wallet. The on-chain transaction is complete.</p>
                    <div style="background: #d1fae5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <strong>Amount:</strong> ${amount.toLocaleString()} SGCoin<br>
                        <strong>Transaction Hash:</strong> <code style="word-break: break-all;">${txHash}</code>
                    </div>
                    <p>Verify on a Polygon block explorer:</p>
                    <a href="${polkascan}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0;">View on Block Explorer</a>
                    <p>Thank you for being part of the Coalition.</p>
                </div>
                <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
                    <p>SG Coalition | <a href="https://sgcoalition.xyz">sgcoalition.xyz</a></p>
                </div>
            </div>
        </body></html>
    `;
    await sendEmail({ to: email, subject, html });
}

/**
 * Send a single referral-code onboarding email to a verified user.
 *
 * Lives in services/emailService.ts because the Resend API key is held
 * server-side at /api/send-email. The HTML body itself is rendered by
 * `renderReferralCodeOnboardingHtml` in utils/referralEmailTemplate.ts
 * so the same template is shared with `scripts/sendReferralCodeEmails.ts`
 * (the bulk-send dry-run routine) and the snapshot test.
 */
export async function sendReferralCodeOnboardingEmail(
    email: string,
    displayName: string | null,
    referralCode: string,
    referralUrl: string,
    currentTier: number = 1,
    verifiedDate: string | null = null,
): Promise<void> {
    const html = renderReferralCodeOnboardingHtml(
        {
            email,
            displayName: (displayName || "").trim(),
            referralCode,
            referralUrl,
            currentTier,
            verifiedDate,
        },
        "https://sgcoalition.xyz",
    );

    await sendEmail({
        to: email,
        subject: REFERRAL_CODE_EMAIL_SUBJECT,
        html,
    });
}

/**
 * Send rejection email (Pending or Approved -> Rejected). If approved and
 * then rejected, the customer's balance has been refunded; for Pending
 * rejections no balance change is needed since nothing was deducted.
 */
export async function sendPayoutRejectedEmail(
    email: string,
    amount: number,
    reason: string,
    wasRefunded: boolean
): Promise<void> {
    const subject = 'Update on Your SGCOIN Payout Request';
    const refundNote = wasRefunded
        ? `<p style="color: #059669;"><strong>${amount.toLocaleString()} SGCoin has been refunded to your store-credit balance.</strong></p>`
        : `<p>Your store-credit balance was not affected since the request was still under review when it was rejected.</p>`;
    const html = `
        <!DOCTYPE html>
        <html><body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1>Payout Request Update</h1>
                </div>
                <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                    <p>We were unable to complete your SGCOIN payout request of ${amount.toLocaleString()} SGCoin.</p>
                    <div style="background: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ef4444;">
                        <strong>Reason:</strong><br>${reason}
                    </div>
                    ${refundNote}
                    <p>You can submit a new request at any time. If you have questions, contact support.</p>
                    <a href="mailto:sgctrustyourself@gmail.com" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Contact Support</a>
                </div>
                <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
                    <p>SG Coalition | <a href="https://sgcoalition.xyz">sgcoalition.xyz</a></p>
                </div>
            </div>
        </body></html>
    `;
    await sendEmail({ to: email, subject, html });
}
