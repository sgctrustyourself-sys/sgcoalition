// utils/dropVoucherEmailTemplate.ts
//
// Shared template for the Trust Circle "your 100%-off drop code" email.
//
// WHY THIS LIVES HERE: services/emailService.ts > sendDropVoucherEmail posts
// the rendered HTML through /api/send-email (Resend), and the admin
// TrustCircleManager triggers it after issueDropVoucher succeeds. Keeping the
// markup in one pure function mirrors utils/referralEmailTemplate.ts — the
// renderer is testable without I/O and the subject can't drift between the
// service wrapper and tests.

export interface DropVoucherRecipient {
    email: string;
    displayName: string;
    /** The 100%-off coupon code (e.g. DROP-202608-AB12). */
    couponCode: string;
    /** e.g. https://sgcoalition.xyz/checkout */
    checkoutUrl: string;
    /** e.g. https://sgcoalition.xyz/#/profile */
    profileUrl: string;
}

export const DROP_VOUCHER_EMAIL_SUBJECT =
    'Your Trust Circle Drop Code is Here \u2014 100% Off';

// HTML escaper for the limited set of characters that appear in user-supplied
// fields (display name, code). Same contract as the referral template.
const escapeHtml = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

/**
 * Render the full HTML body for the Trust Circle drop-voucher email. Pure: no
 * I/O, no date.now(), no environment lookups. The caller picks the base URL.
 */
export const renderDropVoucherEmailHtml = (
    recipient: DropVoucherRecipient,
    siteBase: string,
): string => {
    const safeName = escapeHtml(
        (recipient.displayName || '').trim() || recipient.email.split('@')[0],
    );
    const safeCode = escapeHtml(recipient.couponCode || '');
    const safeCheckout = escapeHtml(recipient.checkoutUrl || `${siteBase}/checkout`);
    const safeProfile = escapeHtml(recipient.profileUrl || `${siteBase}/#/profile`);

    return (
        `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<style>` +
        `body{margin:0;padding:0;background:#000;font-family:Helvetica,Arial,sans-serif;line-height:1.6;color:#fff;}` +
        `.container{max-width:620px;margin:0 auto;background:#000;}` +
        `.header{background:#0a0a0a;padding:40px 30px;text-align:center;border-bottom:1px solid #1a1a1a;}` +
        `.content{padding:40px 30px;background:#000;}` +
        `.footer{text-align:center;padding:30px;color:#555;font-size:10px;letter-spacing:2px;text-transform:uppercase;border-top:1px solid #1a1a1a;}` +
        `.button{display:inline-block;background:#fff;color:#000;padding:15px 35px;text-decoration:none;border-radius:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin:8px 6px;font-size:13px;font-style:italic;}` +
        `.button-outline{display:inline-block;background:transparent;color:#fff;padding:14px 33px;text-decoration:none;border-radius:8px;font-weight:900;text-transform:uppercase;letter-spacing:1px;margin:8px 6px;font-size:13px;border:1px solid #fff;font-style:italic;}` +
        `.code-box{background:#0a0a0a;border:1px solid #f59e0b;border-radius:8px;padding:24px;margin:30px 0;text-align:center;}` +
        `.code-text{font-family:'Courier New',monospace;font-size:32px;font-weight:900;letter-spacing:4px;color:#fff;}` +
        `.fineprint{font-size:12px;color:#666;line-height:1.7;margin:18px 0 0 0;}` +
        `</style></head>` +
        `<body><div class="container">` +
        `<div class="header">` +
        `<img src="${siteBase}/logo-white.png" alt="Coalition" style="height:30px;margin-bottom:18px;">` +
        `<div style="font-size:10px;letter-spacing:4px;color:#f59e0b;font-weight:900;margin-bottom:8px;">TRUST CIRCLE DROP</div>` +
        `<h1 style="font-family:Helvetica,Arial,sans-serif;font-weight:900;margin:0;letter-spacing:-2px;font-style:italic;font-size:34px;line-height:1;">YOUR CODE IS HERE</h1>` +
        `</div>` +
        `<div class="content">` +
        `<p style="color:#888;text-transform:uppercase;font-weight:bold;font-size:11px;letter-spacing:2px;margin:0 0 6px 0;">Attention: ${safeName}</p>` +
        `<p style="font-size:16px;color:#fff;line-height:1.7;margin:14px 0 0 0;">You're in. As a Trust Circle member, this drop is on us \u2014 one order, zero cost. Enter the code below at checkout and the full amount comes off.</p>` +
        `<div class="code-box">` +
        `<div style="font-size:10px;letter-spacing:3px;color:#f59e0b;font-weight:900;margin-bottom:8px;">YOUR 100% OFF CODE</div>` +
        `<div class="code-text">${safeCode}</div>` +
        `</div>` +
        `<div style="text-align:center;margin:8px 0 36px 0;">` +
        `<a href="${safeCheckout}" class="button">Redeem at Checkout</a>` +
        `<a href="${safeProfile}" class="button-outline">Open Dashboard</a>` +
        `</div>` +
        `<p class="fineprint">One-time use. Enter the code in the "Referral / Coupon Code" field on the checkout page before paying \u2014 the discount applies automatically. If the code ever fails, reply to this email and we'll make it right.</p>` +
        `<p style="color:#666;font-size:14px;line-height:1.8;margin:40px 0 0 0;font-style:italic;">Stay focused. Trust Yourself.</p>` +
        `</div>` +
        `<div class="footer">` +
        `<p>Coalition Access Protocol &bull; Private Secure Cloud</p>` +
        `<p><a href="${siteBase}" style="color:#888;text-decoration:none;">sgcoalition.xyz</a></p>` +
        `</div>` +
        `</div></body></html>`
    );
};
