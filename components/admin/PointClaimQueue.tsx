// components/admin/PointClaimQueue.tsx
//
// The review panel for buyer-filed point claims, mounted in
// Admin → SGCoin Distribution, next to the manual send flow.
//
// WHERE THESE COME FROM
//   /claim — a shopper whose order earned SGCoin but whose balance never saw it
//   (guest checkout, or an order that predates their account). The claim holds
//   what they typed; the order record decides what it is worth.
//
// WHAT A REVIEWER IS ACTUALLY DECIDING
//   Everything needed to be wrong about a claim is on the row: the account email,
//   the email typed as "used on the order", and the email on the matched order.
//   `matched` is the server's verdict on those last two, not a client claim — an
//   unmatched row is a screenshot review, and the proof link is the only evidence
//   that exists for it.
//
// WHY APPROVE IS NOT A BUTTON THAT WRITES A BALANCE
//   It calls /api/admin-point-claims, which calls approve_point_claim: one
//   transaction that mints through grant_sgcoin AND closes the claim. The amount
//   box is empty by default so the common case pays what the order says without
//   the UI restating a number it did not compute.

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Hexagon, RefreshCw, ShieldCheck, Undo2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import {
    approvePointClaim,
    fetchPointClaims,
    rejectPointClaim,
    type PointClaimRow,
} from '../../services/adminPointClaims';

/** Per-claim review inputs, keyed by claim id. */
interface ReviewDraft {
    amount: string;
    note: string;
}

const STATUS_CLASS: Record<PointClaimRow['status'], string> = {
    pending: 'border-yellow-500/30 text-yellow-300',
    approved: 'border-green-500/30 text-green-300',
    rejected: 'border-red-500/30 text-red-300',
};

const PointClaimQueue = () => {
    const { addToast } = useToast();
    const [claims, setClaims] = useState<PointClaimRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyClaimId, setBusyClaimId] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setClaims(await fetchPointClaims());
        } catch (e) {
            setError((e as Error)?.message || 'Failed to load point claims.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const draftFor = (claimId: string): ReviewDraft => drafts[claimId] ?? { amount: '', note: '' };

    const updateDraft = (claimId: string, patch: Partial<ReviewDraft>) =>
        setDrafts((previous) => ({
            ...previous,
            [claimId]: { ...draftFor(claimId), ...patch },
        }));

    const handleApprove = async (claim: PointClaimRow) => {
        const draft = draftFor(claim.id);
        const override = draft.amount.trim();
        let amount: number | null = null;

        if (override) {
            const parsed = Number(override);
            if (!Number.isSafeInteger(parsed) || parsed <= 0) {
                addToast('An override has to be a positive whole number of SGCoin.', 'error');
                return;
            }
            amount = parsed;
        }

        const paying = amount ?? claim.points;
        const memberLabel = claim.memberName || claim.memberEmail || claim.claimantEmail;
        if (
            !window.confirm(
                `Approve this claim?\n\n${paying.toLocaleString()} SGCoin will be credited to ${memberLabel} ` +
                    `for ${claim.orderNumber}. The grant is recorded in the ledger beside every manual send, ` +
                    'and the claim closes with it.',
            )
        ) {
            return;
        }

        setBusyClaimId(claim.id);
        try {
            const result = await approvePointClaim(claim.id, amount, draft.note.trim() || undefined);
            addToast(
                `Credited ${result.granted.toLocaleString()} SGCoin — balance now ${result.balanceAfter.toLocaleString()}`,
                'success',
            );
            // Re-read from the server rather than flipping this row locally: the
            // RPC is the owner of what got granted, and the queue order changes
            // when a pending row becomes a reviewed one.
            await load();
        } catch (e) {
            addToast((e as Error)?.message || 'Failed to approve the claim.', 'error');
        } finally {
            setBusyClaimId(null);
        }
    };

    const handleReject = async (claim: PointClaimRow) => {
        const draft = draftFor(claim.id);
        const reason = window.prompt(
            `Reject the claim for ${claim.orderNumber}?\n\nReason (shown to you, not emailed):`,
            draft.note,
        );
        // null is "cancel", '' is "rejected with no reason" — both are deliberate.
        if (reason === null) return;

        setBusyClaimId(claim.id);
        try {
            await rejectPointClaim(claim.id, reason.trim() || undefined);
            addToast(`Rejected the claim for ${claim.orderNumber}.`, 'success');
            await load();
        } catch (e) {
            addToast((e as Error)?.message || 'Failed to reject the claim.', 'error');
        } finally {
            setBusyClaimId(null);
        }
    };

    const pending = claims.filter((claim) => claim.status === 'pending');
    const reviewed = claims.filter((claim) => claim.status !== 'pending');

    return (
        <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <h3 className="text-lg font-bold">Point Claims</h3>
                    <p className="text-xs text-gray-500">
                        Buyers asking for SGCoin owed on an order — guests, and orders that predate their account.
                        Approving pays through the same grant the ledger records below.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void load()}
                    disabled={isLoading}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div role="status" aria-live="polite" className="sr-only">
                {isLoading ? 'Loading point claims' : `${pending.length} pending claims`}
            </div>

            {isLoading ? (
                <p className="text-center text-gray-500 py-8">Loading point claims…</p>
            ) : error ? (
                <div className="text-center py-8">
                    <p className="text-red-400 text-sm mb-3">{error}</p>
                    <button type="button" onClick={() => void load()} className="text-sm text-white underline">
                        Try again
                    </button>
                </div>
            ) : pending.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                    No pending claims. Buyers file them from <span className="text-gray-300">/claim</span>.
                </p>
            ) : (
                <ul className="divide-y divide-white/5">
                    {pending.map((claim) => {
                        const draft = draftFor(claim.id);
                        const isBusy = busyClaimId === claim.id;
                        return (
                            <li key={claim.id} className="py-4 space-y-3">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <p className="font-bold">{claim.orderNumber}</p>
                                            <span className={`text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${claim.matched ? STATUS_CLASS.approved : STATUS_CLASS.pending}`}>
                                                {claim.matched ? 'Matched order' : 'Needs review'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {new Date(claim.createdAt).toLocaleString()} · files as{' '}
                                            {claim.claimantEmail}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            typed on the order: <span className="text-white">{claim.orderEmail}</span>
                                            {' · '}member:{' '}
                                            <span className="text-white">
                                                {claim.memberName || claim.memberEmail || claim.userId}
                                            </span>
                                        </p>
                                        {claim.note && (
                                            <p className="text-sm text-gray-400 mt-1 break-words">{claim.note}</p>
                                        )}
                                        {claim.proofUrl ? (
                                            <a
                                                href={claim.proofUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-1 inline-flex items-center gap-1 text-xs text-white underline"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                Open attached receipt
                                            </a>
                                        ) : (
                                            claim.matched ? null : (
                                                <p className="mt-1 inline-flex items-center gap-1 text-xs text-yellow-400">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    No receipt attached — there is nothing to verify against.
                                                </p>
                                            )
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 font-bold text-green-400 shrink-0">
                                        <Hexagon className="w-4 h-4 fill-current" />
                                        {claim.points.toLocaleString()}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <label className="sr-only" htmlFor={`claim-amount-${claim.id}`}>
                                        Override amount for {claim.orderNumber}
                                    </label>
                                    <input
                                        id={`claim-amount-${claim.id}`}
                                        type="number"
                                        min={1}
                                        step={1}
                                        inputMode="numeric"
                                        value={draft.amount}
                                        onChange={(e) => updateDraft(claim.id, { amount: e.target.value })}
                                        placeholder={`Override (${claim.points.toLocaleString()})`}
                                        className="w-full sm:w-40 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                                    />
                                    <label className="sr-only" htmlFor={`claim-note-${claim.id}`}>
                                        Review note for {claim.orderNumber}
                                    </label>
                                    <input
                                        id={`claim-note-${claim.id}`}
                                        type="text"
                                        value={draft.note}
                                        onChange={(e) => updateDraft(claim.id, { note: e.target.value })}
                                        placeholder="Review note (optional)"
                                        className="w-full flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                                    />
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => void handleApprove(claim)}
                                            disabled={isBusy}
                                            aria-label={`Approve the claim for ${claim.orderNumber}`}
                                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-300 rounded-lg px-3 py-2 transition disabled:opacity-40"
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            {isBusy ? 'Working…' : 'Approve'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleReject(claim)}
                                            disabled={isBusy}
                                            aria-label={`Reject the claim for ${claim.orderNumber}`}
                                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 rounded-lg px-3 py-2 transition disabled:opacity-40"
                                        >
                                            <Undo2 className="w-3.5 h-3.5" />
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {reviewed.length > 0 && (
                <div className="mt-6 border-t border-white/10 pt-4">
                    <h4 className="text-sm font-bold text-gray-300">Recently reviewed</h4>
                    <ul className="mt-2 divide-y divide-white/5">
                        {reviewed.slice(0, 10).map((claim) => (
                            <li key={claim.id} className="py-2 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm truncate">
                                        {claim.orderNumber}
                                        <span className="text-gray-500"> · {claim.claimantEmail}</span>
                                    </p>
                                    {claim.reviewNote && (
                                        <p className="text-xs text-gray-500 break-words">{claim.reviewNote}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-sm text-gray-300">
                                        {claim.status === 'approved' && claim.grantedAmount != null
                                            ? `+${claim.grantedAmount.toLocaleString()}`
                                            : '—'}
                                    </span>
                                    <span className={`text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${STATUS_CLASS[claim.status]}`}>
                                        {claim.status}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default PointClaimQueue;
