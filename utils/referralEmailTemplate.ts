// utils/referralEmailTemplate.ts
//
// Shared template for the Verified-Buyer Referral-Code Onboarding email.
//
// WHY THIS LIVES HERE (and not inline in services/emailService.ts)
//   services/emailService.ts > sendReferralCodeOnboardingEmail renders the
//   HTML for the running app, while scripts/sendReferralCodeEmails.ts (a
//   node-rescript bulk sender) renders the same HTML for dry-run + Resend
//   dispatch. Keeping both copies inline is a maintenance footgun — a tier
//   rate change in supabase/migrations would drift silently. Both consumers
//   import `renderReferralCodeOnboardingHtml` from here.
//
//   The tier labels are DERIVED from COMMISSION_TIERS (the SQL-mirrored
//   canonical list) so a future tier-rate change ripples into the email
//   automatically. Tests (tests/referralEmailTemplate.test.ts) lock the
//   shape against silent drift.

import { COMMISSION_TIERS } from './referralSystem.js';

export interface ReferralCodeRecipient {
    email: string;
    displayName: string;
    referralCode: string;
    referralUrl: string;
    currentTier: number;
    verifiedDate?: string | null;
}

// Convert one COMMISSION_TIERS row into a presentational label.
// T1 is the standalone "0 referrals" baseline; T2-T7 are "{min}-{max}" ranges
// with an em-dash; T8 collapses maxReferrals=Infinity to "{min}+".
const formatTierRange = (t: typeof COMMISSION_TIERS[number]): string => {
    if (t.tier === 1) return '0 referrals';
    if (t.maxReferrals === Infinity) return `${t.minReferrals}+`;
    return `${t.minReferrals}\u2013${t.maxReferrals}`;
};

export interface CommissionTierLabel {
    tier: number;
    range: string;
    rate: string;
}

export const commissionTierLabels: CommissionTierLabel[] = COMMISSION_TIERS.map((t) => ({
    tier: t.tier,
    range: formatTierRange(t),
    rate: `${t.rate}%`,
}));

// Subjects used by every caller of this template. Kept in one place so the
// subject never drifts between the live flow and the bulk script.
export const REFERRAL_CODE_EMAIL_SUBJECT =
    'Your Coalition Referral Code is Live \u2014 Earn Commission on Every Drop';

// HTML escaper for the limited set of characters that appear in user-supplied
// fields (display name, email localpart, code). Cheap and sufficient for the
// email context; do NOT reuse for arbitrary HTML.
const escapeHtml = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return 'Officially Verified Buyer';
    try {
        // Pin to UTC: a date-only string like "2025-12-01" parses
        // as UTC midnight and shifts to the previous day when
        // rendered in any TZ west of UTC. Verified-since is a
        // calendar moment, so we always render the date the
        // operator typed. Same fix for tests (Node default TZ).
        return `Verified since ${new Date(iso).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
        })}`;
    } catch {
        return 'Officially Verified Buyer';
    }
};

const buildTierTableRows = (currentTier: number): string => {
    const safeTier = Math.min(Math.max(Math.floor(Number(currentTier) || 1), 1), commissionTierLabels.length);
    return commissionTierLabels
        .map((row) => {
            const isCurrent = row.tier === safeTier;
            const badge = isCurrent
                ? '<span style="background:#4ade80;color:#000;font-size:9px;font-weight:900;letter-spacing:2px;padding:3px 8px;border-radius:3px;margin-left:8px;">YOUR TIER</span>'
                : '';
            const rowBg = isCurrent ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.02)';
            const borderLeft = isCurrent
                ? 'border-left:2px solid #4ade80;'
                : 'border-left:2px solid transparent;';
            return (
                '<tr>' +
                `<td style="padding:14px 16px;background:${rowBg};${borderLeft}font-family:'Courier New',monospace;font-size:13px;color:#fff;width:60px;">` +
                `T${row.tier}${badge}</td>` +
                `<td style="padding:14px 16px;background:${rowBg};font-family:'Courier New',monospace;font-size:13px;color:#888;width:140px;">${row.range}</td>` +
                `<td style="padding:14px 16px;background:${rowBg};font-family:Helvetica,sans-serif;font-size:14px;font-weight:900;color:#fff;letter-spacing:-0.5px;">${row.rate}</td>` +
                '</tr>'
            );
        })
        .join('');
};

/**
 * Render the full HTML body for the Verified-Buyer Referral-Code Onboarding
 * email. Pure: no I/O, no date.now(), no environment lookups. The caller is
 * responsible for choosing the site base URL.
 *
 * Visual reference: docs/preview-referral-code-email.html
 */
export const renderReferralCodeOnboardingHtml = (
    recipient: ReferralCodeRecipient,
    siteBase: string,
): string => {
    const safeName = escapeHtml(
        (recipient.displayName || '').trim() || recipient.email.split('@')[0],
    );
    const safeCode = escapeHtml(recipient.referralCode || '');
    const safeUrl = escapeHtml(recipient.referralUrl || `${siteBase}/?ref=${encodeURIComponent(recipient.referralCode || '')}`);
    const verifiedLine = escapeHtml(formatDate(recipient.verifiedDate));
    const tierTableRows = buildTierTableRows(recipient.currentTier);

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
        `.code-box{background:#0a0a0a;border:1px solid #4ade80;border-radius:8px;padding:24px;margin:30px 0;text-align:center;}` +
        `.code-text{font-family:'Courier New',monospace;font-size:32px;font-weight:900;letter-spacing:4px;color:#fff;}` +
        `.url-text{font-family:'Courier New',monospace;font-size:12px;color:#888;word-break:break-all;margin-top:10px;}` +
        `.tier-table{width:100%;border-collapse:collapse;margin:30px 0;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;}` +
        `.tier-table th{background:#111;padding:14px 16px;text-align:left;font-family:Helvetica,sans-serif;font-size:10px;font-weight:900;letter-spacing:2px;color:#888;text-transform:uppercase;}` +
        `.benefit{display:flex;align-items:flex-start;gap:14px;margin:18px 0;}` +
        `.benefit-icon{font-family:'Courier New',monospace;font-size:14px;color:#4ade80;font-weight:900;flex-shrink:0;width:24px;}` +
        `.benefit-text{font-size:14px;color:#ccc;line-height:1.6;}` +
        `.benefit-strong{color:#fff;font-weight:800;}` +
        `</style></head>` +
        `<body><div class="container">` +
        `<div class="header">` +
        `<img src="${siteBase}/logo-white.png" alt="Coalition" style="height:30px;margin-bottom:18px;">` +
        `<div style="font-size:10px;letter-spacing:4px;color:#4ade80;font-weight:900;margin-bottom:8px;">${verifiedLine.toUpperCase()}</div>` +
        `<h1 style="font-family:Helvetica,Arial,sans-serif;font-weight:900;margin:0;letter-spacing:-2px;font-style:italic;font-size:34px;line-height:1;">REFERRAL CODE LIVE</h1>` +
        `</div>` +
        `<div class="content">` +
        `<p style="color:#888;text-transform:uppercase;font-weight:bold;font-size:11px;letter-spacing:2px;margin:0 0 6px 0;">Attention: ${safeName}</p>` +
        `<p style="font-size:16px;color:#fff;line-height:1.7;margin:14px 0 0 0;">You're verified. Your personal Coalition referral code is live. From this moment on, every drop someone buys through your link pads your commission rate and feeds the network you helped grow.</p>` +
        `<div class="code-box">` +
        `<div style="font-size:10px;letter-spacing:3px;color:#4ade80;font-weight:900;margin-bottom:8px;">YOUR REFERRAL CODE</div>` +
        `<div class="code-text">${safeCode}</div>` +
        `<div class="url-text">${safeUrl}</div>` +
        `</div>` +
        `<div style="text-align:center;margin:8px 0 36px 0;">` +
        `<a href="${safeUrl}" class="button">Share My Link</a>` +
        `<a href="${siteBase}/#/profile" class="button-outline">Open Dashboard</a>` +
        `</div>` +
        `<div style="font-size:10px;letter-spacing:3px;color:#888;font-weight:900;margin:36px 0 12px 0;">COMMISSION STRUCTURE &middot; 8-TIER PROGRESSION</div>` +
        `<table class="tier-table" cellpadding="0" cellspacing="0">` +
        `<thead><tr><th>Tier</th><th>Referrals</th><th>Commission</th></tr></thead>` +
        `<tbody>${tierTableRows}</tbody></table>` +
        `<p style="font-size:12px;color:#666;margin:12px 0 0 0;line-height:1.7;">Your FIRST successful referral immediately bumps you from T1 (5%) to T2 (10%). After that, every referrer-side purchase compounds your rate toward the T8 ceiling at 40%.</p>` +
        `<div style="font-size:10px;letter-spacing:3px;color:#888;font-weight:900;margin:40px 0 16px 0;">WHAT YOUR CODE UNLOCKS</div>` +
        `<div class="benefit"><div class="benefit-icon">[+]</div><div class="benefit-text"><span class="benefit-strong">Verified Buyer badge</span> on your Coalition profile.</div></div>` +
        `<div class="benefit"><div class="benefit-icon">[+]</div><div class="benefit-text"><span class="benefit-strong">5%&ndash;40% commission</span> on every paid order attributed to your link &mdash; store-credit straight to your Coalition account, payable on request.</div></div>` +
        `<div class="benefit"><div class="benefit-icon">[+]</div><div class="benefit-text"><span class="benefit-strong">24-hour early access</span> to wallet drops, limited pieces, and restocks before public release.</div></div>` +
        `<div class="benefit"><div class="benefit-icon">[+]</div><div class="benefit-text"><span class="benefit-strong">Exclusive Coalition Drops</span> reserved for verified culture carriers &mdash; seasonal capsules and 1/1s that never reach the main storefront.</div></div>` +
        `<div class="benefit"><div class="benefit-icon">[+]</div><div class="benefit-text"><span class="benefit-strong">Direct line</span> to the Coalition team at <a href="mailto:sgctrustyourself@gmail.com" style="color:#4ade80;text-decoration:none;">sgctrustyourself@gmail.com</a> with your purchase or referral questions, plus Discord access on request.</div></div>` +
        `<div class="benefit"><div class="benefit-icon">[+]</div><div class="benefit-text"><span class="benefit-strong">Lifetime stats</span> &mdash; successful referrals, total earnings, current tier, and the leaderboard &mdash; all on your <a href="${siteBase}/#/profile" style="color:#4ade80;text-decoration:none;">profile dashboard</a>.</div></div>` +
        `<div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:8px;padding:24px;margin:36px 0 0 0;">` +
        `<div style="font-size:10px;letter-spacing:3px;color:#4ade80;font-weight:900;margin-bottom:10px;">ONE LAST THING</div>` +
        `<p style="font-size:14px;color:#ccc;margin:0;line-height:1.7;">Your code is permanent and <span style="color:#fff;font-weight:800;">never expires</span>. Share the link in your Instagram bio, story reposts, Discord DMs, or anywhere your audience lives &mdash; every paid order that lands through it compounds your tier.</p>` +
        `</div>` +
        `<p style="color:#666;font-size:14px;line-height:1.8;margin:40px 0 0 0;font-style:italic;">Stay focused. Trust Yourself.</p>` +
        `</div>` +
        `<div class="footer">` +
        `<p>Coalition Access Protocol &bull; Private Secure Cloud</p>` +
        `<p><a href="${siteBase}" style="color:#888;text-decoration:none;">sgcoalition.xyz</a></p>` +
        `</div>` +
        `</div></body></html>`
    );
};
