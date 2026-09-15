// tests/retryQueue.test.ts
//
// REGRESSION CATCH: locks the contract of services/retryQueue.ts that
// `retryWrite()` calls `clearOtherFeaturedProducts()` after a successful
// add/update when is_featured=true, and SKIPS the helper for delete
// operations / when the write itself fails. This is the 7th caller of
// the helper — without this test, a future refactor of retryWrite could
// silently drop the featured-exclusivity clear and leave two `is_featured`
// rows in the live catalog.
//
// Mocking strategy:
//   - The chainable SupabaseClient mock from tests/_helpers/supabaseClientMock.ts
//     is shared via `vi.mock('../services/supabase')`. The same mock serves
//     both the retry write itself (insert/update/delete) and the
//     featured-exclusivity clear (which the helper runs internally).
//   - Outcomes are queued so each `from()` call consumes the next one
//     (e.g. insert -> clear, update -> clear, delete).
//   - `vi.useFakeTimers()` + `vi.setSystemTime()` bypasses the 10s backoff
//     so each test exercises a single retry attempt without waiting in
//     real time.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockSupabase } from './_helpers/supabaseClientMock';
import { RetryQueue } from '../services/retryQueue';
import type { Product } from '../types';

// vi.mock is hoisted by vitest's transformer ABOVE the imports. The
// factory closes over `mockSupabase` from the import below — by the time
// the factory is called (lazily, when services/retryQueue is first
// imported), the mockSupabase module-level constant has been initialized
// by the helper's own top-level evaluation.
vi.mock('../services/supabase', () => ({
    supabase: mockSupabase.client,
}));

// Minimum product shape retryQueue's mapProductToDb reads. We don't need
// every Product field — just the ones the helper cares about (id, isFeatured).
const makeProduct = (overrides: Partial<Product> = {}): Product => ({
    id: 'prod_test',
    name: 'Test Product',
    price: 100,
    images: [],
    description: 'desc',
    category: 'shirt',
    isFeatured: false,
    isLimitedEdition: false,
    sizes: [],
    sizeInventory: {},
    archived: false,
    ...overrides,
} as Product);

// Narrow the type so we can invoke RetryQueue's PRIVATE `processQueue` method
// without `(queue as any)`. Catches signature changes at compile time.
type ProcessableRetryQueue = RetryQueue & {
    processQueue(): Promise<void>;
};

describe('services/retryQueue — featured-exclusivity integration', () => {
    let queue: RetryQueue;

    beforeEach(() => {
        // Clear localStorage so RetryQueue's loadFromStorage (constructor)
        // and saveToStorage (in add()) start with a clean slate.
        localStorage.clear();
        // Wipe spy call history so each test's assertions are isolated.
        vi.clearAllMocks();
        // Fake timers + setSystemTime give us deterministic control over
        // retryWrite's backoff gate (Date.now() in processQueue).
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
        // Suppress the emoji console output (logs/warns/errors) so
        // test runs are quiet. The existing featuredExclusivity tests
        // follow the same "let it print" pattern unless explicitly spying,
        // but here every retryQueue operation logs so we suppress globally.
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        queue = new RetryQueue();
    });

    afterEach(() => {
        queue.stop();
        vi.useRealTimers();
        localStorage.clear();
        vi.restoreAllMocks();
    });

    describe('after a successful insert', () => {
        it('calls the helper when is_featured=true (write -> clear sequence)', async () => {
            mockSupabase.setOutcomes([
                { kind: 'resolve', value: { error: null, count: null } }, // insert
                { kind: 'resolve', value: { error: null, count: 1 } },    // clear
            ]);
            queue.add('add', makeProduct({ isFeatured: true }));
            // Advance 15s so the 10s backoff gate is satisfied.
            vi.setSystemTime(new Date('2024-01-01T00:00:15Z'));
            await (queue as ProcessableRetryQueue).processQueue();

            // Two from() calls: one for insert, one for the clear.
            expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(2);
            expect(mockSupabase.fromSpy).toHaveBeenNthCalledWith(1, 'products');
            expect(mockSupabase.fromSpy).toHaveBeenNthCalledWith(2, 'products');
            // Insert was called once with the product payload.
            expect(mockSupabase.insertSpy).toHaveBeenCalledTimes(1);
            // Update was called once (for the clear).
            expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(1);
            // The clear matches the helper's documented call shape.
            expect(mockSupabase.updateSpy).toHaveBeenCalledWith(
                { is_featured: false },
                { count: 'exact' }
            );
            // The helper's neq filter is the most distinctive call.
            expect(mockSupabase.neqSpy).toHaveBeenCalledWith('id', 'prod_test');
            // The clear's eq filter on is_featured=true.
            expect(mockSupabase.eqSpy).toHaveBeenCalledWith('is_featured', true);
            // Write succeeded -> write removed from queue.
            expect(queue.getPendingCount()).toBe(0);
        });

        it('does NOT call the helper when is_featured=false (no-op short-circuit)', async () => {
            mockSupabase.setOutcomes([
                { kind: 'resolve', value: { error: null, count: null } }, // insert
            ]);
            queue.add('add', makeProduct({ isFeatured: false }));
            vi.setSystemTime(new Date('2024-01-01T00:00:15Z'));
            await (queue as ProcessableRetryQueue).processQueue();

            // Only one from() call (the insert).
            expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
            expect(mockSupabase.insertSpy).toHaveBeenCalledTimes(1);
            // No clear -> no update, no eq, no neq.
            expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
            expect(mockSupabase.eqSpy).not.toHaveBeenCalled();
            expect(mockSupabase.neqSpy).not.toHaveBeenCalled();
            expect(queue.getPendingCount()).toBe(0);
        });

        it('does NOT call the helper when the insert itself returns an error', async () => {
            mockSupabase.setOutcomes([
                { kind: 'resolve', value: { error: { message: 'rls violation' }, count: null } },
            ]);
            queue.add('add', makeProduct({ isFeatured: true }));
            vi.setSystemTime(new Date('2024-01-01T00:00:15Z'));
            await (queue as ProcessableRetryQueue).processQueue();

            expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
            expect(mockSupabase.insertSpy).toHaveBeenCalledTimes(1);
            // writeSucceeded=false -> helper not invoked.
            expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
            expect(mockSupabase.neqSpy).not.toHaveBeenCalled();
            // Write failed -> write stays in queue for next attempt.
            expect(queue.getPendingCount()).toBe(1);
        });

        it('does NOT call the helper when the insert throws (network failure)', async () => {
            mockSupabase.setOutcomes([
                { kind: 'reject', error: new Error('fetch failed') },
            ]);
            queue.add('add', makeProduct({ isFeatured: true }));
            vi.setSystemTime(new Date('2024-01-01T00:00:15Z'));
            await (queue as ProcessableRetryQueue).processQueue();

            expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
            expect(mockSupabase.insertSpy).toHaveBeenCalledTimes(1);
            // Caught by retryWrite's try/catch -> writeSucceeded stays false.
            expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
            expect(mockSupabase.neqSpy).not.toHaveBeenCalled();
            expect(queue.getPendingCount()).toBe(1);
        });
    });

    describe('after a successful update', () => {
        it('calls the helper when is_featured=true (write -> clear sequence)', async () => {
            mockSupabase.setOutcomes([
                { kind: 'resolve', value: { error: null, count: null } }, // update
                { kind: 'resolve', value: { error: null, count: 2 } },    // clear
            ]);
            queue.add('update', makeProduct({ isFeatured: true }));
            vi.setSystemTime(new Date('2024-01-01T00:00:15Z'));
            await (queue as ProcessableRetryQueue).processQueue();

            // Two from() calls (update + clear).
            expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(2);
            // Update was called twice: once for the write, once for the clear.
            expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(2);
            // The clear's update payload matches the helper's documented shape.
            expect(mockSupabase.updateSpy).toHaveBeenCalledWith(
                { is_featured: false },
                { count: 'exact' }
            );
            // The write's eq filter on id.
            expect(mockSupabase.eqSpy).toHaveBeenCalledWith('id', 'prod_test');
            // The clear's eq filter on is_featured=true.
            expect(mockSupabase.eqSpy).toHaveBeenCalledWith('is_featured', true);
            // The clear's neq filter.
            expect(mockSupabase.neqSpy).toHaveBeenCalledWith('id', 'prod_test');
            expect(queue.getPendingCount()).toBe(0);
        });

        it('does NOT call the helper when is_featured=false (no-op short-circuit)', async () => {
            mockSupabase.setOutcomes([
                { kind: 'resolve', value: { error: null, count: null } }, // update
            ]);
            queue.add('update', makeProduct({ isFeatured: false }));
            vi.setSystemTime(new Date('2024-01-01T00:00:15Z'));
            await (queue as ProcessableRetryQueue).processQueue();

            // Only one from() call (the update).
            expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
            // Update was called once (the write payload, NOT the clear).
            expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(1);
            // The write still applies its id filter.
            expect(mockSupabase.eqSpy).toHaveBeenCalledWith('id', 'prod_test');
            // No clear -> no extra update, no neq.
            expect(mockSupabase.neqSpy).not.toHaveBeenCalled();
            expect(queue.getPendingCount()).toBe(0);
        });

        it('does NOT call the helper when the update itself returns an error', async () => {
            mockSupabase.setOutcomes([
                { kind: 'resolve', value: { error: { message: 'rls violation' }, count: null } },
            ]);
            queue.add('update', makeProduct({ isFeatured: true }));
            vi.setSystemTime(new Date('2024-01-01T00:00:15Z'));
            await (queue as ProcessableRetryQueue).processQueue();

            expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
            expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(1);
            // writeSucceeded=false -> helper not invoked.
            expect(mockSupabase.neqSpy).not.toHaveBeenCalled();
            // Write failed -> write stays in queue for next attempt.
            expect(queue.getPendingCount()).toBe(1);
        });

        it('does NOT call the helper when the update throws (network failure)', async () => {
            mockSupabase.setOutcomes([
                { kind: 'reject', error: new Error('fetch failed') },
            ]);
            queue.add('update', makeProduct({ isFeatured: true }));
            vi.setSystemTime(new Date('2024-01-01T00:00:15Z'));
            await (queue as ProcessableRetryQueue).processQueue();

            expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
            expect(mockSupabase.updateSpy).toHaveBeenCalledTimes(1);
            // Caught by retryWrite's try/catch -> writeSucceeded stays false.
            expect(mockSupabase.neqSpy).not.toHaveBeenCalled();
            expect(queue.getPendingCount()).toBe(1);
        });
    });

    describe('for delete operations', () => {
        it('does NOT call the helper (delete is excluded from the featured-exclusivity clear)', async () => {
            mockSupabase.setOutcomes([
                { kind: 'resolve', value: { error: null, count: null } }, // delete
            ]);
            queue.add('delete', makeProduct({ isFeatured: true }));
            vi.setSystemTime(new Date('2024-01-01T00:00:15Z'));
            await (queue as ProcessableRetryQueue).processQueue();

            // Only one from() call (the delete).
            expect(mockSupabase.fromSpy).toHaveBeenCalledTimes(1);
            expect(mockSupabase.deleteSpy).toHaveBeenCalledTimes(1);
            // The delete chain still uses .eq('id', write.id).
            expect(mockSupabase.eqSpy).toHaveBeenCalledWith('id', 'prod_test');
            // No clear for deletes — even when is_featured is true.
            expect(mockSupabase.updateSpy).not.toHaveBeenCalled();
            expect(mockSupabase.neqSpy).not.toHaveBeenCalled();
            expect(queue.getPendingCount()).toBe(0);
        });
    });
});
