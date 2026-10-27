import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Wallet,
    AlertTriangle,
    CheckCircle,
    ExternalLink,
    RefreshCw,
    Shield,
    Loader,
    Coins,
    ArrowUpRight,
    Undo2,
    Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
    getMigrationRatioDisplay,
    MIGRATION_MEMBER_MILESTONE,
    POLYGON_BLOCK_EXPLORER,
    POLYGON_CHAIN_ID,
    SGCOIN_BURN_ADDRESS,
    SGCOIN_MIGRATOR_ADDRESS,
    SGCOIN_V1_CONTRACT_ADDRESS,
    SGCOIN_V2_CONTRACT_ADDRESS,
} from '../constants';
import { AuthProvider } from '../types';
import { fetchSGCoinV2Price } from '../services/priceService';
import {
    approveExactAmount,
    countDistinctMigrators,
    createReadProvider,
    estimateMigrationGas,
    executeMigration,
    fetchMigrationEvents,
    formatV1,
    formatV1ForDisplay,
    formatV2,
    formatV2ForDisplay,
    getMigrationAllowance,
    getMigratedSupply,
    getV1BalanceRaw,
    getWalletProvider,
    getV2BalanceRaw,
    parseV1Amount,
    ratioFromEvent,
    revokeApproval,
    v1RawToV2Raw,
    type MigrationExecution,
    type MigrationRecord,
} from '../services/sgcoinMigration';

/** Events fetched for the counters. The list itself shows only the first few. */
const ACTIVITY_FETCH_LIMIT = 500;
const ACTIVITY_VISIBLE = 8;

const panel = 'rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl';
const actionButton =
    'w-full inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 font-bold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black';

const shortAddress = (address: string) =>
    address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

const StatTile: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">{label}</p>
        <p className="mt-1 font-mono text-lg font-bold text-white">{value}</p>
        {hint && <p className="mt-0.5 text-[10px] uppercase tracking-wider text-gray-600">{hint}</p>}
    </div>
);

const ContractRow: React.FC<{ label: string; address: string; note?: string }> = ({ label, address, note }) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 py-3 last:border-0">
        <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">{label}</p>
            <p className="truncate font-mono text-xs text-white">{address}</p>
            {note && <p className="mt-0.5 text-[10px] text-gray-600">{note}</p>}
        </div>
        <a
            href={`${POLYGON_BLOCK_EXPLORER}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-blue-400 transition-colors hover:text-blue-300"
        >
            Inspect <ExternalLink size={12} aria-hidden="true" />
        </a>
    </div>
);

const MigrationRow: React.FC<{ record: MigrationRecord; showWallet?: boolean }> = ({ record, showWallet }) => {
    const ratio = ratioFromEvent(record.v1Raw, record.v2Raw);
    const flat = ratio !== null && Math.abs(ratio - 1_000_000) < 1;

    return (
        <li className="border-b border-white/[0.04] py-4 last:border-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="font-mono text-sm font-bold text-white">
                    {formatV1ForDisplay(record.v1Raw)}{' '}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">V1</span>
                    <ArrowRight size={12} className="mx-1 inline text-gray-600" aria-hidden="true" />
                    <span className="text-yellow-400">{formatV2ForDisplay(record.v2Raw)}</span>{' '}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">V2</span>
                </p>
                <p className="font-mono text-xs text-gray-500">{formatDate(record.timestamp)}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-widest">
                {showWallet && (
                    <span className="font-mono normal-case tracking-normal text-gray-400">
                        {shortAddress(record.user)}
                    </span>
                )}
                <span className={flat ? 'text-green-400' : 'text-yellow-400'}>
                    {ratio !== null ? `${ratio.toLocaleString(undefined, { maximumFractionDigits: 0 })}:1 ratio` : 'ratio unavailable'}
                    {flat ? ' · flat' : ''}
                </span>
                {record.tier && <span className="text-gray-600">tier {record.tier}</span>}
                <a
                    href={`${POLYGON_BLOCK_EXPLORER}/tx/${record.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 transition-colors hover:text-blue-300"
                >
                    Transaction <ExternalLink size={10} aria-hidden="true" />
                </a>
            </div>
        </li>
    );
};

// Wallet RPC errors carry the useful text on `reason`/`shortMessage` rather
// than `message`, so read all three from an unknown throw.
const transactionReason = (err: unknown, fallback: string): string => {
    const detail = err as { reason?: string; shortMessage?: string; message?: string };
    return detail?.reason || detail?.shortMessage || detail?.message || fallback;
};

const MigrationPage: React.FC = () => {
    const { user, loginUser, chainId, switchToPolygon, refreshBalances } = useApp();
    const { addToast } = useToast();

    const walletAddress = useMemo(
        () => user?.walletAddress || user?.connectedWalletAddress || null,
        [user?.walletAddress, user?.connectedWalletAddress]
    );
    const hasProvider = typeof window !== 'undefined' && !!window.ethereum;
    const isWrongNetwork = chainId !== null && chainId !== POLYGON_CHAIN_ID;

    const [amountInput, setAmountInput] = useState('');
    const [v1BalanceRaw, setV1BalanceRaw] = useState<bigint>(0n);
    const [v2BalanceRaw, setV2BalanceRaw] = useState<bigint>(0n);
    const [allowanceRaw, setAllowanceRaw] = useState<bigint>(0n);
    const [migratedSupplyRaw, setMigratedSupplyRaw] = useState<bigint | null>(null);
    const [priceUsd, setPriceUsd] = useState<number | null>(null);
    const [gasEstimate, setGasEstimate] = useState<bigint | null>(null);

    const [isLoadingBalances, setIsLoadingBalances] = useState(false);
    const [isLoadingActivity, setIsLoadingActivity] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [isRevoking, setIsRevoking] = useState(false);

    const [status, setStatus] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<MigrationExecution | null>(null);

    const [activity, setActivity] = useState<MigrationRecord[]>([]);
    const [myActivity, setMyActivity] = useState<MigrationRecord[]>([]);
    const [activityError, setActivityError] = useState<string | null>(null);

    // Distinct wallets, not events: a member can migrate more than once, and
    // the 100-member milestone is counted in people.
    const migratedMembers = useMemo(() => countDistinctMigrators(activity), [activity]);
    const milestoneProgress = Math.min(100, Math.round((migratedMembers / MIGRATION_MEMBER_MILESTONE) * 100));

    const successRef = useRef<HTMLDivElement>(null);
    const amountRef = useRef<HTMLInputElement>(null);

    // ── Derived values ─────────────────────────────────────────────────────
    const parsed = useMemo(() => parseV1Amount(amountInput), [amountInput]);
    const amountRaw = parsed.ok ? parsed.raw : 0n;
    const amountError = parsed.ok ? null : parsed.error || null;
    const exceedsBalance = parsed.ok && amountRaw > v1BalanceRaw;
    const needsApproval = parsed.ok && !exceedsBalance && allowanceRaw < amountRaw;
    const quoteV2Raw = parsed.ok ? v1RawToV2Raw(amountRaw) : 0n;
    const quoteV2 = formatV2(quoteV2Raw);
    const quoteUsd = priceUsd !== null && parsed.ok ? Number(quoteV2) * priceUsd : null;
    const hasBalance = v1BalanceRaw > 0n;
    const leftoverApproval = allowanceRaw > 0n && (!parsed.ok || allowanceRaw > amountRaw);

    // ── Data loading ──────────────────────────────────────────────────────
    const loadActivity = useCallback(async () => {
        setIsLoadingActivity(true);
        setActivityError(null);
        try {
            const provider = await createReadProvider();
            // The per-wallet list is only meaningful with a wallet. Without one
            // the query would return every migration on chain, which is the
            // community list, not "yours".
            const [global, mine] = await Promise.all([
                fetchMigrationEvents({ provider, limit: ACTIVITY_FETCH_LIMIT }),
                walletAddress
                    ? fetchMigrationEvents({ provider, limit: 5, user: walletAddress })
                    : Promise.resolve([] as MigrationRecord[]),
            ]);
            setActivity(global);
            setMyActivity(mine);
            setMigratedSupplyRaw(await getMigratedSupply(provider));
        } catch (err) {
            console.error('Migration activity failed:', err);
            setActivityError(
                'We could not read the migration history from Polygon right now. The contracts and the step-by-step guide below still work.'
            );
        } finally {
            setIsLoadingActivity(false);
        }
    }, [walletAddress]);

    const loadBalances = useCallback(async () => {
        if (!walletAddress) return;
        setIsLoadingBalances(true);
        try {
            const provider = await getWalletProvider();
            const [v1, v2, allowance] = await Promise.all([
                getV1BalanceRaw(walletAddress, provider),
                getV2BalanceRaw(walletAddress, provider),
                getMigrationAllowance(walletAddress, provider),
            ]);
            setV1BalanceRaw(v1);
            setV2BalanceRaw(v2);
            setAllowanceRaw(allowance);
        } catch (err) {
            console.error('Balance load failed:', err);
        } finally {
            setIsLoadingBalances(false);
        }
    }, [walletAddress]);

    useEffect(() => {
        void loadActivity();
        void fetchSGCoinV2Price().then(setPriceUsd);
    }, [loadActivity]);

    useEffect(() => {
        if (!walletAddress || isWrongNetwork) {
            setV1BalanceRaw(0n);
            setV2BalanceRaw(0n);
            setAllowanceRaw(0n);
            return;
        }
        void loadBalances();
    }, [walletAddress, isWrongNetwork, loadBalances]);

    // Re-estimate gas when the amount changes and the network is right.
    useEffect(() => {
        let cancelled = false;
        if (!parsed.ok || exceedsBalance || isWrongNetwork || !walletAddress) {
            setGasEstimate(null);
            return;
        }
        (async () => {
            try {
                const provider = await getWalletProvider();
                const estimate = await estimateMigrationGas(provider, amountRaw);
                if (!cancelled) setGasEstimate(estimate);
            } catch {
                if (!cancelled) setGasEstimate(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [parsed.ok, amountRaw, exceedsBalance, isWrongNetwork, walletAddress]);

    useEffect(() => {
        if (success) successRef.current?.focus();
    }, [success]);

    // ── Actions ───────────────────────────────────────────────────────────
    const setAmountFromRaw = (raw: bigint) => {
        setAmountInput(raw > 0n ? formatV1(raw) : '');
        setError(null);
    };

    const handlePercent = (percent: number) => {
        if (v1BalanceRaw <= 0n) return;
        const share = (v1BalanceRaw * BigInt(Math.round(percent * 100))) / 10_000n;
        setAmountFromRaw(share);
    };

    const handleConnect = async () => {
        try {
            await loginUser(AuthProvider.METAMASK);
        } catch (err) {
            console.error('Connect failed:', err);
            setError('We could not reach your wallet. Check that MetaMask is unlocked and on Polygon.');
        }
    };

    const handleSwitchNetwork = async () => {
        setError(null);
        const switched = await switchToPolygon();
        if (!switched) {
            setError('Polygon was not added automatically. Add Polygon (chain ID 137) in your wallet and try again.');
        }
    };

    const handleApprove = async () => {
        if (!parsed.ok) return;
        setIsApproving(true);
        setError(null);
        setStatus('Confirm the approval in your wallet…');
        try {
            const provider = await getWalletProvider();
            const signer = await provider.getSigner();
            await approveExactAmount(signer, amountRaw);
            setStatus('');
            addToast('Approved. Nothing is spent until you migrate.', 'success');
            await loadBalances();
        } catch (err) {
            setStatus('');
            const reason = transactionReason(err, 'Transaction failed');
            setError(
                /reject/i.test(reason)
                    ? 'You rejected the approval. Nothing changed.'
                    : `Approval failed: ${reason}`
            );
        } finally {
            setIsApproving(false);
        }
    };

    const handleRevoke = async () => {
        setIsRevoking(true);
        setError(null);
        try {
            const provider = await getWalletProvider();
            const signer = await provider.getSigner();
            await revokeApproval(signer);
            addToast('Approval revoked — the migrator can no longer spend your V1.', 'success');
            await loadBalances();
        } catch (err) {
            const reason = transactionReason(err, 'Transaction failed');
            setError(/reject/i.test(reason) ? 'You rejected the revocation.' : `Revoke failed: ${reason}`);
        } finally {
            setIsRevoking(false);
        }
    };

    const handleMigrate = async () => {
        if (!parsed.ok) return;
        setIsMigrating(true);
        setError(null);
        setStatus('Confirm the migration in your wallet…');
        try {
            const provider = await getWalletProvider();
            const signer = await provider.getSigner();

            const currentAllowance = await getMigrationAllowance(walletAddress || '', provider);
            if (currentAllowance < amountRaw) {
                throw new Error('The approval for this amount has not landed yet. Approve it and try again.');
            }

            const execution = await executeMigration(signer, amountRaw);
            setStatus('');
            setSuccess(execution);
            setAmountInput('');
            addToast('Migration complete.', 'success');
            await Promise.all([loadBalances(), loadActivity(), refreshBalances()]);
        } catch (err) {
            setStatus('');
            const reason = transactionReason(err, 'Unknown error');
            setError(
                /reject/i.test(reason)
                    ? 'You rejected the transaction. Nothing was migrated.'
                    : `Migration failed: ${reason}`
            );
        } finally {
            setIsMigrating(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────
    const walletGate = () => {
        if (!hasProvider) {
            return (
                <div className={`${panel} p-6 text-center`}>
                    <Wallet className="mx-auto mb-4 text-yellow-500" size={28} aria-hidden="true" />
                    <h2 className="font-display text-xl font-bold uppercase">
                        {walletAddress ? 'No wallet extension' : 'No wallet detected'}
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
                        {walletAddress
                            ? `Your account is linked to ${shortAddress(walletAddress)}, but signing needs a wallet extension in this browser.`
                            : 'Migration runs from your own wallet — we never hold your keys.'}{' '}
                        Install MetaMask (or any Polygon wallet), then come back to this page.
                    </p>
                    <a
                        href="https://metamask.io/download/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${actionButton} mt-5 bg-yellow-500 text-black hover:bg-yellow-400`}
                    >
                        Get MetaMask <ExternalLink size={16} aria-hidden="true" />
                    </a>
                </div>
            );
        }

        if (!walletAddress) {
            return (
                <div className={`${panel} p-6 text-center`}>
                    <Wallet className="mx-auto mb-4 text-yellow-500" size={28} aria-hidden="true" />
                    <h2 className="font-display text-xl font-bold uppercase">Connect your wallet</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
                        We read your V1 balance and write the migration transaction from the wallet you
                        sign with. Your keys never leave it.
                    </p>
                    <button type="button" onClick={handleConnect} className={`${actionButton} mt-5 bg-white text-black hover:bg-gray-200`}>
                        Connect Wallet
                    </button>
                </div>
            );
        }

        if (isWrongNetwork) {
            return (
                <div className={`${panel} p-6 text-center`}>
                    <AlertTriangle className="mx-auto mb-4 text-yellow-500" size={28} aria-hidden="true" />
                    <h2 className="font-display text-xl font-bold uppercase">Switch to Polygon</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-gray-400">
                        SGCOIN lives on Polygon (chain ID 137). Your wallet is on a different network, so
                        balances and migrations are unavailable until you switch.
                    </p>
                    <button type="button" onClick={handleSwitchNetwork} className={`${actionButton} mt-5 bg-yellow-600 text-white hover:bg-yellow-500`}>
                        <RefreshCw size={18} aria-hidden="true" /> Switch to Polygon
                    </button>
                </div>
            );
        }

        return null;
    };

    if (success) {
        return (
            <div className="min-h-screen bg-black px-4 pb-16 pt-32">
                <div className="mx-auto max-w-2xl">
                    <div
                        ref={successRef}
                        tabIndex={-1}
                        className={`${panel} border-green-500/30 p-8 text-center focus:outline-none`}
                    >
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/20 text-green-500">
                            <CheckCircle size={40} aria-hidden="true" />
                        </div>
                        <h1 className="font-display text-3xl font-bold uppercase">Migration complete</h1>
                        <p className="mt-2 text-sm text-gray-400">
                            These are the amounts read back from the <code>Migrated</code> event on chain —
                            not an estimate.
                        </p>

                        <dl className="mt-8 space-y-3 rounded-2xl border border-white/5 bg-black/50 p-6 text-left">
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-xs font-bold uppercase tracking-widest text-gray-500">V1 migrated</dt>
                                <dd className="font-mono font-bold text-white">{formatV1ForDisplay(success.v1Raw)} V1</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-xs font-bold uppercase tracking-widest text-gray-500">V2 received</dt>
                                <dd className="font-mono font-bold text-yellow-400">{formatV2ForDisplay(success.v2Raw)} V2</dd>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <dt className="text-xs font-bold uppercase tracking-widest text-gray-500">Ratio used</dt>
                                <dd className="font-mono text-gray-300">
                                    {ratioFromEvent(success.v1Raw, success.v2Raw)?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? getMigrationRatioDisplay()}:1
                                    {success.tier ? ` · ${success.tier}` : ''}
                                </dd>
                            </div>
                            {success.gasUsed !== null && (
                                <div className="flex items-center justify-between gap-4">
                                    <dt className="text-xs font-bold uppercase tracking-widest text-gray-500">Gas used</dt>
                                    <dd className="font-mono text-gray-300">{success.gasUsed.toString()}</dd>
                                </div>
                            )}
                        </dl>

                        <a
                            href={`${POLYGON_BLOCK_EXPLORER}/tx/${success.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-6 inline-flex items-center justify-center gap-2 text-sm text-blue-400 transition-colors hover:text-blue-300"
                        >
                            View the transaction on Polygonscan <ExternalLink size={14} aria-hidden="true" />
                        </a>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={() => {
                                    setSuccess(null);
                                    amountRef.current?.focus();
                                }}
                                className={`${actionButton} bg-white text-black hover:bg-gray-200`}
                            >
                                Migrate more
                            </button>
                            <Link to="/ecosystem" className={`${actionButton} border border-white/20 text-white hover:bg-white/10`}>
                                Back to Ecosystem <ArrowUpRight size={16} aria-hidden="true" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const gate = walletGate();

    return (
        <div className="min-h-screen bg-gradient-to-b from-black via-gray-900/40 to-black px-4 pb-16 pt-32 text-white">
            <div className="mx-auto max-w-5xl">
                {/* Hero */}
                <header className="relative mb-12 text-center">
                    <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-64 -translate-x-1/2 bg-yellow-500/10 blur-[100px]" />
                    <h1 className="font-display text-5xl font-bold uppercase tracking-tight md:text-6xl">
                        The Great Migration
                    </h1>
                    <p className="mx-auto mt-5 max-w-2xl text-gray-400">
                        Upgrade SGCOIN V1 to the V2 standard. One ratio for everyone, one approval per
                        migration, every number verifiable on chain.
                    </p>
                    <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-sm font-bold text-yellow-400">
                        <Coins size={16} aria-hidden="true" /> Flat ratio: {getMigrationRatioDisplay()}
                    </p>
                </header>

                {/* Live status strip */}
                <section aria-label="Migration status" className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatTile
                        label="V1 migrated"
                        value={migratedSupplyRaw !== null ? formatV1ForDisplay(migratedSupplyRaw) : '—'}
                        hint="V1 in the burn wallet"
                    />
                    <StatTile
                        label="Members migrated"
                        value={isLoadingActivity ? '…' : String(migratedMembers)}
                        hint="Distinct wallets"
                    />
                    <StatTile
                        label="V1 → V2"
                        value={getMigrationRatioDisplay()}
                        hint="Flat, for every holder"
                    />
                    <StatTile
                        label="V2 price"
                        value={priceUsd !== null ? `$${priceUsd.toFixed(6)}` : '—'}
                        hint={priceUsd !== null ? 'Live from DexScreener' : 'No V2 market pair yet'}
                    />
                </section>

                {/* Milestone - the count is read from the chain, not typed in */}
                <section
                    aria-label={`Migration milestone: ${migratedMembers} of ${MIGRATION_MEMBER_MILESTONE} members migrated`}
                    className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Milestone — {MIGRATION_MEMBER_MILESTONE} members migrated
                        </p>
                        <p className="font-mono text-sm font-bold text-white">
                            {migratedMembers} / {MIGRATION_MEMBER_MILESTONE}
                        </p>
                    </div>
                    <div
                        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"
                        role="progressbar"
                        aria-valuenow={migratedMembers}
                        aria-valuemin={0}
                        aria-valuemax={MIGRATION_MEMBER_MILESTONE}
                        aria-label="Members migrated"
                    >
                        <div
                            className="h-full rounded-full bg-yellow-500 transition-[width] duration-500"
                            style={{ width: `${milestoneProgress}%` }}
                        />
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
                        Counted from the public <code className="text-gray-400">Migrated</code> events on
                        Polygon, one per wallet. At {MIGRATION_MEMBER_MILESTONE} members the migration
                        destination changes from the burn wallet to a provable burn address, and every
                        remaining V1 is destroyed on chain instead of parked.
                    </p>
                </section>

                {gate}

                {/* Migration console */}
                {!gate && (
                    <section className="grid gap-6 lg:grid-cols-2">
                        {/* V1 */}
                        <div className={`${panel} flex flex-col p-6 md:p-8`}>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Legacy token</p>
                                    <h2 className="mt-1 text-2xl font-bold">SGCOIN (V1)</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={loadBalances}
                                    disabled={isLoadingBalances}
                                    className="rounded-sm p-1.5 text-gray-500 transition-colors hover:text-white disabled:opacity-50"
                                    title="Refresh balances"
                                    aria-label="Refresh balances"
                                >
                                    <RefreshCw size={16} className={isLoadingBalances ? 'animate-spin' : ''} aria-hidden="true" />
                                </button>
                            </div>

                            <div className="mt-6">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Your V1 balance</p>
                                <p className="mt-1 break-words font-mono text-3xl font-bold">
                                    {isLoadingBalances ? '…' : formatV1ForDisplay(v1BalanceRaw)}
                                    <span className="ml-2 text-sm font-bold text-gray-500">V1</span>
                                </p>
                                {!isLoadingBalances && !hasBalance && (
                                    <p className="mt-2 text-xs text-gray-500">
                                        This wallet holds no V1. Migration moves V1 into V2 — there is
                                        nothing to convert until you hold V1.
                                    </p>
                                )}
                            </div>

                            <div className="mt-6">
                                <label htmlFor="migration-amount" className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                    Amount to migrate
                                    <button
                                        type="button"
                                        onClick={() => setAmountFromRaw(v1BalanceRaw)}
                                        disabled={!hasBalance}
                                        className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 transition-colors hover:text-yellow-400 disabled:opacity-40"
                                    >
                                        Use max
                                    </button>
                                </label>
                                <input
                                    ref={amountRef}
                                    id="migration-amount"
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    spellCheck={false}
                                    value={amountInput}
                                    onChange={(event) => {
                                        setAmountInput(event.target.value);
                                        setError(null);
                                    }}
                                    placeholder="0"
                                    aria-describedby="migration-amount-help migration-amount-error"
                                    aria-invalid={Boolean(amountError || exceedsBalance)}
                                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/60 px-5 py-4 font-mono text-xl text-white placeholder-gray-700 focus:border-yellow-500/50 focus:outline-none"
                                />
                                <p id="migration-amount-help" className="mt-2 text-[11px] text-gray-600">
                                    V1 has 9 decimals. You can migrate any amount, in as many transactions as
                                    you like.
                                </p>
                                <p
                                    id="migration-amount-error"
                                    role="status"
                                    aria-live="polite"
                                    className={`mt-2 text-xs ${amountError || exceedsBalance ? 'text-red-400' : 'text-transparent'}`}
                                >
                                    {exceedsBalance
                                        ? `That is more than the ${formatV1ForDisplay(v1BalanceRaw)} V1 in this wallet.`
                                        : amountError || ' '}
                                </p>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {[25, 50, 75, 100].map((percent) => (
                                        <button
                                            key={percent}
                                            type="button"
                                            onClick={() => handlePercent(percent)}
                                            disabled={!hasBalance}
                                            className="rounded-sm border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:border-white/40 hover:text-white disabled:opacity-40"
                                        >
                                            {percent}%
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Migration system</span>
                                    <span className="rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-green-400">
                                        Fair &amp; equal
                                    </span>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Exchange ratio</span>
                                    <span className="font-mono font-bold tracking-widest text-white">{getMigrationRatioDisplay()}</span>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-sm">
                                    <span className="text-gray-600">Current allowance</span>
                                    <span className="font-mono text-gray-300">
                                        {formatV1ForDisplay(allowanceRaw)} V1
                                    </span>
                                </div>
                            </div>

                            {leftoverApproval && (
                                <button
                                    type="button"
                                    onClick={handleRevoke}
                                    disabled={isRevoking}
                                    className="mt-4 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-white disabled:opacity-50"
                                >
                                    {isRevoking ? <Loader size={12} className="animate-spin" aria-hidden="true" /> : <Undo2 size={12} aria-hidden="true" />}
                                    Revoke unused approval
                                </button>
                            )}
                        </div>

                        {/* V2 */}
                        <div className={`${panel} flex flex-col border-yellow-500/20 bg-gradient-to-br from-yellow-500/[0.04] to-transparent p-6 md:p-8`}>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-600/80">New standard</p>
                                    <h2 className="mt-1 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-2xl font-bold text-transparent">
                                        SGCOIN (V2)
                                    </h2>
                                </div>
                                <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-[10px] font-bold uppercase text-yellow-500">
                                    <span className="h-2 w-2 rounded-full bg-yellow-500" /> Polygon
                                </span>
                            </div>

                            <div className="flex flex-1 flex-col justify-center py-8">
                                <p className="text-center text-[10px] font-bold uppercase tracking-widest text-yellow-600/60">
                                    You receive
                                </p>
                                <p
                                    data-testid="migration-quote"
                                    className="mt-2 break-words text-center font-mono text-4xl font-bold tracking-tight text-white md:text-5xl"
                                >
                                    {parsed.ok ? formatV2ForDisplay(quoteV2Raw) : '0'}
                                </p>
                                <p className="mt-1 text-center text-xs font-bold uppercase tracking-widest text-yellow-500">V2</p>
                                <p className="mt-3 text-center text-xs text-gray-500">
                                    {quoteUsd !== null
                                        ? `≈ $${quoteUsd.toFixed(2)} at the current price`
                                        : 'Live USD price unavailable — the token amount above is exact'}
                                </p>
                            </div>

                            <div className="mt-auto space-y-3">
                                <p className="text-center text-xs text-gray-500">
                                    Your V2 balance today:{' '}
                                    <span className="font-mono text-gray-300">{formatV2ForDisplay(v2BalanceRaw)} V2</span>
                                </p>

                                {/* Status line — the single source of truth for what happens next */}
                                <div aria-live="polite" role="status" className="min-h-[1.25rem] text-center text-xs text-gray-400">
                                    {status}
                                </div>

                                {error && (
                                    <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-xs text-red-200">
                                        <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {needsApproval ? (
                                    <button
                                        type="button"
                                        onClick={handleApprove}
                                        disabled={isApproving || isMigrating || !parsed.ok || exceedsBalance}
                                        className={`${actionButton} bg-blue-600 text-white hover:bg-blue-700`}
                                    >
                                        {isApproving ? <Loader size={18} className="animate-spin" aria-hidden="true" /> : <Shield size={18} aria-hidden="true" />}
                                        Approve {parsed.ok ? formatV1ForDisplay(amountRaw) : '0'} V1
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleMigrate}
                                        disabled={isMigrating || isApproving || !parsed.ok || exceedsBalance}
                                        className={`${actionButton} bg-green-600 text-white hover:bg-green-500`}
                                    >
                                        {isMigrating ? <Loader size={18} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
                                        Migrate to SGCOIN V2
                                    </button>
                                )}

                                <p className="text-center text-[10px] leading-relaxed text-gray-600">
                                    {needsApproval
                                        ? 'We ask for permission for exactly this amount — not a blanket allowance. The approval is spent in full by the migration.'
                                        : gasEstimate !== null
                                            ? `Approved for this amount. Estimated gas: ${gasEstimate.toString()}`
                                            : 'Approved for this amount. The migrator can only spend what you approved.'}
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {/* How it works */}
                <section aria-labelledby="how-it-works" className="mt-14">
                    <h2 id="how-it-works" className="font-display text-xl font-bold uppercase tracking-wide">
                        How it works
                    </h2>
                    <div className="mt-5 grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                            <Shield className="mb-3 text-green-500" size={22} aria-hidden="true" />
                            <h3 className="font-bold">Exact approvals only</h3>
                            <p className="mt-2 text-xs leading-relaxed text-gray-500">
                                You approve the migrator for the amount you are moving — nothing more. That
                                allowance is spent in full by the migration, and you can revoke it at any time
                                from the panel above.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                            <RefreshCw className="mb-3 text-blue-500" size={22} aria-hidden="true" />
                            <h3 className="font-bold">On-chain and verifiable</h3>
                            <p className="mt-2 text-xs leading-relaxed text-gray-500">
                                The migration is a contract call, not a request to us. We never hold your keys
                                or tokens, and every migration emits a public{' '}
                                <code className="text-gray-400">Migrated</code> event you can check on
                                Polygonscan.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                            <FlameIcon />
                            <h3 className="font-bold">One-way, by design</h3>
                            <p className="mt-2 text-xs leading-relaxed text-gray-500">
                                V1 tokens leave your wallet for the migration burn wallet and are not returned.
                                V2 tokens are minted 1,000,000:1 into the same wallet. Migration is
                                irreversible — check the amount before you sign.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Rules + contracts */}
                <section aria-labelledby="the-rules" className="mt-14 grid gap-6 md:grid-cols-2">
                    <div className={`${panel} p-6`}>
                        <h2 id="the-rules" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
                            <Info size={18} className="text-yellow-500" aria-hidden="true" /> The rules
                        </h2>
                        <ul className="mt-4 space-y-3 text-sm text-gray-400">
                            <li className="flex gap-3">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                                <span>
                                    <strong className="text-white">Ratio:</strong> {getMigrationRatioDisplay()}, flat. Every
                                    holder gets the same rate — no tiers, no minimums, no whale bonus.
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                                <span>
                                    <strong className="text-white">Decimals:</strong> V1 uses 9 decimals, V2 uses 18.
                                    The exact token amount is shown in the panel above.
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                                <span>
                                    <strong className="text-white">Network:</strong> Polygon mainnet (chain ID{' '}
                                    {POLYGON_CHAIN_ID}). V1 and V2 are different contracts, so both balances
                                    can be held at once.
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                                <span>
                                    <strong className="text-white">Where V1 goes:</strong> the migration burn wallet{' '}
                                    <span className="font-mono text-xs text-gray-300">{shortAddress(SGCOIN_BURN_ADDRESS)}</span>.
                                    Migration is one-way.
                                </span>
                            </li>
                            <li className="flex gap-3">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-yellow-500" />
                                <span>
                                    <strong className="text-white">If something goes wrong:</strong> the
                                    migrator contract is owned by the Coalition treasury wallet, and every
                                    migration is a public on-chain event.
                                </span>
                            </li>
                        </ul>
                    </div>

                    <div className={`${panel} p-6`}>
                        <h2 className="font-display text-lg font-bold uppercase tracking-wide">Contracts</h2>
                        <div className="mt-3">
                            <ContractRow label="SGCOIN V1 (legacy)" address={SGCOIN_V1_CONTRACT_ADDRESS} note="9 decimals" />
                            <ContractRow label="SGCOIN V2 (current)" address={SGCOIN_V2_CONTRACT_ADDRESS} note="18 decimals" />
                            <ContractRow label="Migration contract" address={SGCOIN_MIGRATOR_ADDRESS} note="migrate(uint256 amount)" />
                            <ContractRow label="Burn wallet" address={SGCOIN_BURN_ADDRESS} note="Where V1 is sent" />
                        </div>
                        <p className="mt-4 text-[11px] leading-relaxed text-gray-600">
                            Check any address on Polygonscan before you sign. If a wallet asks you to send
                            V1 somewhere other than the migration contract, stop.
                        </p>
                    </div>
                </section>

                {/* Activity */}
                <section aria-labelledby="activity" className="mt-14 grid gap-6 md:grid-cols-2">
                    <div className={`${panel} p-6`}>
                        <div className="flex items-center justify-between gap-3">
                            <h2 id="activity" className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
                                <RefreshCw size={16} className="text-yellow-500" aria-hidden="true" /> Your migrations
                            </h2>
                            <button
                                type="button"
                                onClick={loadActivity}
                                disabled={isLoadingActivity}
                                className="text-[10px] font-bold uppercase tracking-widest text-gray-500 transition-colors hover:text-white disabled:opacity-50"
                            >
                                {isLoadingActivity ? 'Loading…' : 'Refresh'}
                            </button>
                        </div>
                        {isLoadingActivity ? (
                            <div className="flex justify-center py-10">
                                <Loader className="h-6 w-6 animate-spin text-gray-600" aria-hidden="true" />
                            </div>
                        ) : myActivity.length > 0 ? (
                            <ul className="mt-3">
                                {myActivity.map((record) => (
                                    <MigrationRow key={record.txHash} record={record} />
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-4 text-sm text-gray-500">
                                {activityError
                                    ? 'The history for this wallet could not be read from Polygon right now.'
                                    : walletAddress
                                        ? 'No migration events for this wallet yet. Once you migrate, it shows up here with the exact on-chain amounts.'
                                        : 'Connect a wallet to see the migration history for that address.'}
                            </p>
                        )}
                    </div>

                    <div className={`${panel} p-6`}>
                        <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
                            <Coins size={16} className="text-yellow-500" aria-hidden="true" /> Recent community migrations
                        </h2>
                        {activity.length > ACTIVITY_VISIBLE && (
                            <p className="mt-2 text-[11px] text-gray-600">
                                Showing the {ACTIVITY_VISIBLE} most recent of {activity.length} recorded
                                migrations.
                            </p>
                        )}
                        {isLoadingActivity ? (
                            <div className="flex justify-center py-10">
                                <Loader className="h-6 w-6 animate-spin text-gray-600" aria-hidden="true" />
                            </div>
                        ) : activityError ? (
                            <p className="mt-4 text-sm text-amber-300/80">{activityError}</p>
                        ) : activity.length > 0 ? (
                            <ul className="mt-3">
                                {activity.slice(0, ACTIVITY_VISIBLE).map((record) => (
                                    <MigrationRow key={record.txHash} record={record} showWallet />
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-4 text-sm text-gray-500">
                                No migration events were found on chain. The history is read straight from
                                Polygon, so an empty list means nothing has been migrated yet.
                            </p>
                        )}
                        <p className="mt-4 text-[11px] leading-relaxed text-gray-600">
                            Every row is a{' '}
                            <code className="text-gray-400">Migrated</code> event emitted by the migration
                            contract. The ratio shown is the ratio that event actually used.
                        </p>
                    </div>
                </section>

                <p className="mt-14 text-center text-xs text-gray-600">
                    Designed for the Coalition community. Baltimore hustle, global standard.
                </p>
            </div>
        </div>
    );
};

/** The one-way icon — kept local so the import list stays small. */
const FlameIcon: React.FC = () => (
    <span className="mb-3 block text-red-500" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
        </svg>
    </span>
);

export default MigrationPage;
