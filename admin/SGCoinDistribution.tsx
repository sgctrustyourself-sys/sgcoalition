import React, { useState, useEffect } from 'react';
import { Hexagon, Send, Search, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import {
    ADMIN_SESSION_EXPIRED_ERROR,
    getAdminAuthHeaders,
    handleAdminAuthFailure,
} from '../services/adminSession';

/**
 * A row from GET /api/admin-sgcoin-members (public.profiles).
 *
 * Deliberately NOT the shared UserProfile type: that one describes the signed-in
 * browser user (uid, favorites, wallet, isAdmin) and is assembled client-side.
 * This is a server-shaped roster entry, and the balance here is the authoritative
 * profiles.sg_coin_balance.
 */
interface SgcoinMember {
    userId: string;
    name: string | null;
    email: string | null;
    sgCoinBalance: number;
}

interface Allocation {
    totalSales: number;
    totalOrders: number;
    sgcoinAllocationCents: number;
    allocationPercentage: number;
    note: string;
}

interface V2Rate {
    v2PerUsd: number;
    usdPerV2: number;
    note: string;
}

/** A row from GET /api/admin-sgcoin-grants (public.sgcoin_admin_grants). */
interface GrantHistoryEntry {
    id: string;
    userId: string;
    memberName: string | null;
    memberEmail: string | null;
    amount: number;
    note: string | null;
    balanceAfter: number;
    createdAt: string;
}

/** Read the JSON error body without letting a non-JSON response mask the status. */
async function readError(response: Response, fallback: string): Promise<string> {
    try {
        const body = (await response.json()) as { error?: string };
        return body?.error || fallback;
    } catch {
        return fallback;
    }
}

const SGCoinDistribution = () => {
    const { addToast } = useToast();

    const [members, setMembers] = useState<SgcoinMember[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(true);
    const [membersError, setMembersError] = useState<string | null>(null);

    // Allocation + rate are server reads, so they live in state. They used to
    // live in refs written inside the fetch — a ref write does not re-render, so
    // the cards could never appear even when the data arrived.
    const [allocation, setAllocation] = useState<Allocation | null>(null);
    const [rate, setRate] = useState<V2Rate | null>(null);

    const [grants, setGrants] = useState<GrantHistoryEntry[]>([]);
    const [isLoadingGrants, setIsLoadingGrants] = useState(true);
    const [grantsError, setGrantsError] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [isSending, setIsSending] = useState(false);

    const selectedUser = members.find((member) => member.userId === selectedUserId) || null;

    const loadMembers = async () => {
        setIsLoadingMembers(true);
        setMembersError(null);
        try {
            const response = await fetch('/api/admin-sgcoin-members', {
                headers: getAdminAuthHeaders(),
            });
            if (handleAdminAuthFailure(response.status)) {
                setMembersError(ADMIN_SESSION_EXPIRED_ERROR);
                return;
            }
            if (!response.ok) {
                setMembersError(await readError(response, 'Failed to load members.'));
                return;
            }
            const data = (await response.json()) as { members?: SgcoinMember[] };
            setMembers(Array.isArray(data.members) ? data.members : []);
        } catch (error) {
            setMembersError(error instanceof Error ? error.message : 'Failed to load members.');
        } finally {
            setIsLoadingMembers(false);
        }
    };

    const loadGrants = async () => {
        setIsLoadingGrants(true);
        setGrantsError(null);
        try {
            const response = await fetch('/api/admin-sgcoin-grants', {
                headers: getAdminAuthHeaders(),
            });
            if (handleAdminAuthFailure(response.status)) {
                setGrantsError(ADMIN_SESSION_EXPIRED_ERROR);
                return;
            }
            if (!response.ok) {
                setGrantsError(await readError(response, 'Failed to load grant history.'));
                return;
            }
            const data = (await response.json()) as { grants?: GrantHistoryEntry[] };
            setGrants(Array.isArray(data.grants) ? data.grants : []);
        } catch (error) {
            setGrantsError(error instanceof Error ? error.message : 'Failed to load grant history.');
        } finally {
            setIsLoadingGrants(false);
        }
    };

    useEffect(() => {
        void loadMembers();
        void loadGrants();
    }, []);

    // The two read-only cards are independent of the roster: a failure in either
    // must not blank the picker, so each fetch settles on its own.
    useEffect(() => {
        let cancelled = false;

        fetch('/api/sgcoin-allocation', { headers: getAdminAuthHeaders() })
            .then((response) => (response.ok ? response.json() : null))
            .then((data: Allocation | null) => {
                if (!cancelled && data) setAllocation(data);
            })
            .catch((error) => console.error('Failed to fetch sgcoin allocation:', error));

        fetch('/api/sgcoin-v2-rate', { headers: getAdminAuthHeaders() })
            .then((response) => (response.ok ? response.json() : null))
            .then((data: V2Rate | null) => {
                if (!cancelled && data) setRate(data);
            })
            .catch((error) => console.error('Failed to fetch sgcoin V2 rate:', error));

        return () => {
            cancelled = true;
        };
    }, []);

    const filteredUsers = members.filter((member) => {
        const query = searchQuery.toLowerCase();
        return (
            (member.name || '').toLowerCase().includes(query) ||
            (member.email || '').toLowerCase().includes(query) ||
            member.userId.toLowerCase().includes(query)
        );
    });

    const handleSendSGCoin = async () => {
        if (!selectedUser) {
            addToast('Please select a member', 'warning');
            return;
        }
        const grantAmount = Number(amount);
        if (!Number.isSafeInteger(grantAmount) || grantAmount <= 0) {
            addToast('Enter a whole number of SGCoin greater than zero', 'warning');
            return;
        }

        setIsSending(true);
        try {
            const response = await fetch('/api/admin-sgcoin-grant', {
                method: 'POST',
                headers: { ...getAdminAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedUser.userId,
                    amount: grantAmount,
                    note: note.trim(),
                }),
            });

            if (handleAdminAuthFailure(response.status)) {
                addToast(ADMIN_SESSION_EXPIRED_ERROR, 'error');
                return;
            }
            if (!response.ok) {
                addToast(await readError(response, 'Failed to send SGCoin'), 'error');
                return;
            }

            const result = (await response.json()) as { userId: string; balanceAfter: number };

            // Render the balance the server committed, not `old + amount`: the
            // server is the only place that knows the post-grant balance if two
            // grants raced.
            setMembers((previous) =>
                previous.map((member) =>
                    member.userId === result.userId
                        ? { ...member, sgCoinBalance: result.balanceAfter }
                        : member,
                ),
            );

            addToast(
                `Sent ${grantAmount.toLocaleString()} SGCoin to ${selectedUser.name || selectedUser.email || 'member'}`,
                'success',
            );
            setAmount('');
            setNote('');
            // Re-read the ledger rather than prepending locally: the server decides
            // the final balance and timestamp, and a second operator may have granted
            // since this page loaded.
            void loadGrants();
        } catch (error) {
            addToast(error instanceof Error ? error.message : 'Failed to send SGCoin', 'error');
        } finally {
            setIsSending(false);
        }
    };

    const totalSGCoinDistributed = members.reduce((sum, member) => sum + (member.sgCoinBalance || 0), 0);
    const usersWithBalance = members.filter((member) => (member.sgCoinBalance || 0) > 0).length;
    const canSend = !!selectedUser && Number(amount) > 0 && !isSending;

    return (
        <div className="space-y-8">
            {/* Allocation from past sales note */}
            {allocation && (
                <div className="bg-gray-900 border border-white/10 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-bold text-green-400 mb-2">SGCoin Allocation from Past Sales</h3>
                    <p className="text-sm text-gray-300 line-clamp-4">{allocation.note}</p>
                    <p className="text-xs text-gray-500">
                        Based on {allocation.totalOrders} orders,{' '}
                        {(Number.isFinite(allocation.allocationPercentage)
                            ? allocation.allocationPercentage
                            : 0
                        ).toFixed(1)}
                        % of sales allocated to SGCoin distribution fund.
                    </p>
                </div>
            )}

            {/* SGCoin V2 → USD rate */}
            {rate && (
                <div className="bg-gray-900 border border-white/10 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-bold text-purple-400 mb-2">SGCOIN V2 → USD Rate</h3>
                    <p className="text-sm text-gray-300 line-clamp-2">{rate.note}</p>
                    <p className="text-xs text-gray-500">
                        {rate.v2PerUsd} V2 = $1 USD (1 V2 = ${Number(rate.usdPerV2).toFixed(2)} USD)
                    </p>
                </div>
            )}

            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold mb-2">SGCoin Distribution</h2>
                    <p className="text-gray-400 text-sm">Send SGCoin directly to member balances</p>
                </div>
                <button
                    type="button"
                    onClick={() => void loadMembers()}
                    disabled={isLoadingMembers}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoadingMembers ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/10 border border-blue-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <Users className="w-6 h-6 text-blue-500" />
                    </div>
                    <p className="text-sm text-gray-400 mb-1">Total Members</p>
                    <p className="text-2xl font-bold">{members.length}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <Hexagon className="w-6 h-6 text-green-500" />
                    </div>
                    {/* Outstanding balance across the roster, not "minted by this
                        tab": members also earn SGCoin from orders. */}
                    <p className="text-sm text-gray-400 mb-1">Total in Member Balances</p>
                    <p className="text-2xl font-bold">{totalSGCoinDistributed.toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <TrendingUp className="w-6 h-6 text-purple-500" />
                    </div>
                    <p className="text-sm text-gray-400 mb-1">Members with Balance</p>
                    <p className="text-2xl font-bold">{usersWithBalance}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* User Selection */}
                <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4">Select Member</h3>

                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search by name, email, or id..."
                            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    {/* Member List */}
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {isLoadingMembers ? (
                            <p className="text-center text-gray-500 py-8">Loading members…</p>
                        ) : membersError ? (
                            <div className="text-center py-8">
                                <p className="text-red-400 text-sm mb-3">{membersError}</p>
                                <button
                                    type="button"
                                    onClick={() => void loadMembers()}
                                    className="text-sm text-white underline"
                                >
                                    Try again
                                </button>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No members found</p>
                        ) : (
                            filteredUsers.map((member) => (
                                <button
                                    key={member.userId}
                                    type="button"
                                    onClick={() => setSelectedUserId(member.userId)}
                                    className={`w-full text-left p-4 rounded-lg border transition ${
                                        selectedUserId === member.userId
                                            ? 'bg-blue-500/10 border-blue-500/20'
                                            : 'bg-black/30 border-white/10 hover:bg-white/5'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-bold">{member.name || 'Anonymous'}</p>
                                            <p className="text-sm text-gray-400">
                                                {member.email || member.userId}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center gap-1 text-brand-accent">
                                                <Hexagon className="w-4 h-4 fill-current" />
                                                <span className="font-bold">
                                                    {(member.sgCoinBalance || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Send Form */}
                <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                    <h3 className="text-lg font-bold mb-4">Send SGCoin</h3>

                    {selectedUser ? (
                        <div className="space-y-4">
                            {/* Selected User Info */}
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                <p className="text-sm text-gray-400 mb-1">Sending to:</p>
                                <p className="font-bold text-lg">{selectedUser.name || 'Anonymous'}</p>
                                <p className="text-sm text-gray-400">
                                    {selectedUser.email || selectedUser.userId}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <p className="text-sm text-gray-400">Current Balance:</p>
                                    <div className="flex items-center gap-1 text-brand-accent font-bold">
                                        <Hexagon className="w-4 h-4 fill-current" />
                                        {(selectedUser.sgCoinBalance || 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Amount Input */}
                            <div>
                                <label className="block text-sm font-bold mb-2">Amount (SGCoin)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(event) => setAmount(event.target.value)}
                                    placeholder="Enter amount..."
                                    min="1"
                                    step="1"
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Note Input */}
                            <div>
                                <label className="block text-sm font-bold mb-2">Note (Optional)</label>
                                <textarea
                                    value={note}
                                    onChange={(event) => setNote(event.target.value)}
                                    placeholder="Reason for distribution..."
                                    rows={3}
                                    maxLength={280}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none resize-none"
                                />
                            </div>

                            {/* Send Button */}
                            <button
                                type="button"
                                onClick={() => void handleSendSGCoin()}
                                disabled={!canSend}
                                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-5 h-5" />
                                {isSending ? 'Sending…' : `Send ${amount || '0'} SGCoin`}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-500">
                            <Hexagon className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                            <p>Select a member to send SGCoin</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Grant history — the ledger row grant_sgcoin() writes with the
                balance update, so a distribution is reviewable after the toast. */}
            <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h3 className="text-lg font-bold">Recent Grants</h3>
                        <p className="text-xs text-gray-500">Newest first</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadGrants()}
                        disabled={isLoadingGrants}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoadingGrants ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {isLoadingGrants ? (
                    <p className="text-center text-gray-500 py-8">Loading grants…</p>
                ) : grantsError ? (
                    <div className="text-center py-8">
                        <p className="text-red-400 text-sm mb-3">{grantsError}</p>
                        <button
                            type="button"
                            onClick={() => void loadGrants()}
                            className="text-sm text-white underline"
                        >
                            Try again
                        </button>
                    </div>
                ) : grants.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                        No grants yet. Every send from this tab is recorded here.
                    </p>
                ) : (
                    <ul className="divide-y divide-white/5">
                        {grants.map((grant) => (
                            <li
                                key={grant.id}
                                className="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
                            >
                                <div className="min-w-0">
                                    <p className="font-bold truncate">
                                        {grant.memberName || grant.memberEmail || grant.userId}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {new Date(grant.createdAt).toLocaleString()} · balance after{' '}
                                        {grant.balanceAfter.toLocaleString()}
                                    </p>
                                    {grant.note && (
                                        <p className="text-sm text-gray-400 mt-1 break-words">
                                            {grant.note}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 text-green-400 font-bold shrink-0">
                                    <Hexagon className="w-4 h-4 fill-current" />
                                    +{grant.amount.toLocaleString()}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default SGCoinDistribution;
