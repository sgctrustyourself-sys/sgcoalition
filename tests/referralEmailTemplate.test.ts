// tests/referralEmailTemplate.test.ts
//
// Vitest shape + snapshot tests for the Verified-Buyer Referral-Code
// Onboarding email helper.

import { describe, it, expect } from 'vitest';
import {
    renderReferralCodeOnboardingHtml,
    REFERRAL_CODE_EMAIL_SUBJECT,
    commissionTierLabels,
    type ReferralCodeRecipient,
} from '../utils/referralEmailTemplate';
import { COMMISSION_TIERS } from '../utils/referralSystem';

const SITE_BASE = 'https://sgcoalition.xyz';

const baseRecipient: ReferralCodeRecipient = {
    email: 'zambox847@gmail.com',
    displayName: 'Zambo',
    referralCode: 'ZAMBO',
    referralUrl: 'https://sgcoalition.xyz/?ref=ZAMBO',
    currentTier: 1,
    verifiedDate: '2026-07-24',
};

describe('referralEmailTemplate', () => {
    describe('subject + label constants', () => {
        it('subject is what both services and bulk script dispatch', () => {
            expect(REFERRAL_CODE_EMAIL_SUBJECT).toBe(
                'Your Coalition Referral Code is Live \u2014 Earn Commission on Every Drop',
            );
        });

        it('commissionTierLabels has 8 tiers derived from COMMISSION_TIERS', () => {
            expect(COMMISSION_TIERS).toHaveLength(8);
            expect(commissionTierLabels).toHaveLength(8);
            expect(commissionTierLabels[0]).toEqual({ tier: 1, range: '0 referrals', rate: '5%' });
            expect(commissionTierLabels[7]).toEqual({ tier: 8, range: '100+', rate: '40%' });
        });

        it('every tier rate string ends in %', () => {
            for (const label of commissionTierLabels) {
                expect(label.rate.endsWith('%')).toBe(true);
            }
        });

        it('derived labels stay in lockstep with COMMISSION_TIERS rates', () => {
            for (let i = 0; i < COMMISSION_TIERS.length; i++) {
                expect(commissionTierLabels[i].rate).toBe(`${COMMISSION_TIERS[i].rate}%`);
            }
        });
    });

    describe('renderReferralCodeOnboardingHtml', () => {
        const html = renderReferralCodeOnboardingHtml(baseRecipient, SITE_BASE);

        it('renders the recipient code prominently', () => {
            expect(html).toContain('ZAMBO');
            expect(html).toMatch(/<div class="code-text">[^<]*ZAMBO[^<]*<\/div>/);
        });

        it('renders the shareable URL', () => {
            expect(html).toContain('https://sgcoalition.xyz/?ref=ZAMBO');
        });

        it('renders an 8-row tier table', () => {
            const trCount = (html.match(/<tr>/g) || []).length;
            expect(trCount).toBe(9);
        });

        it('highlights the current tier with the YOUR TIER badge', () => {
            const badges = html.match(/YOUR TIER/g) || [];
            expect(badges.length).toBe(1);
            expect(html).toMatch(/padding:14px 16px;background:rgba\(74,222,128,0\.08\)[^"]*"[^>]*>T1/);
        });

        it('highlights a higher-tier recipient without dropping the lower tier badge', () => {
            const t4Html = renderReferralCodeOnboardingHtml(
                { ...baseRecipient, currentTier: 4 },
                SITE_BASE,
            );
            const badges = t4Html.match(/YOUR TIER/g) || [];
            expect(badges.length).toBe(1);
            expect(t4Html).toMatch(/padding:14px 16px;background:rgba\(74,222,128,0\.08\)[^"]*"[^>]*>T4/);
            expect(t4Html).not.toMatch(/padding:14px 16px;background:rgba\(74,222,128,0\.08\)[^"]*"[^>]*>T1/);
        });

        it('clamps out-of-range tiers to the table bounds', () => {
            const tooLow = renderReferralCodeOnboardingHtml(
                { ...baseRecipient, currentTier: 0 },
                SITE_BASE,
            );
            const tooHigh = renderReferralCodeOnboardingHtml(
                { ...baseRecipient, currentTier: 99 },
                SITE_BASE,
            );
            expect(tooLow.match(/YOUR TIER/g)?.length).toBe(1);
            expect(tooLow).toMatch(/padding:14px 16px;background:rgba\(74,222,128,0\.08\)[^"]*"[^>]*>T1/);
            expect(tooHigh).toMatch(/padding:14px 16px;background:rgba\(74,222,128,0\.08\)[^"]*"[^>]*>T8/);
        });

        it('escapes user-supplied fields (XSS-safe)', () => {
            const evil: ReferralCodeRecipient = {
                email: 'evil@example.com',
                displayName: '<script>alert("x")</script>',
                referralCode: '"><img src=x onerror=alert(1)>',
                referralUrl: 'https://example.com/?ref=EVIL&escape=<>',
                currentTier: 2,
            };
            const evilHtml = renderReferralCodeOnboardingHtml(evil, SITE_BASE);
            expect(evilHtml).not.toContain('<script>alert("x")</script>');
            expect(evilHtml).not.toContain('<img src=x onerror=alert(1)>');
            expect(evilHtml).toContain('&lt;script&gt;');
            expect(evilHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
        });

        it('falls back to email localpart when displayName is empty/blank', () => {
            const plain = renderReferralCodeOnboardingHtml(
                { ...baseRecipient, displayName: '   ' },
                SITE_BASE,
            );
            expect(plain).toMatch(/Attention: zambox847</);
        });

        it('emits the verified-since line when an ISO date is supplied', () => {
            const stamp = renderReferralCodeOnboardingHtml(
                { ...baseRecipient, verifiedDate: '2025-12-01' },
                SITE_BASE,
            );
            expect(stamp.toUpperCase()).toContain('VERIFIED SINCE DECEMBER');
        });

        it('emits the fallback tag when verifiedDate is missing', () => {
            const stamp = renderReferralCodeOnboardingHtml(
                { ...baseRecipient, verifiedDate: null },
                SITE_BASE,
            );
            expect(stamp.toUpperCase()).toContain('OFFICIALLY VERIFIED BUYER');
        });

        it('inlines both Share-My-Link and Open-Dashboard CTAs', () => {
            expect(html).toContain('Share My Link');
            expect(html).toContain('Open Dashboard');
            expect(html).toMatch(/href="https:\/\/sgcoalition\.xyz\/\?ref=ZAMBO" class="button"/);
            expect(html).toMatch(/href="https:\/\/sgcoalition\.xyz\/#\/profile" class="button-outline"/);
        });

        it('company footer ships unchanged', () => {
            expect(html).toContain('Coalition Access Protocol');
            expect(html).toContain('Private Secure Cloud');
            expect(html).toContain('sgcoalition.xyz');
        });
    });
});
