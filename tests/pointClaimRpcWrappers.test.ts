// tests/pointClaimRpcWrappers.test.ts
//
// Locks the public surface of services/pointClaim.ts — the wrapper layer the
// /claim page calls into. Three things are worth pinning here and nowhere else:
//
//   1. The RPC names and argument names. They are the contract with
//      supabase/migrations/20261027_create_point_claims.sql; a rename on either
//      side would otherwise surface as a runtime "Could not find the function"
//      the first time a real buyer claimed points.
//   2. postgREST returns a RETURNS TABLE row as a one-element array, and numeric
//      columns as strings. The page does arithmetic and .toLocaleString() on
//      those values, so the coercion is part of the contract.
//   3. An unapplied migration is reported as an actionable sentence rather than
//      "Could not find the function … in the schema cache" in a buyer's face.
//
// services/supabase is mocked through the shared helper so rpc() and the
// chained from().select() reads both draw from one outcome queue.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from './_helpers/supabaseClientMock';

vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));

import {
    MAX_CLAIM_NOTE_LENGTH,
    getMyPointClaims,
    lookupOrderPoints,
    submitPointClaim,
} from '../services/pointClaim';

const lookupRow = {
    matched: true,
    points: '84',
    order_total: '84.00',
    order_date: '2026-07-04T12:00:00Z',
    already_claimed: false,
};

const submitRow = { claim_id: 'claim-1', status: 'pending', points: '84', matched: true };

beforeEach(() => {
    mockSupabase.setOutcomes([]);
    vi.clearAllMocks();
});

describe('lookupOrderPoints', () => {
    it('calls lookup_order_points with the typed order number and email, trimmed', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: [lookupRow] } }]);

        const result = await lookupOrderPoints('  ORD-1234  ', ' buyer@example.com ');

        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('lookup_order_points', {
            p_order_number: 'ORD-1234',
            p_email: 'buyer@example.com',
        });
        expect(result).toEqual({
            matched: true,
            points: 84,
            orderTotal: 84,
            orderDate: '2026-07-04T12:00:00Z',
            alreadyClaimed: false,
        });
    });

    it('reads numeric columns that arrive as strings, so the page can do arithmetic', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: [lookupRow] } }]);

        const result = await lookupOrderPoints('ORD-1234', 'buyer@example.com');

        expect(typeof result.points).toBe('number');
        expect(result.points + 1).toBe(85);
    });

    it('reports an unmatched order without inventing points', async () => {
        mockSupabase.setOutcomes([
            {
                kind: 'resolve',
                value: {
                    data: [
                        {
                            matched: false,
                            points: null,
                            order_total: null,
                            order_date: null,
                            already_claimed: false,
                        },
                    ],
                },
            },
        ]);

        const result = await lookupOrderPoints('ORD-9999', 'nobody@example.com');

        expect(result.matched).toBe(false);
        expect(result.points).toBe(0);
        expect(result.orderTotal).toBeNull();
    });

    it('also accepts a single object, in case PostgREST stops wrapping the row', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: lookupRow } }]);

        const result = await lookupOrderPoints('ORD-1234', 'buyer@example.com');

        expect(result.points).toBe(84);
        expect(result.matched).toBe(true);
    });

    it('turns an unapplied migration into a sentence that names the file', async () => {
        mockSupabase.setOutcomes([
            {
                kind: 'resolve',
                value: { error: { message: 'Could not find the function public.lookup_order_points(p_email, p_order_number) in the schema cache' } },
            },
        ]);

        await expect(lookupOrderPoints('ORD-1234', 'buyer@example.com')).rejects.toThrow(
            /20261027_create_point_claims\.sql/,
        );
    });

    it('passes a permission error through instead of blaming the migration', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { error: { message: 'Sign in to look up your order' } } },
        ]);

        await expect(lookupOrderPoints('ORD-1234', 'buyer@example.com')).rejects.toThrow(
            /Sign in to look up your order/,
        );
    });
});

describe('submitPointClaim', () => {
    it('calls submit_point_claim with the typed values and no proof when none is given', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: [submitRow] } }]);

        const result = await submitPointClaim({ orderNumber: 'ORD-1234', email: 'buyer@example.com' });

        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('submit_point_claim', {
            p_order_number: 'ORD-1234',
            p_email: 'buyer@example.com',
            p_proof_url: null,
            p_note: null,
        });
        expect(result).toEqual({ claimId: 'claim-1', status: 'pending', points: 84, matched: true });
    });

    it('forwards the proof URL and note for an unmatched claim', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: [{ claim_id: 'claim-2', status: 'pending', points: 0, matched: false }] } },
        ]);

        await submitPointClaim({
            orderNumber: 'ORD-1234',
            email: 'buyer@example.com',
            proofUrl: 'https://cdn.example.com/claims/receipt.png',
            note: '  Ordered as a guest in July  ',
        });

        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('submit_point_claim', {
            p_order_number: 'ORD-1234',
            p_email: 'buyer@example.com',
            p_proof_url: 'https://cdn.example.com/claims/receipt.png',
            p_note: 'Ordered as a guest in July',
        });
    });

    it('refuses an over-long note BEFORE the RPC, so nothing is written', async () => {
        await expect(
            submitPointClaim({
                orderNumber: 'ORD-1234',
                email: 'buyer@example.com',
                note: 'x'.repeat(MAX_CLAIM_NOTE_LENGTH + 1),
            }),
        ).rejects.toThrow(/under 1000 characters/);

        expect(mockSupabase.rpcSpy).not.toHaveBeenCalled();
    });

    it('surfaces the duplicate-claim message the RPC raises', async () => {
        mockSupabase.setOutcomes([
            {
                kind: 'resolve',
                value: { error: { message: 'That order already has a claim on it — nothing more to do' } },
            },
        ]);

        await expect(
            submitPointClaim({ orderNumber: 'ORD-1234', email: 'buyer@example.com' }),
        ).rejects.toThrow(/already has a claim/);
    });

    it('throws when the RPC returns no claim id rather than reporting success', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { data: [] } }]);

        await expect(
            submitPointClaim({ orderNumber: 'ORD-1234', email: 'buyer@example.com' }),
        ).rejects.toThrow(/no claim id/);
    });
});

describe('getMyPointClaims', () => {
    it('reads the claim columns from point_claims and maps them for the page', async () => {
        mockSupabase.setOutcomes([
            {
                kind: 'resolve',
                value: {
                    data: [
                        {
                            id: 'claim-1',
                            order_number: 'ORD-1234',
                            matched: true,
                            points: '84',
                            status: 'approved',
                            granted_amount: '84',
                            review_note: 'Confirmed against the order',
                            created_at: '2026-07-05T10:00:00Z',
                            reviewed_at: '2026-07-06T10:00:00Z',
                        },
                    ],
                },
            },
        ]);

        const claims = await getMyPointClaims();

        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('point_claims');
        expect(claims).toEqual([
            {
                id: 'claim-1',
                orderNumber: 'ORD-1234',
                matched: true,
                points: 84,
                status: 'approved',
                grantedAmount: 84,
                reviewNote: 'Confirmed against the order',
                createdAt: '2026-07-05T10:00:00Z',
                reviewedAt: '2026-07-06T10:00:00Z',
            },
        ]);
    });

    it('returns an empty list on a read error instead of failing the page', async () => {
        mockSupabase.setOutcomes([{ kind: 'resolve', value: { error: { message: 'relation does not exist' } } }]);

        await expect(getMyPointClaims()).resolves.toEqual([]);
    });
});
