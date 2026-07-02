// tests/numberedPiecesFallback.test.ts
//
// Regression guard for the PGRST202 fall-back in
// services/numberedPieces.ts > fetchPaidCountsByProduct. When the
// get_product_paid_count RPC is missing from the Supabase schema cache
// (e.g. after a DB reset), every product in AppContext.fetchProducts
// would otherwise fire one console.error per page load. The guard
// collapses that into:
//   (a) ONE warn log with the remediation step (per session)
//   (b) zero network calls on subsequent fetches in the same session
//
// This test mocks supabase.rpc so we can verify both behaviors without
// a real Postgres instance.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock('../services/supabase', () => ({
    supabase: {
        rpc: mockRpc,
    },
}));

import { fetchPaidCountsByProduct, __resetRpcFallbackForTests } from '../services/numberedPieces';

describe('fetchPaidCountsByProduct -- PGRST202 session-level fallback', () => {
    beforeEach(() => {
        mockRpc.mockReset();
        __resetRpcFallbackForTests();
    });

    it('returns per-product count when RPC succeeds', async () => {
        mockRpc.mockResolvedValue({ data: 12, error: null });
        const out = await fetchPaidCountsByProduct(['prod_a', 'prod_b']);
        expect(out).toEqual({ prod_a: 12, prod_b: 12 });
        expect(mockRpc).toHaveBeenCalledTimes(2);
        expect(mockRpc).toHaveBeenCalledWith('get_product_paid_count', { p_id: 'prod_a' });
    });

    it('warns ONCE on the first PGRST202 (no per-id console.error)', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });

        const out = await fetchPaidCountsByProduct(['prod_halo_mini_dress']);

        expect(out).toEqual({ prod_halo_mini_dress: 0 });
        expect(warnSpy).toHaveBeenCalledTimes(1);
        // Single warn carries the action item by name so an operator can
        // see it without scrolling past per-id errors.
        const warnText = warnSpy.mock.calls[0].join(' ');
        expect(warnText).toContain('get_product_paid_count');
        expect(warnText).toContain('PGRST202');
        expect(warnText).toContain('createGetProductPaidCountRpc.cjs');
        expect(errSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
        errSpy.mockRestore();
    });

    it('does not hit the network on subsequent calls after PGRST202 detection', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } });

        // First call: detects missing.
        await fetchPaidCountsByProduct(['prod_a']);
        expect(mockRpc).toHaveBeenCalledTimes(1);

        mockRpc.mockClear();

        // Subsequent calls short-circuit and return 0 without hitting RPC.
        const out = await fetchPaidCountsByProduct(['prod_a', 'prod_b', 'prod_c']);
        expect(out).toEqual({ prod_a: 0, prod_b: 0, prod_c: 0 });
        expect(mockRpc).not.toHaveBeenCalled();
    });

    it('logs console.error per id on non-PGRST202 errors (existing behavior preserved)', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockRpc.mockResolvedValue({ data: null, error: { code: 'OTHER', message: 'transient' } });

        const out = await fetchPaidCountsByProduct(['prod_a', 'prod_b']);

        expect(out).toEqual({ prod_a: 0, prod_b: 0 });
        // Per-id errors still fire so a transient Supabase outage
        // surfaces in operator dashboards regardless of session state.
        expect(errSpy).toHaveBeenCalledTimes(2);
        errSpy.mockRestore();
    });

    it('__resetRpcFallbackForTests re-enables RPC calls after a previous detection', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } });
        await fetchPaidCountsByProduct(['prod_a']);

        __resetRpcFallbackForTests();
        mockRpc.mockClear();
        mockRpc.mockResolvedValue({ data: 5, error: null });

        const out = await fetchPaidCountsByProduct(['prod_a']);

        expect(out).toEqual({ prod_a: 5 });
        expect(mockRpc).toHaveBeenCalledTimes(1);
        expect(mockRpc).toHaveBeenCalledWith('get_product_paid_count', { p_id: 'prod_a' });
    });

    it('returns {} for empty productIds array without hitting the network', async () => {
        const out = await fetchPaidCountsByProduct([]);
        expect(out).toEqual({});
        expect(mockRpc).not.toHaveBeenCalled();
    });
});
