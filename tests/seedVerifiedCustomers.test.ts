// tests/seedVerifiedCustomers.test.ts
//
// Vitest lock for scripts/seedVerifiedCustomers.ts.
// MOCK CONTRACT: runDry reads by .eq('email', ...) -> contactSelect.
//                runConfirm has exactly ONE read: the post-upsert re-read
//                by .eq('id', upserted.id) -> contactReread.
// Earlier drafts used alternating selectCallCount (%2 === 1) which routed
// the re-read to contactSelect, then re-read returned {data:null,error:PGRST116}
// and the test threw 'cross-validation read failed: undefined'.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockOutcomes {
    contactSelect: { data: any; error: any };
    contactUpsert: { data: any; error: any };
    contactReread: { data: any; error: any };
}

let outcomes: MockOutcomes = {
    contactSelect: { data: null, error: null },
    contactUpsert: { data: { id: 'mc-1' }, error: null },
    contactReread: { data: { id: 'mc-1', email: 'wholesale@example.com', source: 'manual_seed', metadata: { instagram_username: 'friiqy', notes_tag: '@sgcoalition-verified-buyer-link-2026-07-16' } }, error: null },
};

vi.mock('dotenv', () => ({ default: { config: () => undefined }, config: () => undefined }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: () => buildMarketingMock() }),
}));

function buildMarketingMock(): any {
    // Differentiate reads by .eq() column name. runDry uses 'email';
    // runConfirm re-read uses 'id'. The script makes exactly one
    // re-read in runConfirm so alternating counters over-engineer it.
    return {
        select: () => ({
            eq: (col: string, _val: any) => {
                if (col === 'id') {
                    return { maybeSingle: () => Promise.resolve(outcomes.contactReread) };
                }
                return { maybeSingle: () => Promise.resolve(outcomes.contactSelect) };
            },
        }),
        upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: outcomes.contactUpsert.data, error: outcomes.contactUpsert.error }) }) }),
    };
}

import {
    buildMarketingContactPayload,
    FRIQQY_IG_HANDLE,
    runConfirm,
    runDry,
    TARGET_EMAIL,
    VERIFIED_NOTES_TAG,
} from '../scripts/seedVerifiedCustomers';

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

describe('seedVerifiedCustomers', () => {
    beforeEach(() => {
        outcomes = {
            contactSelect: { data: null, error: null },
            contactUpsert: { data: { id: 'mc-1' }, error: null },
            contactReread: { data: { id: 'mc-1', email: TARGET_EMAIL, source: 'manual_seed', metadata: { instagram_username: FRIQQY_IG_HANDLE, notes_tag: VERIFIED_NOTES_TAG } }, error: null },
        };
    });

    it('exports the stable magic-token constants', () => {
        expect(TARGET_EMAIL).toBe('wholesale@example.com');
        expect(FRIQQY_IG_HANDLE).toBe('friiqy');
        expect(VERIFIED_NOTES_TAG).toBe('@sgcoalition-verified-buyer-link-2026-07-16');
    });

    it('payload pins instagram_username for the JOIN contract', () => {
        const p = buildMarketingContactPayload();
        expect(p.email).toBe(TARGET_EMAIL);
        expect(p.source).toBe('manual_seed');
        expect(p.status).toBe('active');
        expect(p.metadata.instagram_username).toBe(FRIQQY_IG_HANDLE);
        expect(p.metadata.total_offline_orders).toBeGreaterThan(0);
        expect(p.metadata.total_offline_spend_usd).toBeGreaterThan(0);
    });

    it('dry-run emits VERIFIED_FOUND + INTENDED_VERIFIED_UPSERT for existing contact', async () => {
        outcomes.contactSelect = { data: { id: 'mc-1', email: TARGET_EMAIL, metadata: { instagram_username: FRIQQY_IG_HANDLE } }, error: null };
        const stdout = await captureStdout(() => runDry());
        expect(stdout).toMatch(/VERIFIED_FOUND/);
        expect(stdout).toMatch(/INTENDED_VERIFIED_UPSERT/);
        expect(stdout).toMatch(/friiqy/);
    });

    it('dry-run emits VERIFIED_NOT_FOUND for missing contact', async () => {
        outcomes.contactSelect = { data: null, error: { code: 'PGRST116' } };
        const stdout = await captureStdout(() => runDry());
        expect(stdout).toMatch(/VERIFIED_NOT_FOUND/);
        expect(stdout).toMatch(/INTENDED_VERIFIED_UPSERT/);
    });

    it('confirm path: insert + re-read cross-validate succeeds', async () => {
        outcomes.contactSelect = { data: null, error: { code: 'PGRST116' } };
        const stdout = await captureStdout(() => runConfirm());
        expect(stdout).toMatch(/VERIFIED_UPSERT_OK/);
        expect(stdout).toMatch(/CROSS_VALIDATE_PASS/);
        expect(stdout).toMatch(/instagram_username/);
    });

    it('confirm path: idempotent update when contact exists', async () => {
        outcomes.contactSelect = { data: { id: 'mc-1', email: TARGET_EMAIL, source: 'manual_seed', metadata: { instagram_username: FRIQQY_IG_HANDLE, notes_tag: VERIFIED_NOTES_TAG } }, error: null };
        const stdout = await captureStdout(() => runConfirm());
        expect(stdout).toMatch(/VERIFIED_UPSERT_OK/);
        expect(stdout).toMatch(/CROSS_VALIDATE_PASS/);
    });

    it('confirm path: VERIFIED_UPSERT_FAIL + Supabase error surfaces', async () => {
        outcomes.contactSelect = { data: null, error: { code: 'PGRST116' } };
        outcomes.contactUpsert = { data: null, error: { message: 'column metadata does not exist' } };
        const stdout = await captureStdout(() => runConfirm());
        expect(stdout).toMatch(/VERIFIED_UPSERT_FAIL/);
        expect(stdout).toMatch(/metadata/);
    });

    it('confirm path: CROSS_VALIDATE_FAIL when re-read loses instagram_username', async () => {
        outcomes.contactSelect = { data: null, error: { code: 'PGRST116' } };
        outcomes.contactReread = { data: { id: 'mc-1', email: TARGET_EMAIL, source: 'manual_seed', metadata: { instagram_username: 'WRONG_HANDLE' } }, error: null };
        const stdout = await captureStdout(() => runConfirm());
        expect(stdout).toMatch(/VERIFIED_UPSERT_OK/);
        expect(stdout).toMatch(/CROSS_VALIDATE_FAIL/);
        expect(stdout).toMatch(/instagram_username/);
    });
});
