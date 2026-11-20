// tests/_helpers/supabaseClientMock.ts
//
// Reusable Supabase client mock factory for vitest tests.
//
// Builds a chainable mock that mirrors the supabase-js builder pattern:
// each call to `.from(table)` returns a fresh chain whose every method
// (`.insert / .update / .delete / .select / .upsert / .eq / .neq / ...`)
// returns the SAME chain, so the terminal `await` invokes that chain's
// `then` exactly once.
//
// The chain's `then` consumes the next outcome from an internal queue, so
// tests can program multi-step sequences (e.g. "first await resolves with a
// successful insert, second await resolves with a clear" for retryQueue.ts
// where the same client is used for the write AND the featured-exclusivity
// clear).
//
// Two consumption patterns are supported:
//
//   1. Per-test factory: call `makeSupabaseClient([outcome1, outcome2, ...])`
//      to get a fresh mock with a fresh queue (used by
//      `tests/featuredExclusivity.test.ts` where each test is a single await).
//
//   2. Module-level singleton: import `mockSupabase` and call
//      `mockSupabase.setOutcomes([...])` in beforeEach (used by tests that
//      need to `vi.mock('../services/supabase')` — the singleton's `.client`
//      reference is stable, so the `vi.mock` factory can capture it at
//      import time and the queue state can still be reset per-test).

import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SupabaseOutcome =
    | { kind: 'resolve'; value: { error?: unknown; count?: number | null; data?: unknown } }
    | { kind: 'reject'; error: unknown };

export interface SupabaseMock {
    /** The mock client; safe to cast to SupabaseClient for helper call sites. */
    client: SupabaseClient;
    fromSpy: ReturnType<typeof vi.fn>;
    insertSpy: ReturnType<typeof vi.fn>;
    updateSpy: ReturnType<typeof vi.fn>;
    deleteSpy: ReturnType<typeof vi.fn>;
    eqSpy: ReturnType<typeof vi.fn>;
    neqSpy: ReturnType<typeof vi.fn>;
    selectSpy: ReturnType<typeof vi.fn>;
    upsertSpy: ReturnType<typeof vi.fn>;
    maybeSingleSpy: ReturnType<typeof vi.fn>;
    singleSpy: ReturnType<typeof vi.fn>;
    inSpy: ReturnType<typeof vi.fn>;
    orderSpy: ReturnType<typeof vi.fn>;
    limitSpy: ReturnType<typeof vi.fn>;
    gteSpy: ReturnType<typeof vi.fn>;
    lteSpy: ReturnType<typeof vi.fn>;
    orSpy: ReturnType<typeof vi.fn>;
    rpcSpy: ReturnType<typeof vi.fn>;
    /**
     * Replace the queue of outcomes for the NEXT sequence of awaits.
     * Each call to `await supabase.from(...)` OR `await supabase.rpc(...)`
     * consumes the next outcome from the same queue. Used by tests that
     * share a singleton mock across multiple cases.
     */
    setOutcomes(outcomes: SupabaseOutcome | SupabaseOutcome[]): void;
    /**
     * Returns the number of outcomes not yet consumed by an await call.
     * Tests that assert on early-return contracts use this to confirm
     * the function exited BEFORE further database writes were attempted.
     */
    getRemainingOutcomes(): number;
}

export function makeSupabaseClient(
    outcomes: SupabaseOutcome | SupabaseOutcome[] = { kind: 'resolve', value: {} }
): SupabaseMock {
    let queue: SupabaseOutcome[] = Array.isArray(outcomes) ? [...outcomes] : [outcomes];

    const fromSpy = vi.fn();
    const insertSpy = vi.fn();
    const updateSpy = vi.fn();
    const deleteSpy = vi.fn();
    const eqSpy = vi.fn();
    const neqSpy = vi.fn();
    const selectSpy = vi.fn();
    const upsertSpy = vi.fn();
    const maybeSingleSpy = vi.fn();
    const singleSpy = vi.fn();
    const inSpy = vi.fn();
    const orderSpy = vi.fn();
    const limitSpy = vi.fn();
    const gteSpy = vi.fn();
    const lteSpy = vi.fn();
    const orSpy = vi.fn();
    const rpcSpy = vi.fn();

    function buildChain(): any {
        const then = (resolve: (v: any) => void, reject: (e: unknown) => void) => {
            const next = queue.shift();
            if (next?.kind === 'reject') {
                reject(next.error);
            } else {
                const v = next?.value ?? {};
                resolve({ data: null, error: null, count: 0, ...v });
            }
        };
        const chain: any = { then };
        // Mutation methods — record args + return chain.
        chain.insert = insertSpy.mockImplementation(() => chain);
        chain.update = updateSpy.mockImplementation(() => chain);
        chain.delete = deleteSpy.mockImplementation(() => chain);
        chain.select = selectSpy.mockImplementation(() => chain);
        chain.upsert = upsertSpy.mockImplementation(() => chain);
        // Filter methods — record args + return chain.
        chain.eq = eqSpy.mockImplementation(() => chain);
        chain.neq = neqSpy.mockImplementation(() => chain);
        chain.in = inSpy.mockImplementation(() => chain);
        chain.gte = gteSpy.mockImplementation(() => chain);
        chain.lte = lteSpy.mockImplementation(() => chain);
        chain.or = orSpy.mockImplementation(() => chain);
        chain.order = orderSpy.mockImplementation(() => chain);
        chain.limit = limitSpy.mockImplementation(() => chain);
        // Terminal methods — record args + return chain (still thenable).
        chain.maybeSingle = maybeSingleSpy.mockImplementation(() => chain);
        chain.single = singleSpy.mockImplementation(() => chain);
        return chain;
    }

    // rpc() returns a thenable that consumes from the SAME shared queue
    // as from() chains so tests can script an interleaved
    // supabase.rpc(...) + supabase.from(...) sequence (e.g. fire the
    // analytics RPC before reading stats from a table).
    const rpcThenable = () => ({
        then: (resolve: (v: any) => void, reject: (e: unknown) => void) => {
            const next = queue.shift();
            if (next?.kind === 'reject') {
                reject(next.error);
            } else {
                const v = next?.value ?? {};
                resolve({ data: null, error: null, ...v });
            }
        },
    });
    rpcSpy.mockImplementation(() => rpcThenable());

    fromSpy.mockImplementation(() => buildChain());

    const client: any = { from: fromSpy, rpc: rpcSpy };

    return {
        client: client as SupabaseClient,
        fromSpy, insertSpy, updateSpy, deleteSpy,
        eqSpy, neqSpy, selectSpy, upsertSpy,
        maybeSingleSpy, singleSpy, inSpy, orderSpy, limitSpy,
        gteSpy, lteSpy, orSpy, rpcSpy,
        setOutcomes(outcomes: SupabaseOutcome | SupabaseOutcome[]) {
            queue = Array.isArray(outcomes) ? [...outcomes] : [outcomes];
        },
        getRemainingOutcomes() {
            return queue.length;
        },
    };
}

/**
 * Default singleton for tests that `vi.mock('../services/supabase')` and
 * need a stable client reference. Use `setOutcomes` in beforeEach to reset
 * the queue, and `vi.clearAllMocks()` to wipe spy call history.
 */
export const mockSupabase: SupabaseMock = makeSupabaseClient();
