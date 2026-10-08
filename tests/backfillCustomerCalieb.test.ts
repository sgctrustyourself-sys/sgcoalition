// tests/backfillCustomerCalieb.test.ts
//
// Vitest lock for scripts/backfillCustomerCalieb.ts.
// Pattern: vi.mock + setOutcomes queue mirroring tests/referralFlows.test.ts.
// Capture contract: captureStdout helper captures console.log + console.error
// AND preserves throws with a "THREW:" prefix so FAIL-path tests can assert
// on the emitted magic token *and* the underlying Supabase error in one regex.
// Earlier draft used inline try/catch that silently swallowed throws and
// hid Supabase error context from the test log.
//
// SMS-table mock contract:
//
//   - marketing_contacts: write path is .upsert() (no auto-RETURN shape),
//     delete path is .delete().eq('phone_e164', CALIEB_PHONE_E164). The
//     runConfirm rollback branch calls this DELETE; the mock needs to
//     resolve the call to avoid hanging. There is no .select() chain here —
//     the script does not read marketing_contacts.
//
//   - profile FAIL test asserts both PROFILE_WRITE_RESULT FAIL AND
//     MARKETING_ROLLBACK OK (because the rollback's DELETE fires after the
//     profile write errors out).
//
//   - marketing FAIL test asserts MARKETING_WRITE_RESULT FAIL AND that the
//     profile update path is NOT entered (no PROFILE_WRITE_RESULT logs).

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockOutcomes {
    socialSelect: { data: any; error: any };
    ordersSelect: { data: any; error: any };
    profileSelect: { data: any; error: any };
    socialInsert: { data: any; error: any };
    profileUpdate: { data: any; error: any };
    marketingUpsert: { data: any; error: any };
    marketingDelete: { data: any; error: any };
}

const defaultOutcomes: MockOutcomes = {
    socialSelect: { data: { id: 'soc-1', user_id: 'user-calieb', verified: false, platform: 'instagram', username: '1il.caleb', linked_at: '2026-01-01T00:00:00Z' }, error: null },
    ordersSelect: {
        data: [
            { id: 'order-1', order_number: 'ORD-CALIEB-001', status: 'paid', total: 175, created_at: '2026-01-01T00:00:00Z', customer_email: 'calieb@example.com', customer_name: 'Calieb Customer', items: [{ product_id: 'prod_wallet_chrome_hearts', productId: 'prod_wallet_chrome_hearts', name: 'Coalition x Chrome Hearts Wallet' }] },
            { id: 'order-2', order_number: 'ORD-CALIEB-002', status: 'paid', total: 85, created_at: '2026-02-01T00:00:00Z', customer_email: 'calieb@example.com', customer_name: 'Calieb Customer', items: [{ product_id: 'Coalition_Above_As_Below_Wallet_1_1', productId: 'Coalition_Above_As_Below_Wallet_1_1', name: 'Above As Below Wallet 1/1' }] },
        ],
        error: null,
    },
    profileSelect: { data: { id: 'user-calieb', email: 'calieb@example.com', display_name: 'calieb', lifetime_spend_usd: 0, lifetime_orders: 0, customer_notes: null }, error: null },
    socialInsert: { data: { id: 'soc-1' }, error: null },
    profileUpdate: { data: { id: 'user-calieb' }, error: null },
    marketingUpsert: { data: { id: 'mc-calieb' }, error: null },
    marketingDelete: { data: [{ id: 'mc-calieb' }], error: null },
};

let outcomes: MockOutcomes = JSON.parse(JSON.stringify(defaultOutcomes));

vi.mock('dotenv', () => ({ default: { config: () => undefined }, config: () => undefined }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: (table: string) => buildTableMock(table) }),
}));

function buildTableMock(table: string): any {
    if (table === 'social_accounts') {
        return {
            select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(outcomes.socialSelect) }) }) }),
            insert: () => Promise.resolve({ data: outcomes.socialInsert.data, error: outcomes.socialInsert.error }),
        };
    }
    if (table === 'orders') {
        return { select: () => ({ or: () => ({ order: () => Promise.resolve(outcomes.ordersSelect) }) }) };
    }
    if (table === 'profiles') {
        return {
            select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve(outcomes.profileSelect) }) }),
            update: () => ({ eq: () => Promise.resolve({ data: outcomes.profileUpdate.data, error: outcomes.profileUpdate.error }) }),
        };
    }
    if (table === 'marketing_contacts') {
        // The script writes via .upsert(payload, { onConflict: 'phone_e164' })
        // and, on profile-fail rollback, via .delete().eq('phone_e164', ...).
        // There is no read path in runConfirm (reads happen in marketing-subscribe.ts).
        return {
            upsert: () => Promise.resolve({ data: outcomes.marketingUpsert.data, error: outcomes.marketingUpsert.error }),
            delete: () => ({ eq: () => Promise.resolve({ data: outcomes.marketingDelete.data, error: outcomes.marketingDelete.error }) }),
        };
    }
    return {};
}

import {
    BACKFILL_NOTES_TAG,
    CALIEB_COUNTRY_CODE,
    CALIEB_PHONE_E164,
    CALIEB_SMS_CHANNEL,
    CALIEB_SMS_SOURCE,
    CALIEB_SMS_TAG,
    CaliebDiscovery,
    discoverCalieb,
    INSTAGRAM_HANDLE,
    NOT_FOUND_TOKEN,
    printDiscovery,
    runConfirm,
} from '../scripts/backfillCustomerCalieb';

function captureStdout(fn: () => Promise<void> | void): Promise<string> {
    return new Promise(async (resolve) => {
        const captured: string[] = [];
        const origLog = console.log;
        const origErr = console.error;
        console.log = (...args: any[]) => captured.push(args.join(' '));
        console.error = (...args: any[]) => captured.push(args.join(' '));
        try {
            await fn();
        } catch (e) {
            captured.push('THREW: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            console.log = origLog;
            console.error = origErr;
            resolve(captured.join('\n'));
        }
    });
}

function defaultDiscovery(): Promise<CaliebDiscovery> {
    return discoverCalieb();
}

describe('backfillCustomerCalieb', () => {
    beforeEach(() => {
        outcomes = JSON.parse(JSON.stringify(defaultOutcomes));
    });

    it('exports the stable magic-token constants', () => {
        expect(INSTAGRAM_HANDLE).toBe('1il.caleb');
        expect(BACKFILL_NOTES_TAG).toBe('@sgcoalition-backfill-2026-07-16');
        expect(NOT_FOUND_TOKEN).toBe('__CALIEB_NOT_FOUND__');
        expect(CALIEB_PHONE_E164).toBe('+14433775592');
        expect(CALIEB_COUNTRY_CODE).toBe('+1');
        expect(CALIEB_SMS_TAG).toBe('@sgcoalition-calieb-sms-2026-07-16');
        expect(CALIEB_SMS_CHANNEL).toBe('sms');
        expect(CALIEB_SMS_SOURCE).toBe('manual_seed');
    });

    it('discoverCalieb aggregates paid orders + wallet purchases', async () => {
        const r = await defaultDiscovery();
        expect(r.socialLink).toBeTruthy();
        expect(r.socialLink.username).toBe('1il.caleb');
        expect(r.profile).toBeTruthy();
        expect(r.matchingOrders.length).toBe(2);
        expect(r.lifetimeSpendUsd).toBe(175 + 85);
        expect(r.lifetimeOrdersCount).toBe(2);
        expect(r.walletPurchases.length).toBeGreaterThan(0);
        expect(r.walletPurchases.some((w: any) => w.product_id === 'prod_wallet_chrome_hearts')).toBe(true);
        expect(r.walletPurchases.some((w: any) => w.product_id === 'Coalition_Above_As_Below_Wallet_1_1')).toBe(true);
    });

    it('printDiscovery emits SOCIAL_FOUND + PROFILE_FOUND when both present', async () => {
        const d = await defaultDiscovery();
        const stdout = await captureStdout(() => printDiscovery(d));
        expect(stdout).toContain('SOCIAL_FOUND');
        expect(stdout).toContain('PROFILE_FOUND');
        expect(stdout).toContain('lifetime_spend_usd');
        expect(stdout).not.toContain(NOT_FOUND_TOKEN);
    });

    it('printDiscovery emits NOT_FOUND_TOKEN when social missing', async () => {
        outcomes.socialSelect = { data: null, error: { code: 'PGRST116' } };
        const d = await defaultDiscovery();
        const stdout = await captureStdout(() => printDiscovery(d));
        expect(stdout).toContain(NOT_FOUND_TOKEN);
        expect(stdout).toContain('social');
    });

    it('runConfirm fresh-state path: NOOP_SOCIAL + NOOP_MARKETING + NOOP_PROFILE + BACKFILL_NOTES_TAG applied', async () => {
        outcomes.socialSelect = { data: null, error: { code: 'PGRST116' } };
        outcomes.profileSelect = { data: null, error: { code: 'PGRST116' } };
        const d: CaliebDiscovery = await defaultDiscovery();
        // social_missing → resolvedUserId = null → all three write paths
        // hit their NOOP branches. BACKFILL_NOTES_TAG log line still
        // prints because it sits outside the conditional write blocks.
        const stdout = await captureStdout(() => runConfirm(d));
        expect(stdout).toContain('INTENDED_INSERT');
        expect(stdout).toContain('INTENDED_NOOP_SOCIAL');
        expect(stdout).toContain('INTENDED_NOOP_MARKETING');
        expect(stdout).toContain('INTENDED_NOOP_PROFILE');
        expect(stdout).toContain('BACKFILL_NOTES_TAG applied');
        expect(stdout).not.toContain('THREW:');
    });

    it('runConfirm current-state path: NOOP_SOCIAL + MARKETING_WRITE_RESULT OK + INTENDED_UPDATE + PROFILE_WRITE_RESULT OK', async () => {
        outcomes.profileSelect = { data: { id: 'user-calieb', email: 'calieb@example.com', display_name: 'calieb', lifetime_spend_usd: 260, lifetime_orders: 2, customer_notes: 'existing ' + BACKFILL_NOTES_TAG }, error: null };
        const d: CaliebDiscovery = await defaultDiscovery();
        const stdout = await captureStdout(() => runConfirm(d));
        expect(stdout).toContain('INTENDED_NOOP_SOCIAL');
        expect(stdout).toContain('INTENDED_MARKETING_UPSERT');
        expect(stdout).toContain('MARKETING_WRITE_RESULT OK');
        expect(stdout).toContain('INTENDED_UPDATE');
        expect(stdout).toContain('customer_phone=' + CALIEB_PHONE_E164);
        expect(stdout).toContain('PROFILE_WRITE_RESULT OK');
        expect(stdout).toContain('BACKFILL_NOTES_TAG applied');
        expect(stdout).not.toContain('THREW:');
    });

    it('runConfirm FAIL-path: PROFILE_WRITE_RESULT FAIL triggers MARKETING_ROLLBACK OK', async () => {
        // socialLink present → resolvedUserId set; profile present → update gate fires.
        outcomes.profileUpdate = { data: null, error: { message: 'permission denied for table profiles' } };
        const d: CaliebDiscovery = await defaultDiscovery();
        const stdout = await captureStdout(() => runConfirm(d));
        // Marketing write succeeded before profile write failed.
        expect(stdout).toContain('MARKETING_WRITE_RESULT OK');
        // Profile write failed AND triggered the rollback DELETE.
        expect(stdout).toContain('PROFILE_WRITE_RESULT FAIL');
        expect(stdout).toContain('permission denied for table profiles');
        expect(stdout).toContain('MARKETING_ROLLBACK OK');
        expect(stdout).toContain('THREW:');
        // Semantic FAIL xor OK check (no log-order coupling).
        expect(stdout).not.toContain('PROFILE_WRITE_RESULT OK');
        // The throw at the end of the profiles-block's `if (updProfErr)`
        // branch exits runConfirm BEFORE the trailing `BACKFILL_NOTES_TAG
        // applied` console.log line — so that tag log must NOT appear on
        // a profile-fail path. This locks the throw-exits-before-trailing-log
        // contract (otherwise a regression that caught the throw would
        // silently still apply the tag on a failed write).
        expect(stdout).not.toContain('BACKFILL_NOTES_TAG applied');
    });

    it('runConfirm FAIL-path: SOCIAL_WRITE_RESULT FAIL surfaces the Supabase error', async () => {
        // Reachability trick: discoverCalieb returns socialLink present +
        // resolvedUserId='user-calieb' by default; mutate d.socialLink = null
        // but KEEP the synthesized resolvedUserId so the insert gate opens.
        outcomes.socialInsert = { data: null, error: { message: 'duplicate key value violates unique constraint' } };
        const d: CaliebDiscovery = await defaultDiscovery();
        d.socialLink = null;
        expect(d.resolvedUserId).toBe('user-calieb');
        const stdout = await captureStdout(() => runConfirm(d));
        expect(stdout).toContain('SOCIAL_WRITE_RESULT FAIL');
        expect(stdout).toContain('duplicate key value violates unique constraint');
        expect(stdout).toContain('THREW:');
        // Social write failed → script returns before reaching the
        // marketing_contacts or profiles blocks.
        expect(stdout).not.toContain('MARKETING_WRITE_RESULT');
        expect(stdout).not.toContain('PROFILE_WRITE_RESULT');
    });

    it('runConfirm FAIL-path: MARKETING_WRITE_RESULT FAIL surfaces the Supabase error and does NOT enter the profiles block', async () => {
        // socialLink present → resolvedUserId set; profile present → would-be update gate fires.
        // marketing_contacts.upsert errors out → script throws BEFORE
        // entering the profiles block, so PROFILE_WRITE_RESULT never logs.
        outcomes.marketingUpsert = { data: null, error: { message: 'duplicate key value violates unique constraint marketing_contacts_phone_e164_key' } };
        outcomes.profileUpdate = { data: null, error: { message: 'should-never-be-read' } };
        const d: CaliebDiscovery = await defaultDiscovery();
        const stdout = await captureStdout(() => runConfirm(d));
        expect(stdout).toContain('INTENDED_MARKETING_UPSERT');
        expect(stdout).toContain('MARKETING_WRITE_RESULT FAIL');
        expect(stdout).toContain('duplicate key value violates unique constraint');
        expect(stdout).toContain('THREW:');
        // Marketing write failed → script returns before the profiles block.
        expect(stdout).not.toContain('PROFILE_WRITE_RESULT');
        expect(stdout).not.toContain('INTENDED_UPDATE');
        // The marketingUpsert failure is BEFORE the rollback branch (which
        // only fires on profile-update FAIL), so the rollback log must not fire.
        expect(stdout).not.toContain('MARKETING_ROLLBACK');
    });
});
