import { describe, expect, it } from 'vitest';
import {
    VERIFIED_CUSTOMER_SOURCES,
    filterVerifiedCustomers,
    isTestCampaignName,
    isVerifiedCustomerSource,
} from '../utils/marketingAudience';

describe('marketingAudience helper - verified-customer guard', () => {
    describe('VERIFIED_CUSTOMER_SOURCES', () => {
        it('lists manual_seed and past_customer as the only verified-customer sources', () => {
            expect(VERIFIED_CUSTOMER_SOURCES).toEqual(['manual_seed', 'past_customer']);
        });
    });

    describe('isVerifiedCustomerSource', () => {
        it('returns true for manual_seed and past_customer', () => {
            expect(isVerifiedCustomerSource('manual_seed')).toBe(true);
            expect(isVerifiedCustomerSource('past_customer')).toBe(true);
        });

        it('returns false for non-verified sources (form leads + marketing_contacts)', () => {
            expect(isVerifiedCustomerSource('sms_signup')).toBe(false);
            expect(isVerifiedCustomerSource('sms_signup_email')).toBe(false);
            expect(isVerifiedCustomerSource('drop_list')).toBe(false);
            expect(isVerifiedCustomerSource('marketing_contacts')).toBe(false);
        });

        it('returns false for null / undefined / non-string input rather than throwing', () => {
            expect(isVerifiedCustomerSource(null)).toBe(false);
            expect(isVerifiedCustomerSource(undefined)).toBe(false);
            expect(isVerifiedCustomerSource(42 as unknown as string)).toBe(false);
        });
    });

    describe('isTestCampaignName', () => {
        it('returns true when the name contains "test" (case-insensitive)', () => {
            expect(isTestCampaignName('Test Drop')).toBe(true);
            expect(isTestCampaignName('test blast')).toBe(true);
            expect(isTestCampaignName('E2E TEST notification')).toBe(true);
        });

        it('returns true for words that genuinely contain "test" as a substring', () => {
            // Documented edge cases - substring match is intentional (the
            // operator should rename anything that even glances at "test").
            // These words all contain the literal four-char sequence t-e-s-t:
            //   latest    = l-a-[t-e-s-t]
            //   contest   = c-o-n-[t-e-s-t]
            //   attest    = a-[t-t-e-s-t]   (positions 2-5 = t-e-s-t)
            //   detest    = [d-e-t-e-s-t]   (positions 1-4 = t-e-s-t)
            //   protest   = p-r-o-[t-e-s-t]
            //   testament = [t-e-s-t]-a-m-e-n-t
            expect(isTestCampaignName('latest gear')).toBe(true);
            expect(isTestCampaignName('contest winner')).toBe(true);
            expect(isTestCampaignName('attest back')).toBe(true);
            expect(isTestCampaignName('detest Monday')).toBe(true);
            expect(isTestCampaignName('protest signs')).toBe(true);
            expect(isTestCampaignName('testament deliverable')).toBe(true);
        });

        it('returns false for words that LOOK like they contain "test" but actually do not', () => {
            // Trap words: 'invest' / 'rest' / 'fest' have led the substring
            // search to e-s-t at the end, but the second 't' that follows to
            // complete the t-e-s-t sequence is missing. Lock the negative
            // case so a future "make this whole-word" refactor cannot
            // silently drift which campaigns get filtered.
            expect(isTestCampaignName('restock alert')).toBe(false);
            expect(isTestCampaignName('festive drop')).toBe(false);
            expect(isTestCampaignName('investor briefing')).toBe(false);
        });

        it('returns false when the name does not contain "test"', () => {
            expect(isTestCampaignName('Spring Drop')).toBe(false);
            expect(isTestCampaignName('Memorial Day')).toBe(false);
            expect(isTestCampaignName('Coalition newsletter')).toBe(false);
            expect(isTestCampaignName('Coalition Drop 2026')).toBe(false);
        });

        it('returns false for empty string and non-string input', () => {
            expect(isTestCampaignName('')).toBe(false);
            expect(isTestCampaignName(null as unknown as string)).toBe(false);
            expect(isTestCampaignName(undefined as unknown as string)).toBe(false);
        });
    });

    describe('filterVerifiedCustomers', () => {
        const mkRow = (source: string, label = '${source}-row') => ({ source, label });

        it('returns the rows unchanged when excludeVerified is false', () => {
            const rows = [mkRow('manual_seed'), mkRow('past_customer'), mkRow('sms_signup')];
            const out = filterVerifiedCustomers(rows, { excludeVerified: false });
            expect(out.rows).toEqual(rows);
            expect(out.excluded).toBe(0);
        });

        it('drops manual_seed + past_customer when excludeVerified is true', () => {
            const manual = mkRow('manual_seed', 'verified-1');
            const past = mkRow('past_customer', 'verified-2');
            const sms = mkRow('sms_signup', 'lead-1');
            const drop = mkRow('drop_list', 'lead-2');
            const out = filterVerifiedCustomers([manual, past, sms, drop], { excludeVerified: true });
            expect(out.rows).toEqual([sms, drop]);
            expect(out.excluded).toBe(2);
        });

        it('preserves form-lead sources untouched when excludeVerified is true', () => {
            const leads = [
                mkRow('sms_signup', 'lead-1'),
                mkRow('sms_signup_email', 'lead-2'),
                mkRow('drop_list', 'lead-3'),
                mkRow('marketing_contacts', 'lead-4'),
            ];
            const out = filterVerifiedCustomers(leads, { excludeVerified: true });
            expect(out.rows).toEqual(leads);
            expect(out.excluded).toBe(0);
        });

        it('defaults to no-op when options is omitted', () => {
            const rows = [mkRow('manual_seed'), mkRow('sms_signup')];
            const out = filterVerifiedCustomers(rows);
            expect(out.rows).toEqual(rows);
            expect(out.excluded).toBe(0);
        });

        it('preserves the input order of the kept lead rows', () => {
            const rows = [
                mkRow('sms_signup', 'a'),
                mkRow('manual_seed', 'skip-1'),
                mkRow('drop_list', 'b'),
                mkRow('past_customer', 'skip-2'),
                mkRow('sms_signup_email', 'c'),
            ];
            const out = filterVerifiedCustomers(rows, { excludeVerified: true });
            expect(out.rows.map((r) => r.label)).toEqual(['a', 'b', 'c']);
            expect(out.excluded).toBe(2);
        });

        it('returns an empty result for an empty input array (no throw, excluded=0)', () => {
            const out = filterVerifiedCustomers([], { excludeVerified: true });
            expect(out.rows).toEqual([]);
            expect(out.excluded).toBe(0);
        });
    });
});
