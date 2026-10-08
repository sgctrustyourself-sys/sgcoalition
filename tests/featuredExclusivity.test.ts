// tests/featuredExclusivity.test.ts
//
// REGRESSION CATCH: locks the contract of utils/featuredExclusivity.ts so
// the never-throws guarantee, the no-op short-circuit, the warn-on-failure
// policy, and the custom-logger behavior stay intact as more callers adopt
// the helper (5 CLI scripts + admin-products.ts + AppContext.tsx +
// retryQueue.ts).
//
// Contracts being locked:
//
//   clearOtherFeaturedProducts(supabase, currentProductId, isFeatured, options?):
//     1. No-op short-circuit: when isFeatured is false/undefined, no
//        network call is made and the result shape is the early-return
//        sentinel { cleared: false, error: null, clearedCount: 0 }.
//     2. Happy path: when supabase resolves with `{ error: null, count: N }`
//        AND N > 0, the helper returns `{ cleared: true, clearedCount: N }`
//        AND emits a log line.
//     3. Thrown-error path: when supabase `.update()` rejects/throws
//        (network failure), the helper returns
//        `{ cleared: false, error: <thrown-error>, clearedCount: 0 }`
//        and never throws to the caller.
//     4. Returned-error path: when supabase resolves with
//        `{ error: <PostgrestError | any> }`, the helper returns
//        `{ cleared: false, error: <that error>, clearedCount: 0 }` and
//        never throws.
//     5. Programmer-error guard: empty/whitespace/missing-id throws
//        synchronously before any network call is made.
//     6. Custom warn/log options: when supplied, they are invoked INSTEAD
//        of the default console.warn / console.log.
//
// Mocking strategy: a chainable SupabaseClient mock whose every chain
// method (from / update / eq / neq) returns the same thenable object.
// The thenable's then either resolves to the configured value or rejects
// with the configured error, so a single helper can drive both contracts #3
// and #4 from the same factory.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { clearOtherFeaturedProducts } from '../utils/featuredExclusivity';
import {
    makeSupabaseClient,
    type SupabaseOutcome,
    type SupabaseMock,
} from './_helpers/supabaseClientMock';

describe('utils/featuredExclusivity', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    describe('clearOtherFeaturedProducts — no-op short-circuit', () => {
        it('returns the early-return sentinel without any DB call when isFeatured=false', async () => {
            const { client, fromSpy, updateSpy, eqSpy, neqSpy } = makeSupabaseClient();
            const result = await clearOtherFeaturedProducts(client, 'prod_1', false);
            expect(result).toEqual({ cleared: false, error: null, clearedCount: 0 });
            expect(fromSpy).not.toHaveBeenCalled();
            expect(updateSpy).not.toHaveBeenCalled();
            expect(eqSpy).not.toHaveBeenCalled();
            expect(neqSpy).not.toHaveBeenCalled();
        });

        it('returns the early-return sentinel without any DB call when isFeatured=undefined', async () => {
            const { client, fromSpy, updateSpy, eqSpy, neqSpy } = makeSupabaseClient();
            const result = await clearOtherFeaturedProducts(client, 'prod_1', undefined);
            expect(result).toEqual({ cleared: false, error: null, clearedCount: 0 });
            expect(fromSpy).not.toHaveBeenCalled();
            expect(updateSpy).not.toHaveBeenCalled();
            expect(eqSpy).not.toHaveBeenCalled();
            expect(neqSpy).not.toHaveBeenCalled();
        });
    });

    describe('clearOtherFeaturedProducts — programmer-error guard', () => {
        it('throws when currentProductId is the empty string', async () => {
            const { client } = makeSupabaseClient();
            await expect(
                clearOtherFeaturedProducts(client, '', true)
            ).rejects.toThrow(/currentProductId is required/);
        });

        it('throws when currentProductId is whitespace only', async () => {
            const { client } = makeSupabaseClient();
            await expect(
                clearOtherFeaturedProducts(client, '   ', true)
            ).rejects.toThrow(/currentProductId is required/);
        });

        it('throws when currentProductId coerces to empty (null via cast)', async () => {
            const { client, fromSpy, updateSpy, eqSpy, neqSpy } = makeSupabaseClient();
            await expect(
                clearOtherFeaturedProducts(client, null as unknown as string, true)
            ).rejects.toThrow(/currentProductId is required/);
            // Mirrors the empty-string test: throws BEFORE any supabase call.
            expect(fromSpy).not.toHaveBeenCalled();
            expect(updateSpy).not.toHaveBeenCalled();
            expect(eqSpy).not.toHaveBeenCalled();
            expect(neqSpy).not.toHaveBeenCalled();
        });

        it('does NOT touch the chain when throwing on empty id', async () => {
            const { client, fromSpy, updateSpy, eqSpy, neqSpy } = makeSupabaseClient();
            await expect(
                clearOtherFeaturedProducts(client, '', true)
            ).rejects.toThrow();
            expect(fromSpy).not.toHaveBeenCalled();
            expect(updateSpy).not.toHaveBeenCalled();
            expect(eqSpy).not.toHaveBeenCalled();
            expect(neqSpy).not.toHaveBeenCalled();
        });
    });

    describe('clearOtherFeaturedProducts — happy path', () => {
        it('returns clearedCount when supabase resolves with count > 0 and IS the chain pattern we expect', async () => {
            const { client, fromSpy, updateSpy, eqSpy, neqSpy } = makeSupabaseClient({
                kind: 'resolve', value: { error: null, count: 3 },
            });
            const result = await clearOtherFeaturedProducts(client, 'prod_new', true);
            expect(result).toEqual({ cleared: true, error: null, clearedCount: 3 });
            expect(fromSpy).toHaveBeenCalledWith('products');
            expect(updateSpy).toHaveBeenCalledWith(
                { is_featured: false },
                { count: 'exact' }
            );
            expect(eqSpy).toHaveBeenCalledWith('is_featured', true);
            expect(neqSpy).toHaveBeenCalledWith('id', 'prod_new');
        });

        it('trims whitespace in the supplied currentProductId before the neq filter', async () => {
            const { client, neqSpy } = makeSupabaseClient({
                kind: 'resolve', value: { error: null, count: 0 },
            });
            await clearOtherFeaturedProducts(client, '  prod_x  ', true);
            expect(neqSpy).toHaveBeenCalledWith('id', 'prod_x');
        });

        it('does NOT invoke the default console.log when clearing 0 rows', async () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const { client } = makeSupabaseClient({
                kind: 'resolve', value: { error: null, count: 0 },
            });
            const result = await clearOtherFeaturedProducts(client, 'prod_a', true);
            expect(result).toEqual({ cleared: true, error: null, clearedCount: 0 });
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('invokes the default console.log when clearing N > 0 rows', async () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const { client } = makeSupabaseClient({
                kind: 'resolve', value: { error: null, count: 2 },
            });
            await clearOtherFeaturedProducts(client, 'prod_a', true);
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
            expect(consoleLogSpy.mock.calls[0][0]).toContain('Cleared is_featured on 2');
            expect(consoleLogSpy.mock.calls[0][0]).toContain('prod_a');
        });
    });

    describe('clearOtherFeaturedProducts — thrown-error path', () => {
        it('returns {cleared:false, error} when supabase.update() rejects with an Error (network failure)', async () => {
            const warnSpy = vi.fn();
            const networkError = new Error('fetch failed');
            const { client } = makeSupabaseClient({ kind: 'reject', error: networkError });
            const result = await clearOtherFeaturedProducts(client, 'prod_a', true, { warn: warnSpy });
            expect(result.cleared).toBe(false);
            expect(result.error).toBe(networkError);
            expect(result.clearedCount).toBe(0);
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls[0][0]).toContain('fetch failed');
        });

        it('handles non-Error thrown values (string) via String() fallback', async () => {
            const warnSpy = vi.fn();
            const { client } = makeSupabaseClient({ kind: 'reject', error: 'plain string error' });
            const result = await clearOtherFeaturedProducts(client, 'prod_a', true, { warn: warnSpy });
            expect(result.cleared).toBe(false);
            expect(result.clearedCount).toBe(0);
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls[0][0]).toContain('plain string error');
        });

        it('never throws to the caller (resolves with error result)', async () => {
            // Suppress default console.warn so test output stays clean —
            // this test deliberately exercises the throw-to-warn fallback.
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            const { client } = makeSupabaseClient({
                kind: 'reject', error: new Error('rls violation'),
            });
            await expect(
                clearOtherFeaturedProducts(client, 'prod_a', true)
            ).resolves.toBeDefined();
        });
    });

    describe('clearOtherFeaturedProducts — returned-error path', () => {
        it('returns {cleared:false, error} when supabase resolves with a Postgrest-like error', async () => {
            const warnSpy = vi.fn();
            const pgError = { message: 'permission denied for table products', code: '42501' };
            const { client } = makeSupabaseClient({
                kind: 'resolve', value: { error: pgError, count: null },
            });
            const result = await clearOtherFeaturedProducts(client, 'prod_a', true, { warn: warnSpy });
            expect(result.cleared).toBe(false);
            expect(result.error).toBe(pgError);
            expect(result.clearedCount).toBe(0);
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls[0][0]).toContain('permission denied for table products');
        });

        it('handles error objects without a .message field without throwing', async () => {
            const warnSpy = vi.fn();
            const errorWithoutMessage = { code: 'UNKNOWN' };
            const { client } = makeSupabaseClient({
                kind: 'resolve', value: { error: errorWithoutMessage, count: null },
            });
            const result = await clearOtherFeaturedProducts(client, 'prod_a', true, { warn: warnSpy });
            expect(result.cleared).toBe(false);
            expect(result.clearedCount).toBe(0);
            expect(warnSpy).toHaveBeenCalledTimes(1);
            // The pinned contract is "warn fires + never throws". The exact
            // rendering of an unknown-shape error is `String({code:'UNKNOWN'})`
            // which falls back to `[object Object]`; we don't pin that because
            // it's an artifact of the String() fallback path, not part of the
            // helper's documented contract.
            expect(warnSpy.mock.calls[0][0]).toContain('[featured-exclusivity] Failed to clear');
        });

        it('never throws to the caller (resolves with error result)', async () => {
            // Suppress default console.warn so test output stays clean —
            // same rationale as the thrown-error counterpart above.
            vi.spyOn(console, 'warn').mockImplementation(() => {});
            const { client } = makeSupabaseClient({
                kind: 'resolve', value: { error: { message: 'rls' }, count: null },
            });
            await expect(
                clearOtherFeaturedProducts(client, 'prod_a', true)
            ).resolves.toBeDefined();
        });
    });

    describe('clearOtherFeaturedProducts — custom warn/log options', () => {
        it('invokes custom log when clearing N > 0 rows AND default console is NOT called', async () => {
            const logSpy = vi.fn();
            const warnSpy = vi.fn();
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const { client } = makeSupabaseClient({
                kind: 'resolve', value: { error: null, count: 4 },
            });
            await clearOtherFeaturedProducts(client, 'prod_a', true, { log: logSpy, warn: warnSpy });
            expect(logSpy).toHaveBeenCalledTimes(1);
            expect(logSpy.mock.calls[0][0]).toMatch(/Cleared is_featured on 4 other product\(s\)/);
            expect(logSpy.mock.calls[0][0]).toContain('prod_a');
            expect(warnSpy).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('does NOT invoke custom log when clearing 0 rows', async () => {
            const logSpy = vi.fn();
            const { client } = makeSupabaseClient({
                kind: 'resolve', value: { error: null, count: 0 },
            });
            await clearOtherFeaturedProducts(client, 'prod_a', true, { log: logSpy });
            expect(logSpy).not.toHaveBeenCalled();
        });

        it('invokes custom warn on returned error AND default console is NOT called', async () => {
            const warnSpy = vi.fn();
            const logSpy = vi.fn();
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const { client } = makeSupabaseClient({
                kind: 'resolve', value: { error: { message: 'rls violation' }, count: null },
            });
            await clearOtherFeaturedProducts(client, 'prod_a', true, { log: logSpy, warn: warnSpy });
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls[0][0]).toContain('rls violation');
            expect(logSpy).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('invokes custom warn on thrown error AND default console is NOT called', async () => {
            const warnSpy = vi.fn();
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const { client } = makeSupabaseClient({
                kind: 'reject', error: new Error('fetch failed'),
            });
            await clearOtherFeaturedProducts(client, 'prod_a', true, { warn: warnSpy });
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls[0][0]).toContain('fetch failed');
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });
});

