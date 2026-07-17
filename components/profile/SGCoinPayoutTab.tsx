// components/profile/SGCoinPayoutTab.tsx
//
// CUSTOMER-FACING SGCOIN PAYOUT DASHBOARD.
//
// Wired into pages/Profile.tsx via `React.lazy(() => import('../components/profile/SGCoinPayoutTab'))`.
// Props API is fixed by the consumer: `{ userId, balance }`. The profile's account-linking
// wallet (`user.connectedWalletAddress`) takes priority over the session-bound MetaMask
// wallet (`user.walletAddress`) when prefilling the modal's address field, because the
// account-linking wallet represents explicit, persistent user intent.
//
// DEFAULT behavior is the left action card (clothing discount at checkout). The crypto
// payout (right action card) is opt-in only. All status transitions are handled by the
// SECURITY DEFINER RPCs in supabase/migrations/20260716_create_sgcoin_payout_requests.sql;
// this component only ever calls submit_payout_request (one-pending-per-user enforced
// server-side) and SELECTs the user's own rows.
//
// All amounts are whole-number SGC (no decimals). The MIN_PAYOUT_SGC floor (5,000 SGC) is
// enforced client-side for instant feedback + server-side via the UNIQUE INDEX + RPC check.

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Hexagon,
    DollarSign,
    Wallet,
    Clock,
    CheckCircle2,
    CheckCircle,
    X,
    AlertCircle,
    Copy,
    ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import {
    submitPayoutRequest,
    getUserPayoutRequests,
    MIN_PAYOUT_SGC,
    PayoutRequest,
} from '../../services/payoutRequest';
import { sendAdminPayoutNotification } from '../../services/emailService';
import { connectWallet, formatAddress } from '../../services/web3Service';

// Canonical USD rate per SGCoin (matches the rate Profile.tsx header card uses).
// TODO: extract to constants.ts and reuse across all UI surfaces.
const SGC_USD_RATE = 0.002;

// Polygon address validation regex (matches Profile.tsx Wallet Settings card).
const POLYGON_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// DOM id for the inner modal container — used by the focus-trap keydown
// listener to scope Tab cycling to elements inside the modal.
const MODAL_ROOT_ID = 'sgcoin-payout-modal-content';

// Quick-select percentage chips inside the modal amount picker.
const AMOUNT_PRESETS = [25, 50, 75, 100] as const;

// Visual treatment for each payout-request status (4 statuses × color + icon).
const STATUS_STYLES: Record<
    PayoutRequest['status'],
    { bg: string; text: string; ring: string; icon: React.ReactNode; label: string }
> = {
    pending: {
        bg: 'bg-yellow-50',
        text: 'text-yellow-800',
        ring: 'border-yellow-200',
        icon: <Clock className="w-4 h-4" />,
        label: 'Pending review',
    },
    approved: {
        bg: 'bg-blue-50',
        text: 'text-blue-800',
        ring: 'border-blue-200',
        icon: <CheckCircle2 className="w-4 h-4" />,
        label: 'Approved',
    },
    completed: {
        bg: 'bg-green-50',
        text: 'text-green-800',
        ring: 'border-green-200',
        icon: <CheckCircle className="w-4 h-4" />,
        label: 'Completed',
    },
    rejected: {
        bg: 'bg-red-50',
        text: 'text-red-800',
        ring: 'border-red-200',
        icon: <X className="w-4 h-4" />,
        label: 'Rejected',
    },
};

interface SGCoinPayoutTabProps {
    userId: string;
    balance: number;
}

const SGCoinPayoutTab: React.FC<SGCoinPayoutTabProps> = ({ userId, balance }) => {
    const { user } = useApp();
    const { addToast } = useToast();

    // History state
    const [requests, setRequests] = useState<PayoutRequest[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    // Amount-input ref (used by the modal a11y useEffect for autofocus + Escape close).
    const amountInputRef = useRef<HTMLInputElement>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [amountStr, setAmountStr] = useState('');
    const [address, setAddress] = useState('');
    const [disclaimerChecked, setDisclaimerChecked] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copyHint, setCopyHint] = useState<string | null>(null);

    // Refetch the user's payout-requests history (called on mount + after submit).
    const refetchRequests = useCallback(async () => {
        try {
            const rows = await getUserPayoutRequests(userId);
            setRequests(rows);
        } catch (err: any) {
            console.error('Failed to load payout requests:', err);
            addToast('Could not load payout history.', 'error');
        } finally {
            setIsLoadingHistory(false);
        }
    }, [userId, addToast]);

    useEffect(() => {
        refetchRequests();
    }, [refetchRequests]);

    // (a) Focus the amount input synchronously when the modal opens (no flicker).
    useLayoutEffect(() => {
        if (!isModalOpen) return;
        amountInputRef.current?.focus();
    }, [isModalOpen]);

    // (b) Body scroll-lock + Escape close + focus-trap while the modal is open.
    // Document-level keydown listener (rather than backdrop onKeyDown) avoids
    // tabIndex hacks on a plain div.
    useEffect(() => {
        if (!isModalOpen) return;

        // Body scroll lock so the page behind doesn't scroll while modal is open.
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const focusablesIn = (root: HTMLElement | null): HTMLElement[] => {
            if (!root) return [];
            return Array.from(
                root.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
            );
        };

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSubmitting) {
                setIsModalOpen(false);
                return;
            }
            if (e.key === 'Tab') {
                const modalRoot = document.getElementById(MODAL_ROOT_ID);
                const focusables = focusablesIn(modalRoot);
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', onKey);

        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', onKey);
        };
    }, [isModalOpen, isSubmitting]);

    // When the modal opens, prefill the address from the user's persistent linked wallet
    // (account-linking) or, fall back to the session-bound MetaMask wallet. The AccountLinking
    // wallet wins because it represents explicit persistent user intent. If neither is set,
    // leave the field blank — the user types/pastes one manually.
    useEffect(() => {
        if (!isModalOpen) return;
        const prefill =
            user?.connectedWalletAddress ||
            user?.walletAddress ||
            '';
        setAmountStr('');
        setAddress(prefill);
        setDisclaimerChecked(false);
        setCopyHint(null);
    }, [isModalOpen, user?.connectedWalletAddress, user?.walletAddress]);

    const canSubmit =
        Number(amountStr) >= MIN_PAYOUT_SGC &&
        Number(amountStr) <= balance &&
        POLYGON_ADDRESS_REGEX.test(address) &&
        disclaimerChecked &&
        !isSubmitting;

    // Trigger MetaMask connection (eth_requestAccounts) and prefill the modal address
    // with the freshly connected wallet. Returns silently if MetaMask is missing or the
    // user rejects the prompt.
    const handleConnectMetaMask = useCallback(async () => {
        try {
            const data = await connectWallet();
            if (data?.address) {
                setAddress(data.address);
                addToast('MetaMask wallet connected to payout form.', 'success');
            } else {
                addToast('MetaMask connection cancelled.', 'warning');
            }
        } catch (err: any) {
            console.error('MetaMask connect error:', err);
            addToast(err?.message || 'MetaMask connection failed.', 'error');
        }
    }, [addToast]);

    const handleSubmit = useCallback(async () => {
        if (!canSubmit) return;
        setIsSubmitting(true);
        try {
            // Defensive: clamp the requested amount to the available balance to avoid an
            // RPC overflow if the balance drops between modal-open and submit.
            // Math.floor + NaN guard prevents non-numeric input from reaching the RPC.
            const numericAmount = Math.floor(Number(amountStr) || 0);
            const amount = Math.max(0, Math.min(numericAmount, balance));

            // Defense-in-depth: if all 3 user-email identifies are blank (e.g.,
            // anonymous MetaMask user with no profile row), throw a clear error.
            // We deliberately do NOT use a sentinel email like userId@sgcoalition.invalid
            // because RFC 2606 reserves the .invalid TLD — services/emailService.ts would
            // silently drop admin + customer notifications, leaving the payout request
            // dangling with no audit trail in anyone's inbox.
            const email = user?.email || user?.displayName || user?.walletAddress;
            if (!email) {
                console.warn(
                    'SGCoinPayoutTab: no email identifier for user',
                    user?.uid ?? userId,
                );
                throw new Error(
                    'No email identifier on your account. Please reconnect or contact support before requesting a payout.',
                );
            }

            const created = await submitPayoutRequest({
                email,
                walletAddress: address,
                amount,
            });

            // Fire-and-forget admin heads-up email — don't block the UX on
            // Resend API latency. If the admin notification fails, the request
            // is still in the queue (the Pending row was already committed).
            sendAdminPayoutNotification(email, amount, address, created.id).catch(
                (notifyErr: any) =>
                    console.error(
                        'Admin payout notification email failed (non-blocking):',
                        notifyErr,
                    ),
            );

            addToast(
                `Payout request submitted: ${amount.toLocaleString()} SGC → ${formatAddress(address)}`,
                'success',
            );
            setIsModalOpen(false);
            setIsLoadingHistory(true);
            await refetchRequests();
        } catch (err: any) {
            console.error('Submit payout failed:', err);
            // Surface the RPC error message verbatim — important for the unique-pending
            // constraint case ("Only one pending request allowed per user.").
            addToast(
                err?.message || 'Payout submission failed. Please try again.',
                'error',
                5000,
            );
        } finally {
            setIsSubmitting(false);
        }
    }, [canSubmit, amountStr, balance, user, userId, address, addToast, refetchRequests]);

    return (
        <div>
            {/* ============================================================ */}
            {/* HERO BALANCE CARD                                             */}
            {/* ============================================================ */}
            <div className="bg-gradient-to-br from-black to-gray-900 text-white rounded-2xl p-8 mb-8 relative overflow-hidden border border-white/10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent opacity-15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-bold">
                        Available SGCOIN
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                        <Hexagon className="w-12 h-12 text-brand-accent fill-current" />
                        <div className="text-5xl font-bold font-display">
                            {balance.toLocaleString()}
                        </div>
                    </div>
                    <div className="text-sm text-gray-400">
                        ≈ ${(balance * SGC_USD_RATE).toFixed(2)} USD @{' '}
                        ${SGC_USD_RATE}/SGC
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* TWO ACTION CARDS (DISCOUNT DEFAULT vs. CRYPTO PAYOUT)        */}
            {/* ============================================================ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* LEFT — Discount (default) */}
                <Link
                    to="/shop"
                    className="group bg-white border-2 border-gray-200 hover:border-brand-accent rounded-2xl p-6 transition-all hover:shadow-lg"
                >
                    <div className="text-3xl mb-3">🛍️</div>
                    <h3 className="font-display text-lg font-bold uppercase tracking-wide mb-2 group-hover:text-brand-accent transition-colors">
                        Use for Clothing Discount
                    </h3>
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent bg-brand-accent/10 rounded-full px-2 py-1 mb-3">
                        Default
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Apply SGCOIN automatically at checkout for up to{' '}
                        <strong>10% off</strong> SGCoalition items. Best value for
                        most customers.
                    </p>
                </Link>

                {/* RIGHT — Crypto Payout (opt-in) */}
                <button
                    type="button"
                    onClick={() => setIsModalOpen(true)}
                    disabled={balance < MIN_PAYOUT_SGC}
                    aria-disabled={balance < MIN_PAYOUT_SGC}
                    title={
                        balance < MIN_PAYOUT_SGC
                            ? `Minimum payout is ${MIN_PAYOUT_SGC.toLocaleString()} SGCoin (you have ${balance.toLocaleString()})`
                            : 'Open the SGCOIN crypto-payout request form'
                    }
                    className={`group text-left bg-gradient-to-br from-brand-accent/10 to-yellow-500/10 border-2 rounded-2xl p-6 transition-all ${
                        balance < MIN_PAYOUT_SGC
                            ? 'border-gray-200 opacity-60 cursor-not-allowed'
                            : 'border-brand-accent hover:shadow-lg hover:scale-[1.01]'
                    }`}
                >
                    <div className="text-3xl mb-3">💸</div>
                    <h3 className="font-display text-lg font-bold uppercase tracking-wide mb-2">
                        Request Crypto Payout
                    </h3>
                    <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white bg-black/70 rounded-full px-2 py-1 mb-3">
                        Optional
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                        Withdraw SGCOIN as Polygon cryptocurrency to your own wallet.
                        Minimum{' '}
                        <strong>{MIN_PAYOUT_SGC.toLocaleString()} SGC</strong>. Admin
                        review required.
                    </p>
                    {balance < MIN_PAYOUT_SGC && (
                        <p className="mt-3 text-xs text-red-700">
                            Minimum payout is {MIN_PAYOUT_SGC.toLocaleString()} SGCoin
                            (you have {balance.toLocaleString()})
                        </p>
                    )}
                </button>
            </div>

            {/* ============================================================ */}
            {/* INFO NOTICE                                                   */}
            {/* ============================================================ */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-8 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 leading-relaxed">
                    Your SGCOIN is automatically stored in your SGCoalition account and
                    is intended to be used for clothing discounts. If you would prefer
                    to receive your SGCOIN as cryptocurrency, you must submit a manual
                    payout request. Until requested, your SGCOIN will remain available
                    for discounts on future purchases.
                </div>
            </div>

            {/* ============================================================ */}
            {/* PAYOUT HISTORY / PENDING                                       */}
            {/* ============================================================ */}
            <div>
                <h3 className="font-display text-xl font-bold uppercase mb-4">
                    Payout History
                </h3>

                {isLoadingHistory ? (
                    <div className="space-y-3 animate-pulse" aria-busy="true">
                        <div className="h-16 bg-gray-100 rounded-xl" />
                        <div className="h-16 bg-gray-100 rounded-xl" />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
                        <Wallet className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">
                            No payout requests yet. Your balance remains available for
                            store discounts.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {requests.map((r) => {
                            const style = STATUS_STYLES[r.status];
                            return (
                                <div
                                    key={r.id}
                                    className={`border ${style.ring} ${style.bg} rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className={`p-1.5 rounded-full ${style.text} bg-white/60`}>
                                            {style.icon}
                                        </span>
                                        <div className="min-w-0">
                                            <div className={`text-base font-bold ${style.text}`}>
                                                {r.amount.toLocaleString()} SGC
                                                <span className="ml-2 text-xs font-mono text-gray-600">
                                                    → {formatAddress(r.walletAddress)}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-600 mt-0.5">
                                                Submitted{' '}
                                                {new Date(r.createdAt).toLocaleDateString()}
                                            </div>
                                            {r.status === 'completed' && r.txHash && (
                                                <a
                                                    href={`https://polygonscan.com/tx/${r.txHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-green-700 hover:underline"
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    {formatAddress(r.txHash)}
                                                </a>
                                            )}
                                            {r.status === 'rejected' && r.rejectionReason && (
                                                <div className="mt-1 text-xs text-red-700 italic">
                                                    Reason: {r.rejectionReason}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span
                                        className={`self-start sm:self-center inline-flex items-center gap-1 rounded-full border ${style.ring} bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${style.text}`}
                                    >
                                        {style.icon}
                                        {style.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ============================================================ */}
            {/* MODAL: Request SGCOIN Payout                                   */}
            {/* ============================================================ */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="sgcoin-payout-modal-title"
                    >
                        <motion.div
                            id={MODAL_ROOT_ID}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-gray-900 border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl"
                        >
                            <div className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3
                                            id="sgcoin-payout-modal-title"
                                            className="text-2xl font-bold text-white font-display uppercase"
                                        >
                                            Request SGCOIN Payout
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Reviewed manually by an admin within 24h.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        disabled={isSubmitting}
                                        aria-label="Close payout form"
                                        className="text-gray-400 hover:text-white transition disabled:opacity-50"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Amount */}
                                <div className="mb-4">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                        Amount (SGC)
                                    </label>
                                    <div className="flex gap-2 mb-2 flex-wrap">
                                        {AMOUNT_PRESETS.map((pct) => {
                                            const presetValue = Math.floor(
                                                (balance * pct) / 100,
                                            );
                                            const disabled =
                                                presetValue < MIN_PAYOUT_SGC;
                                            return (
                                                <button
                                                    key={pct}
                                                    type="button"
                                                    disabled={disabled || isSubmitting}
                                                    onClick={() =>
                                                        setAmountStr(String(presetValue))
                                                    }
                                                    className={`text-[10px] font-bold uppercase tracking-[0.2em] rounded-full px-3 py-1 border transition ${
                                                        disabled
                                                            ? 'border-gray-700 text-gray-600 cursor-not-allowed'
                                                            : 'border-brand-accent/40 text-brand-accent hover:bg-brand-accent/10'
                                                    }`}
                                                >
                                                    {pct}%
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <input
                                        ref={amountInputRef}
                                        type="number"
                                        inputMode="numeric"
                                        min={MIN_PAYOUT_SGC}
                                        max={balance}
                                        step={100}
                                        value={amountStr}
                                        onChange={(e) => setAmountStr(e.target.value)}
                                        placeholder={`Min ${MIN_PAYOUT_SGC.toLocaleString()} SGC`}
                                        aria-label="Payout amount in SGCoin"
                                        className="w-full border-2 border-white/10 bg-black/30 text-white rounded-lg px-4 py-3 font-mono focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
                                    />
                                    {Number(amountStr) > balance && (
                                        <p className="mt-1 text-xs text-red-400">
                                            Exceeds available balance of{' '}
                                            {balance.toLocaleString()} SGC.
                                        </p>
                                    )}
                                </div>

                                {/* Wallet address */}
                                <div className="mb-4">
                                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                                        Polygon Wallet Address
                                    </label>
                                    <input
                                        type="text"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        placeholder="0x..."
                                        aria-label="Polygon wallet address"
                                        className="w-full border-2 border-white/10 bg-black/30 text-white rounded-lg px-4 py-3 font-mono text-sm focus:ring-2 focus:ring-brand-accent focus:border-brand-accent"
                                    />
                                    {address && !POLYGON_ADDRESS_REGEX.test(address) && (
                                        <p className="mt-1 text-xs text-red-400">
                                            Must start with 0x and be 42 characters.
                                        </p>
                                    )}
                                    <div className="mt-2 flex gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={handleConnectMetaMask}
                                            disabled={isSubmitting}
                                            className="text-xs font-bold text-orange-400 hover:text-orange-300 disabled:opacity-50"
                                        >
                                            ↻ Use MetaMask
                                        </button>
                                        {address && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        await navigator.clipboard.writeText(
                                                            address,
                                                        );
                                                        setCopyHint('Copied!');
                                                        setTimeout(
                                                            () => setCopyHint(null),
                                                            1500,
                                                        );
                                                    } catch {
                                                        setCopyHint('Copy failed');
                                                    }
                                                }}
                                                className="text-xs font-bold text-gray-400 hover:text-white"
                                            >
                                                <Copy className="w-3 h-3 inline mr-1" />
                                                {copyHint ?? 'Copy'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Disclaimer */}
                                <label className="flex items-start gap-3 mb-6 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={disclaimerChecked}
                                        onChange={(e) =>
                                            setDisclaimerChecked(e.target.checked)
                                        }
                                        disabled={isSubmitting}
                                        aria-label="Acknowledge payout irreversibility"
                                        className="mt-1 w-5 h-5 flex-shrink-0 accent-brand-accent"
                                    />
                                    <span className="text-sm text-gray-300 leading-relaxed">
                                        I understand that once withdrawn, my SGCOIN will
                                        no longer be available for store discounts and
                                        will be sent to the Polygon address above.
                                    </span>
                                </label>

                                {/* Actions */}
                                <div className="flex gap-3 justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        disabled={isSubmitting}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium transition disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={!canSubmit}
                                        className="px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 bg-brand-accent hover:bg-brand-accent/90 text-black disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting && (
                                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        )}
                                        Submit Payout Request
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SGCoinPayoutTab;
