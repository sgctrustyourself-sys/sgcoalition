// pages/Claim.tsx
//
// /claim — "I ordered, where are my SGCoin?"
//
// WHO THIS IS FOR
//   A shopper whose order earned SGCoin but whose balance never saw it: they
//   checked out as a guest, or they ordered before creating an account. The
//   points are already recorded on the order (orders.sg_coin_reward); what was
//   missing is a way for the buyer to say so.
//
// THE FLOW, AND WHY IT IS SHAPED THIS WAY
//   1. Sign in or create the account, IN PLACE. The points have to land in a
//      balance, so there is no email-only path — and bouncing a guest to
//      /login would lose them, since the order number they were about to type
//      lives in the email they are reading, not in this page's URL. Same reason
//      this page does not send them to /signup and back.
//   2. Type the order number and the email used on the order. "Check this
//      order" runs lookup_order_points and reports what the order is worth
//      BEFORE they commit — a buyer claiming $84 of SGCoin should see the $84.
//   3. Matched  → one button. The order record and the email match are the
//      evidence, so nothing else is asked for.
//      Unmatched → a receipt screenshot is required, because that is the only
//      thing an operator can review.
//   4. Submit. Nothing is credited here: the claim enters the queue in the
//      SGCoin admin area and an operator approves it, which pays through
//      grant_sgcoin. This page says so plainly rather than promising points that
//      have not moved.
//
// The amount is never sent by this page. Points and `matched` come back computed
// from the order by the RPCs, so a tampered request cannot assert its own reward.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Hexagon,
    Loader2,
    Lock,
    Mail,
    Receipt,
    ShieldCheck,
    Upload,
    User,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { signInWithEmail, signUpWithEmail } from '../services/auth';
import {
    MAX_CLAIM_NOTE_LENGTH,
    getMyPointClaims,
    lookupOrderPoints,
    submitPointClaim,
    type MyPointClaim,
    type PointClaimLookup,
} from '../services/pointClaim';
import { uploadClaimProof, validatePaymentProofFile } from '../services/paymentProofUpload';

type AuthMode = 'signin' | 'signup';

const STATUS_LABEL: Record<MyPointClaim['status'], string> = {
    pending: 'In review',
    approved: 'Credited',
    rejected: 'Not credited',
};

const STATUS_CLASS: Record<MyPointClaim['status'], string> = {
    pending: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
    approved: 'border-green-500/30 bg-green-500/10 text-green-300',
    rejected: 'border-red-500/30 bg-red-500/10 text-red-300',
};

const Claim = () => {
    const { user } = useApp();
    const { addToast } = useToast();

    // ---- account step -------------------------------------------------------
    const [authMode, setAuthMode] = useState<AuthMode>('signin');
    const [authName, setAuthName] = useState('');
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authBusy, setAuthBusy] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    // Sign-up can land in "confirm your email" instead of "signed in", which is
    // not an error and not a session — it gets its own state so the page does not
    // claim the buyer is signed in when they are not.
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

    // ---- claim step ---------------------------------------------------------
    const [orderNumber, setOrderNumber] = useState('');
    const [orderEmail, setOrderEmail] = useState('');
    const [note, setNote] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [lookup, setLookup] = useState<PointClaimLookup | null>(null);
    const [checking, setChecking] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState<{ points: number; matched: boolean } | null>(null);
    const [myClaims, setMyClaims] = useState<MyPointClaim[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const isSignedIn = Boolean(user && !String(user.uid).startsWith('user_eth_'));

    /**
     * Prefill the order email with the account email.
     *
     * Most buyers order with the address they sign up with, so this saves typing
     * the field that decides whether the order matches. Only a default: the input
     * stays editable, because "bought with my work email" is the whole reason
     * this form asks instead of assuming.
     */
    useEffect(() => {
        const accountEmail = user?.email || '';
        if (accountEmail) setOrderEmail((current) => current || accountEmail);
    }, [user?.email]);

    const loadMyClaims = useCallback(async () => {
        if (!isSignedIn) return;
        setMyClaims(await getMyPointClaims());
    }, [isSignedIn]);

    useEffect(() => {
        void loadMyClaims();
    }, [loadMyClaims]);

    const handleAuth = async (event: React.FormEvent) => {
        event.preventDefault();
        setAuthBusy(true);
        setAuthError(null);

        try {
            if (authMode === 'signin') {
                const { error: signInError } = await signInWithEmail(authEmail.trim(), authPassword);
                if (signInError) {
                    setAuthError(signInError.message);
                    return;
                }
                // No success state to set: the auth listener in context/useAuth
                // fills `user`, and the page renders the claim form the moment it
                // does. A local "signed in" flag would race that.
            } else {
                const { data, error: signUpError } = await signUpWithEmail(
                    authEmail.trim(),
                    authPassword,
                    authName.trim() || authEmail.split('@')[0],
                );
                if (signUpError) {
                    setAuthError(signUpError.message);
                    return;
                }
                if (!data?.session) {
                    // Email confirmation is on for this project: there is an
                    // account but no session yet.
                    setAwaitingConfirmation(true);
                    return;
                }
            }
        } catch (err) {
            setAuthError((err as Error)?.message || 'Sign-in failed. Try again.');
        } finally {
            setAuthBusy(false);
        }
    };

    const handleCheck = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setSubmitted(null);
        setChecking(true);
        try {
            const result = await lookupOrderPoints(orderNumber, orderEmail);
            setLookup(result);
            if (!result.matched) {
                addToast('No matching order found — attach a receipt and we will review it by hand.', 'info');
            }
        } catch (err) {
            setLookup(null);
            setError((err as Error)?.message || 'Could not look that order up.');
        } finally {
            setChecking(false);
        }
    };

    const handleProofChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;
        if (!file) {
            setProofFile(null);
            return;
        }
        const validation = validatePaymentProofFile(file);
        if (!validation.valid) {
            setProofFile(null);
            setError(validation.error || 'That file cannot be used.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        setError(null);
        setProofFile(file);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!lookup) return;

        setError(null);
        setSubmitting(true);
        try {
            // Unmatched claims are the only ones that need the screenshot; a
            // matched claim is already evidenced by the order record.
            let proofUrl: string | null = null;
            if (!lookup.matched) {
                if (!proofFile) {
                    setError('Attach a receipt or order screenshot so we can verify it.');
                    return;
                }
                proofUrl = await uploadClaimProof(proofFile, orderNumber);
            }

            const result = await submitPointClaim({
                orderNumber,
                email: orderEmail,
                proofUrl,
                note,
            });

            setSubmitted({ points: result.points, matched: result.matched });
            setProofFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            await loadMyClaims();
            addToast('Claim submitted — an operator reviews it by hand.', 'success');
        } catch (err) {
            setError((err as Error)?.message || 'Could not submit that claim.');
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = useMemo(() => {
        if (!lookup || submitting) return false;
        if (lookup.alreadyClaimed) return false;
        if (!lookup.matched && !proofFile) return false;
        return orderNumber.trim().length > 0 && orderEmail.trim().length > 0;
    }, [lookup, submitting, orderNumber, orderEmail, proofFile]);

    const cardClass = 'rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm';
    const labelClass = 'text-xs font-bold uppercase tracking-widest text-gray-500';
    const inputClass =
        'mt-2 w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none';

    return (
        <div className="mx-auto max-w-3xl px-4 py-8 text-white">
            <div className="mb-8">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">
                    <Hexagon className="h-3 w-3 text-brand-accent" />
                    SGCoin Claims
                </div>
                <h1 className="font-display text-3xl font-black uppercase tracking-tighter md:text-4xl">
                    Claim Your Points
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
                    Every order earns 1 SGCoin per $1. If you ordered before creating an account — or checked out as
                    a guest — the points are still on the order. Verify it here and we will credit them.
                </p>
            </div>

            {/* ------------------------------------------------ account step */}
            {!isSignedIn && (
                <div className={cardClass}>
                    {awaitingConfirmation ? (
                        <div className="space-y-4 text-center">
                            <Mail className="mx-auto h-8 w-8 text-green-400" />
                            <h2 className="font-display text-xl font-bold uppercase tracking-tight">
                                Confirm your email
                            </h2>
                            <p className="text-sm leading-relaxed text-gray-400">
                                We sent a confirmation link to{' '}
                                <span className="font-bold text-white">{authEmail.trim()}</span>. Open it, then come
                                back to this page — your claim does not need to be retyped, but it does need the
                                account confirmed.
                            </p>
                        </div>
                    ) : (
                        <>
                            <h2 className="font-display text-xl font-bold uppercase tracking-tight">
                                {authMode === 'signin' ? 'Sign in to claim' : 'Create your account'}
                            </h2>
                            <p className="mt-2 text-sm text-gray-400">
                                Points land in a balance, so the claim needs an account. Takes a moment — the order
                                details you typed below survive it.
                            </p>

                            <div
                                role="alert"
                                aria-live="polite"
                                className={
                                    authError
                                        ? 'mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300'
                                        : 'sr-only'
                                }
                            >
                                {authError}
                            </div>

                            <form onSubmit={handleAuth} className="mt-6 space-y-4">
                                {authMode === 'signup' && (
                                    <div>
                                        <label className={labelClass} htmlFor="claim-name">
                                            Full name
                                        </label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-[2.1rem] h-4 w-4 text-gray-500" />
                                            <input
                                                id="claim-name"
                                                type="text"
                                                value={authName}
                                                onChange={(e) => setAuthName(e.target.value)}
                                                className={inputClass}
                                                placeholder="John Doe"
                                                autoComplete="name"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className={labelClass} htmlFor="claim-account-email">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-[2.1rem] h-4 w-4 text-gray-500" />
                                        <input
                                            id="claim-account-email"
                                            type="email"
                                            required
                                            value={authEmail}
                                            onChange={(e) => setAuthEmail(e.target.value)}
                                            className={inputClass}
                                            placeholder="name@example.com"
                                            autoComplete="email"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass} htmlFor="claim-password">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-[2.1rem] h-4 w-4 text-gray-500" />
                                        <input
                                            id="claim-password"
                                            type="password"
                                            required
                                            minLength={6}
                                            value={authPassword}
                                            onChange={(e) => setAuthPassword(e.target.value)}
                                            className={inputClass}
                                            placeholder="••••••••"
                                            autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={authBusy}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest text-black transition hover:bg-gray-200 disabled:opacity-40"
                                >
                                    {authBusy ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <ArrowRight className="h-4 w-4" />
                                    )}
                                    {authMode === 'signin' ? 'Sign in' : 'Create account'}
                                </button>
                            </form>

                            <button
                                type="button"
                                onClick={() => {
                                    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                                    setAuthError(null);
                                }}
                                className="mt-4 w-full text-center text-xs text-gray-400 underline hover:text-white"
                            >
                                {authMode === 'signin'
                                    ? 'No account yet? Create one'
                                    : 'Already have an account? Sign in'}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* -------------------------------------------------- claim step */}
            {isSignedIn && (
                <div className="space-y-6">
                    <div className={cardClass}>
                        <h2 className="font-display text-xl font-bold uppercase tracking-tight">Find your order</h2>
                        <p className="mt-2 text-sm text-gray-400">
                            The order number is in your confirmation email (it starts with <code>ORD-</code>). Use the
                            email you gave at checkout — not necessarily this account's.
                        </p>

                        <form onSubmit={handleCheck} className="mt-6 grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className={labelClass} htmlFor="claim-order-number">
                                    Order number
                                </label>
                                <div className="relative">
                                    <Receipt className="absolute left-3 top-[2.1rem] h-4 w-4 text-gray-500" />
                                    <input
                                        id="claim-order-number"
                                        type="text"
                                        required
                                        value={orderNumber}
                                        onChange={(e) => {
                                            setOrderNumber(e.target.value);
                                            setLookup(null);
                                            setSubmitted(null);
                                        }}
                                        className={inputClass}
                                        placeholder="ORD-1234"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass} htmlFor="claim-order-email">
                                    Email used on the order
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-[2.1rem] h-4 w-4 text-gray-500" />
                                    <input
                                        id="claim-order-email"
                                        type="email"
                                        required
                                        value={orderEmail}
                                        onChange={(e) => {
                                            setOrderEmail(e.target.value);
                                            setLookup(null);
                                            setSubmitted(null);
                                        }}
                                        className={inputClass}
                                        placeholder="name@example.com"
                                    />
                                </div>
                            </div>

                            <div className="sm:col-span-2">
                                <button
                                    type="submit"
                                    disabled={checking}
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-white/10 disabled:opacity-40"
                                >
                                    {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                                    Check this order
                                </button>
                            </div>
                        </form>

                        <div role="alert" aria-live="polite" className={error ? 'mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300' : 'sr-only'}>
                            {error}
                        </div>
                    </div>

                    {lookup && (
                        <form onSubmit={handleSubmit} className={cardClass}>
                            {lookup.matched ? (
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                                    <div>
                                        <h2 className="font-display text-lg font-bold uppercase tracking-tight">
                                            Order found — {lookup.points.toLocaleString()} SGCoin
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-400">
                                            {lookup.orderTotal != null && (
                                                <>Order total ${lookup.orderTotal.toFixed(2)} · </>
                                            )}
                                            {lookup.orderDate && new Date(lookup.orderDate).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-400" />
                                    <div>
                                        <h2 className="font-display text-lg font-bold uppercase tracking-tight">
                                            We could not match that order
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-400">
                                            Attach a receipt or order screenshot and we will verify it by hand. The
                                            order number and email are usually the thing that is slightly off — a
                                            typo, or a different address at checkout.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {lookup.alreadyClaimed && (
                                <p className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-gray-300">
                                    This order already has a claim on it, so there is nothing more to do. If it was
                                    rejected and something changed, contact us with the order number.
                                </p>
                            )}

                            {!lookup.alreadyClaimed && !lookup.matched && (
                                <div className="mt-6">
                                    <label className={labelClass} htmlFor="claim-proof">
                                        Receipt or order screenshot
                                    </label>
                                    <input
                                        id="claim-proof"
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                                        onChange={handleProofChange}
                                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-gray-300 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-widest file:text-black"
                                    />
                                    <p className="mt-2 text-xs text-gray-500">
                                        {proofFile
                                            ? `Attached: ${proofFile.name}`
                                            : 'JPG, PNG, WebP or PDF, up to 10 MB.'}
                                    </p>
                                </div>
                            )}

                            {!lookup.alreadyClaimed && (
                                <>
                                    <div className="mt-6">
                                        <label className={labelClass} htmlFor="claim-note">
                                            Anything we should know? (optional)
                                        </label>
                                        <textarea
                                            id="claim-note"
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            maxLength={MAX_CLAIM_NOTE_LENGTH}
                                            rows={3}
                                            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white placeholder-gray-600 focus:border-white/30 focus:outline-none"
                                            placeholder="Ordered as a guest in July, etc."
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={!canSubmit}
                                        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest text-black transition hover:bg-gray-200 disabled:opacity-40"
                                    >
                                        {submitting ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : lookup.matched ? (
                                            <Hexagon className="h-4 w-4" />
                                        ) : (
                                            <Upload className="h-4 w-4" />
                                        )}
                                        {lookup.matched
                                            ? `Claim ${lookup.points.toLocaleString()} SGCoin`
                                            : 'Submit for review'}
                                    </button>
                                </>
                            )}
                        </form>
                    )}

                    {submitted && (
                        <div
                            role="status"
                            aria-live="polite"
                            className="rounded-3xl border border-green-500/20 bg-green-500/5 p-6"
                        >
                            <h2 className="font-display text-lg font-bold uppercase tracking-tight text-green-300">
                                Claim submitted
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-gray-300">
                                {submitted.matched
                                    ? `${submitted.points.toLocaleString()} SGCoin is queued for an operator to approve. You will see it land in your balance once it is approved — nothing is credited until then.`
                                    : 'Your receipt is with us. An operator will match it to the order by hand and credit the points if it checks out.'}
                            </p>
                        </div>
                    )}

                    {myClaims.length > 0 && (
                        <div className={cardClass}>
                            <h2 className="font-display text-lg font-bold uppercase tracking-tight">Your claims</h2>
                            <ul className="mt-4 divide-y divide-white/5">
                                {myClaims.map((claim) => (
                                    <li key={claim.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold">{claim.orderNumber}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(claim.createdAt).toLocaleDateString()}
                                                {claim.matched ? ' · matched order' : ' · reviewed by hand'}
                                            </p>
                                            {claim.reviewNote && (
                                                <p className="mt-1 text-xs text-gray-400">{claim.reviewNote}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-white">
                                                {claim.status === 'approved' && claim.grantedAmount != null
                                                    ? `+${claim.grantedAmount.toLocaleString()}`
                                                    : claim.points.toLocaleString()}
                                            </span>
                                            <span
                                                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${STATUS_CLASS[claim.status]}`}
                                            >
                                                {STATUS_LABEL[claim.status]}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <p className="text-center text-xs text-gray-500">
                        Ordered as a guest and never made an account?{' '}
                        <Link to="/shop" className="text-white underline">
                            Keep shopping as a member
                        </Link>{' '}
                        — members get 30% off at checkout, and points credit automatically from then on.
                    </p>
                </div>
            )}
        </div>
    );
};

export default Claim;
