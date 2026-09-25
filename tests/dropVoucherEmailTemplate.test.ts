// tests/dropVoucherEmailTemplate.test.ts
//
// Vitest shape + safety tests for the Trust Circle drop-voucher redemption
// email helper (utils/dropVoucherEmailTemplate.ts). Mirrors the referral
// email template test suite.

import { describe, it, expect } from 'vitest';
import {
    renderDropVoucherEmailHtml,
    DROP_VOUCHER_EMAIL_SUBJECT,
    type DropVoucherRecipient,
} from '../utils/dropVoucherEmailTemplate';

const SITE_BASE = 'https://sgcoalition.xyz';

const baseRecipient: DropVoucherRecipient = {
    email: 'member@example.com',
    displayName: 'Trust Member',
    couponCode: 'DROP-202608-AB12',
    checkoutUrl: 'https://sgcoalition.xyz/checkout',
    profileUrl: 'https://sgcoalition.xyz/#/profile',
};

describe('dropVoucherEmailTemplate', () => {
    it('subject names the 100% off code', () => {
        expect(DROP_VOUCHER_EMAIL_SUBJECT).toBe(
            'Your Trust Circle Drop Code is Here \u2014 100% Off',
        );
    });

    describe('renderDropVoucherEmailHtml', () => {
        const html = renderDropVoucherEmailHtml(baseRecipient, SITE_BASE);

        it('renders the coupon code prominently in the code box', () => {
            expect(html).toContain('DROP-202608-AB12');
            expect(html).toMatch(/<div class="code-text">[^<]*DROP-202608-AB12[^<]*<\/div>/);
        });

        it('renders the redeem + dashboard CTAs', () => {
            expect(html).toContain('Redeem at Checkout');
            expect(html).toContain('Open Dashboard');
            expect(html).toMatch(/href="https:\/\/sgcoalition\.xyz\/checkout" class="button"/);
            expect(html).toMatch(/href="https:\/\/sgcoalition\.xyz\/#\/profile" class="button-outline"/);
        });

        it('mentions one-time use + the checkout code field', () => {
            expect(html).toContain('One-time use');
            expect(html).toContain('Referral / Coupon Code');
        });

        it('brand voice + footer ship unchanged', () => {
            expect(html).toContain('TRUST CIRCLE DROP');
            expect(html).toContain('Stay focused. Trust Yourself.');
            expect(html).toContain('Coalition Access Protocol');
            expect(html).toContain('sgcoalition.xyz');
        });

        it('falls back to email localpart when displayName is blank', () => {
            const plain = renderDropVoucherEmailHtml(
                { ...baseRecipient, displayName: '   ' },
                SITE_BASE,
            );
            // Falls back to the email localpart (before the @).
            expect(plain).toMatch(/Attention: member</);
        });

        it('escapes user-supplied fields (XSS-safe)', () => {
            const evil: DropVoucherRecipient = {
                email: 'evil@example.com',
                displayName: '<script>alert("x")</script>',
                couponCode: '"><img src=x onerror=alert(1)>',
                checkoutUrl: 'https://sgcoalition.xyz/checkout?ref=<>',
                profileUrl: 'https://sgcoalition.xyz/#/profile',
            };
            const evilHtml = renderDropVoucherEmailHtml(evil, SITE_BASE);
            expect(evilHtml).not.toContain('<script>alert("x")</script>');
            expect(evilHtml).not.toContain('<img src=x onerror=alert(1)>');
            expect(evilHtml).toContain('&lt;script&gt;');
            expect(evilHtml).toContain('&lt;img src=x onerror=alert(1)&gt;');
        });

        it('emits a redemption-failure fallback note', () => {
            expect(html).toContain('we\'ll make it right');
        });
    });
});
