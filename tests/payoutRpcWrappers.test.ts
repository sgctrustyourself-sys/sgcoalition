// tests/payoutRpcWrappers.test.ts
//
// Lock the public surface of services/payoutRequest.ts -- the TS wrapper layer
// that the admin UI + customer tab call into. Mocks services/supabase via the
// shared makeSupabaseClient helper (setOutcomes consumer queue covers both
// supabase.rpc(...) calls AND the chained supabase.from(...).select(...) reads
// used by getAllPayoutRequests / getUserPayoutRequests).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockSupabase } from './_helpers/supabaseClientMock';

vi.mock('../services/supabase', () => ({ supabase: mockSupabase.client }));

import {
    submitPayoutRequest,
    approvePayoutRequest,
    completePayoutRequest,
    rejectPayoutRequest,
    getAllPayoutRequests,
    getUserPayoutRequests,
    getPayoutRequestById,
    MIN_PAYOUT_SGC,
} from '../services/payoutRequest';

const sampleRow = {
    id: 'req1',
    user_id: 'u1',
    email: 'a@b.com',
    wallet_address: '0xABC',
    amount: 10000,
    status: 'pending',
    tx_hash: null,
    rejection_reason: null,
    admin_id: null,
    admin_notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    processed_at: null,
};

beforeEach(() => {
    mockSupabase.setOutcomes([]);
    vi.clearAllMocks();
});

// ============================================
// MIN_PAYOUT_SGC pin
// ============================================

describe('MIN_PAYOUT_SGC', () => {
    it('equals 5000 (matches the SQL CHECK constraint in the migration)', () => {
        expect(MIN_PAYOUT_SGC).toBe(5000);
    });
});

// ============================================
// submitPayoutRequest
// ============================================

describe('submitPayoutRequest', () => {
    it('throws BEFORE contacting supabase when amount is below MIN_PAYOUT_SGC', async () => {
        await expect(
            submitPayoutRequest({ email: 'a@b.com', walletAddress: '0xABC', amount: 4999 }),
        ).rejects.toThrow(/Minimum payout is/);
        expect(mockSupabase.rpcSpy).not.toHaveBeenCalled();
    });

    it('calls submit_payout_request RPC with parsed snake_case args', async () => {
        // First await resolves the insert RPC, second awaits the re-fetch by id
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { data: 'req1' } },
            { kind: 'resolve', value: { data: sampleRow } },
        ]);
        const result = await submitPayoutRequest({
            email: 'a@b.com', walletAddress: '0xABC', amount: 6000,
        });
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('submit_payout_request', {
            p_email: 'a@b.com',
            p_wallet_address: '0xABC',
            p_amount: 6000,
        });
        expect(mockSupabase.singleSpy).toHaveBeenCalled();
        expect(result.email).toBe('a@b.com');
    });

    it('throws when the insert RPC returns an error', async () => {
        mockSupabase.setOutcomes([
            { kind: 'resolve', value: { error: { message: 'Insufficient balance' } } },
        ]);
        await expect(
            submitPayoutRequest({ email: 'a@b.com', walletAddress: '0xABC', amount: 6000 }),
        ).rejects.toThrow(/Insufficient balance/);
    });

    it('propagates the 23505 unique-violation from the one-pending-per-user index', async () => {
        // Defense-in-depth: the UNIQUE INDEX idx_sgcoin_payout_requests_one_pending_per_user
        // raises PostgresError 23505 when a customer tries to submit a 2nd pending
        // payout. The service wrapper re-throws the supabase error unchanged so the
        // customer-facing UI can show "you already have a pending request" without
        // a translation layer.
        mockSupabase.setOutcomes({
            kind: 'resolve',
            value: { error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "idx_sgcoin_payout_requests_one_pending_per_user"',
            } },
        });
        await expect(
            submitPayoutRequest({ email: 'a@b.com', walletAddress: '0xABC', amount: 6000 }),
        ).rejects.toThrow(/unique constraint/);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledTimes(1);
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('submit_payout_request', {
            p_email: 'a@b.com',
            p_wallet_address: '0xABC',
            p_amount: 6000,
        });
    });
});

// ============================================
// approvePayoutRequest
// ============================================

describe('approvePayoutRequest', () => {
    it('calls approve_payout_request RPC + returns boolean true', async () => {
        mockSupabase.setOutcomes({ kind: 'resolve', value: { data: true } });
        const result = await approvePayoutRequest('req1', 'admin1');
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('approve_payout_request', {
            p_request_id: 'req1',
            p_admin_id: 'admin1',
        });
        expect(result).toBe(true);
    });

    it('throws on supabase error (does NOT swallow it like getAllPayoutRequests)', async () => {
        mockSupabase.setOutcomes({
            kind: 'resolve', value: { error: { message: 'Only admins may approve' } },
        });
        await expect(approvePayoutRequest('req1', 'admin1'))
            .rejects.toThrow(/Only admins may approve/);
    });
});

// ============================================
// completePayoutRequest
// ============================================

describe('completePayoutRequest', () => {
    it('passes tx_hash + admin_notes (null when omitted) into complete_payout_request RPC', async () => {
        mockSupabase.setOutcomes({ kind: 'resolve', value: { data: true } });
        await completePayoutRequest('req1', 'admin1', '0xabcdef1234567890');
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('complete_payout_request', {
            p_request_id: 'req1',
            p_admin_id: 'admin1',
            p_tx_hash: '0xabcdef1234567890',
            p_admin_notes: null,
        });
    });

    it('passes admin_notes when supplied', async () => {
        mockSupabase.setOutcomes({ kind: 'resolve', value: { data: true } });
        await completePayoutRequest('req1', 'admin1', '0xabcdef1234567890', 'sent to treasury');
        expect(mockSupabase.rpcSpy.mock.calls[0][1].p_admin_notes).toBe('sent to treasury');
    });
});

// ============================================
// rejectPayoutRequest
// ============================================

describe('rejectPayoutRequest', () => {
    it('calls reject_payout_request RPC with reason', async () => {
        mockSupabase.setOutcomes({ kind: 'resolve', value: { data: false } });
        const result = await rejectPayoutRequest('req1', 'admin1', 'invalid wallet');
        expect(mockSupabase.rpcSpy).toHaveBeenCalledWith('reject_payout_request', {
            p_request_id: 'req1',
            p_admin_id: 'admin1',
            p_reason: 'invalid wallet',
        });
        expect(result).toBe(false);
    });
});

// ============================================
// getAllPayoutRequests (table read, NOT rpc)
// ============================================

describe('getAllPayoutRequests', () => {
    it('queries sgcoin_payout_requests table + maps rows to camelCase', async () => {
        mockSupabase.setOutcomes({ kind: 'resolve', value: { data: [sampleRow] } });
        const result = await getAllPayoutRequests();
        expect(mockSupabase.fromSpy).toHaveBeenCalledWith('sgcoin_payout_requests');
        expect(result[0].walletAddress).toBe('0xABC');
        expect(result[0].txHash).toBe(null);
        expect(result[0].amount).toBe(10000);
    });

    it('appends status filter when provided', async () => {
        mockSupabase.setOutcomes({ kind: 'resolve', value: { data: [sampleRow] } });
        await getAllPayoutRequests('pending');
        expect(mockSupabase.eqSpy).toHaveBeenCalledWith('status', 'pending');
    });

    it('returns empty array (does NOT throw) on supabase error', async () => {
        mockSupabase.setOutcomes({
            kind: 'resolve', value: { error: { message: 'RLS denied' } },
        });
        const result = await getAllPayoutRequests();
        expect(result).toEqual([]);
    });
});

// ============================================
// getUserPayoutRequests (customer view, filtered by userId)
// ============================================

describe('getUserPayoutRequests', () => {
    it('filters by user_id + returns mapped rows', async () => {
        mockSupabase.setOutcomes({ kind: 'resolve', value: { data: [sampleRow] } });
        const result = await getUserPayoutRequests('u1');
        expect(mockSupabase.eqSpy).toHaveBeenCalledWith('user_id', 'u1');
        expect(result[0].userId).toBe('u1');
    });
});

// ============================================
// getPayoutRequestById
// ============================================

describe('getPayoutRequestById', () => {
    it('returns null on supabase error (does not throw)', async () => {
        mockSupabase.setOutcomes({
            kind: 'resolve', value: { error: { message: 'not found' } },
        });
        const result = await getPayoutRequestById('missing');
        expect(result).toBe(null);
    });

    it('returns the mapped row on success', async () => {
        mockSupabase.setOutcomes({ kind: 'resolve', value: { data: sampleRow } });
        const result = await getPayoutRequestById('req1');
        expect(result).not.toBe(null);
        expect(result!.id).toBe('req1');
        expect(result!.walletAddress).toBe('0xABC');
    });
});
