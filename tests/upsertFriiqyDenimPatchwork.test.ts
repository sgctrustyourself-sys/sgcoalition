// tests/upsertFriiqyDenimPatchwork.test.ts
//
// Vitest lock for scripts/upsertFriiqyDenimPatchwork.ts.
// Pattern: vi.mock + setOutcomes queue mirroring tests/referralFlows.test.ts.
// MOCK SHAPE: Supabase maybeSingle contract is rowObject | null (single row).
// Earlier draft used data: [{...}] arrays and tripped the appendFriqqyTagIfMissing
// .notes path with array.notes=undefined. Tests now use object form.

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockOutcomes {
    ordersSelect: { data: any; error: any };
    upsertErr: any;
}

let outcomes: MockOutcomes = {
    ordersSelect: { data: null, error: null },
    upsertErr: null,
};

vi.mock('dotenv', () => ({ default: { config: () => undefined }, config: () => undefined }));

vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({ from: () => buildOrdersMock() }),
}));

function buildOrdersMock(): any {
    return {
        select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve(outcomes.ordersSelect) }),
        }),
        upsert: () => ({
            select: () => ({
                single: () => Promise.resolve({ data: outcomes.upsertErr ? null : { id: 'public-md-denim-patchwork-2024_11_08' }, error: outcomes.upsertErr }),
            }),
        }),
    };
}

import {
    buildOrderRow,
    DENIM_NOTES_TAG,
    FRIQQY_TAG,
    runConfirm,
    runDry,
    TARGET_ORDER_ID,
} from '../scripts/upsertFriiqyDenimPatchwork';

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

describe('upsertFriiqyDenimPatchwork', () => {
    beforeEach(() => {
        outcomes = {
            ordersSelect: { data: null, error: null },
            upsertErr: null,
        };
    });

    it('exports the stable magic-token constants', () => {
        expect(TARGET_ORDER_ID).toBe('public-md-denim-patchwork-2024_11_08');
        expect(DENIM_NOTES_TAG).toBe(FRIQQY_TAG);
        expect(FRIQQY_TAG).toBe('@sgcoalition-friiqy-link-2026-07-16');
        expect(typeof runDry).toBe('function');
        expect(typeof runConfirm).toBe('function');
    });

    it('buildOrderRow returns the canonical denim patchwork row', () => {
        const row = buildOrderRow();
        expect(row.id).toBe(TARGET_ORDER_ID);
        expect(row.order_number).toBe('ORD-SG-DENIM-S1');
        expect(row.total).toBe(140);
        expect(row.customer_email).toBe('wholesale@example.com');
        expect(row.items.length).toBe(1);
        expect(row.items[0].productId).toBe('Coalition_Denim_Patchwork_S1');
        expect(row.shipping_address.state).toBe('MD');
    });

    it('dry-run emits DENIM_FOUND + INTENDED_DENIM_UPSERT for existing order', async () => {
        outcomes.ordersSelect = { data: { id: TARGET_ORDER_ID, order_number: 'ORD-SG-DENIM-S1', total: 140, notes: '' }, error: null };
        const stdout = await captureStdout(() => runDry());
        expect(stdout).toMatch(/DENIM_FOUND/);
        expect(stdout).toMatch(/INTENDED_DENIM_UPSERT/);
        expect(stdout).toMatch(/public-md-denim-patchwork-2024_11_08/);
        expect(stdout).toMatch(/140/);
    });

    it('dry-run emits DENIM_NOT_FOUND for missing order', async () => {
        outcomes.ordersSelect = { data: null, error: null };
        const stdout = await captureStdout(() => runDry());
        expect(stdout).toMatch(/DENIM_NOT_FOUND/);
        expect(stdout).toMatch(/INTENDED_DENIM_UPSERT/);
    });

    it('confirm path: insert + DENIM_NOTES_TAG applied when order missing', async () => {
        outcomes.ordersSelect = { data: null, error: null };
        const stdout = await captureStdout(() => runConfirm());
        expect(stdout).toMatch(/DENIM_UPSERT_OK/);
        expect(stdout).toMatch(TARGET_ORDER_ID);
        expect(stdout).toMatch(FRIQQY_TAG);
    });

    it('confirm path: idempotent re-run detects existing FRIQQY_TAG', async () => {
        outcomes.ordersSelect = { data: { id: TARGET_ORDER_ID, notes: 'Backfilled from INITIAL_ORDERS seed. Offline cash sale. ' + FRIQQY_TAG }, error: null };
        const stdout = await captureStdout(() => runConfirm());
        expect(stdout).toMatch(/DENIM_UPSERT_OK/);
        expect(stdout).toMatch(/already/);
        expect(stdout).toMatch(/DENIM_NOTES_TAG/);
    });

    it('confirm path: DENIM_UPSERT_FAIL + Supabase error surfaces', async () => {
        outcomes.ordersSelect = { data: null, error: null };
        outcomes.upsertErr = { message: 'permission denied for table orders' };
        const stdout = await captureStdout(() => runConfirm());
        expect(stdout).toMatch(/DENIM_UPSERT_FAIL/);
        expect(stdout).toMatch(/permission denied/);
    });
});
