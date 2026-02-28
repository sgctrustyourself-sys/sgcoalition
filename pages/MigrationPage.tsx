import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowRight, Wallet, AlertTriangle, CheckCircle, Flame, ExternalLink, RefreshCw, Shield, Loader, XCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import {
    MIGRATION_RATIO,
    calculateV2Amount,
    getMigrationRatioDisplay,
    SGCOIN_V1_CONTRACT_ADDRESS,
    SGCOIN_V2_CONTRACT_ADDRESS,
    SGCOIN_MIGRATOR_ADDRESS,
    POLYGON_CHAIN_ID
} from '../constants';
import { AuthProvider } from '../types';
import { ethers } from 'ethers';
import { getAllowance, approveTokens, getSGCoinBalance } from '../services/web3Service';

const MigrationPage: React.FC = () => {
    const { user, loginUser, chainId, switchToPolygon, refreshBalances } = useApp();
    const { addToast } = useToast();
    const [v1Balance, setV1Balance] = useState<bigint>(0n);
    const [allowance, setAllowance] = useState<bigint>(0n);
    const [migrateAmount, setMigrateAmount] = useState<string>('');
    const [isApproving, setIsApproving] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [step, setStep] = useState<'input' | 'success'>('input');
    const [txHash, setTxHash] = useState<string>('');

    const isWrongNetwork = chainId !== null && chainId !== POLYGON_CHAIN_ID;

    const v1AmountNumber = parseFloat(migrateAmount) || 0;
    const v2Expected = v1AmountNumber > 0 ? calculateV2Amount(v1AmountNumber).toFixed(6) : '0.00';

    const fetchData = async () => {
        if (!user || !user.walletAddress || isWrongNetwork) return;

        setIsRefreshing(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const bal = await getSGCoinBalance(user.walletAddress, provider);
            // Convert to bigint (V1 has 9 decimals)
            setV1Balance(ethers.parseUnits(bal.toString(), 9));

            const allow = await getAllowance(SGCOIN_V1_CONTRACT_ADDRESS, user.walletAddress, SGCOIN_MIGRATOR_ADDRESS, provider);
            setAllowance(allow);
        } catch (error) {
            console.error('Error fetching migration data:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user, chainId]);

    const handleMax = () => {
        setMigrateAmount(ethers.formatUnits(v1Balance, 9));
    };

    const handleApprove = async () => {
        if (!window.ethereum) return;

        // 1. Validate amount is > 0
        const amountToApprove = ethers.parseUnits(migrateAmount || '0', 9);
        if (amountToApprove <= 0n) {
            addToast('Please enter an amount greater than 0', 'error');
            return;
        }

        setIsApproving(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();

            // 2. Approve Max Amount (Infinite Approval)
            // This prevents users from needing to re-approve for every migration
            const hash = await approveTokens(SGCOIN_V1_CONTRACT_ADDRESS, SGCOIN_MIGRATOR_ADDRESS, ethers.MaxUint256, signer);

            if (hash) {
                addToast('Approval successful! Your allowance is now permanent.', 'success');
                await fetchData(); // Refresh allowance
            } else {
                throw new Error('Transaction rejected or failed');
            }
        } catch (error: any) {
            console.error('Approval failed:', error);
            const errorMessage = error.reason || error.message || 'Transaction failed';
            addToast(`Approval failed: ${errorMessage}`, 'error');
        } finally {
            setIsApproving(false);
        }
    };

    const handleMigrate = async () => {
        if (!user || !window.ethereum) return;
        setIsMigrating(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const amountToMigrate = ethers.parseUnits(migrateAmount, 9);

            // 1. Check Allowance Logic
            const currentAllowance = await getAllowance(SGCOIN_V1_CONTRACT_ADDRESS, user.walletAddress, SGCOIN_MIGRATOR_ADDRESS, provider);
            if (currentAllowance < amountToMigrate) {
                // If allowance is insufficient, force a refresh and check again (just in case)
                const freshAllowance = await getAllowance(SGCOIN_V1_CONTRACT_ADDRESS, user.walletAddress, SGCOIN_MIGRATOR_ADDRESS, provider);
                if (freshAllowance < amountToMigrate) {
                    throw new Error("Insufficient Allowance. Please wait for Approval transaction to confirm.");
                }
            }

            // Standard Migrator ABI
            const migratorAbi = ['function migrate(uint256 amount) external'];
            const migrator = new ethers.Contract(SGCOIN_MIGRATOR_ADDRESS, migratorAbi, signer);

            // 2. Estimate Gas
            let gasLimit;
            try {
                const estimatedGas = await migrator.migrate.estimateGas(amountToMigrate);
                // Add 20% buffer
                gasLimit = (estimatedGas * 120n) / 100n;
            } catch (gasError) {
                console.warn('Gas estimation failed, using fallback:', gasError);
                // Fallback gas limit if estimation fails (rare but possible on Polygon)
                gasLimit = 300000n;
            }

            // 3. Send Transaction
            const tx = await migrator.migrate(amountToMigrate, { gasLimit });
            const receipt = await tx.wait();

            setTxHash(receipt.hash);
            setStep('success');
            await fetchData(); // Refresh local balances
            await refreshBalances(); // Refresh global balances
        } catch (error: any) {
            console.error("Full Migration Error:", error);
            const reason = error.reason || error.message || "Unknown error";

            // User friendly error mapping
            let userMessage = "Migration Failed: " + reason;
            if (reason.includes("User rejected")) {
                userMessage = "Transaction rejected by user.";
            } else if (reason.includes("Insufficient Allowance")) {
                userMessage = reason;
            }

            addToast(userMessage, 'error');
        } finally {
            setIsMigrating(false);
        }
    };

    const renderCTA = () => {
        if (!user) {
            return (
                <button
                    onClick={() => loginUser(AuthProvider.METAMASK)}
                    className="w-full bg-white text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                >
                    <Wallet size={20} /> Connect Wallet
                </button>
            );
        }

        if (isWrongNetwork) {
            return (
                <button
                    onClick={switchToPolygon}
                    className="w-full bg-yellow-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-500 transition-colors"
                >
                    <RefreshCw size={20} /> Switch to Polygon
                </button>
            );
        }

        const amountToMigrate = ethers.parseUnits(migrateAmount || '0', 9);
        const needsApproval = allowance < amountToMigrate;

        if (needsApproval) {
            return (
                <>
                    <button
                        onClick={handleApprove}
                        disabled={v1AmountNumber <= 0 || isApproving}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isApproving ? <RefreshCw className="animate-spin" /> : <Flame size={20} />}
                        Approve SGCOIN V1
                    </button>
                    <p className="text-[10px] text-center text-gray-500 mt-2 font-bold uppercase tracking-widest">One-time permanent approval</p>
                </>
            );
        }

        return (
            <button
                onClick={handleMigrate}
                disabled={v1AmountNumber <= 0 || isMigrating}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shimmer-effect"
            >
                {isMigrating ? <RefreshCw className="animate-spin" /> : <ArrowRight size={20} />}
                Migrate to SGCOIN V2
            </button>
        );
    };

    if (step === 'success') {
        return (
            <div className="min-h-screen pt-32 pb-12 px-4 bg-black flex items-center justify-center">
                <div className="max-w-md w-full bg-gray-900 border border-green-500/30 p-8 rounded-3xl text-center">
                    <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-3xl font-bold mb-2">Migration Successful!</h2>
                    <p className="text-gray-400 mb-8">Your V1 tokens have been burned and V2 tokens minted to your wallet.</p>

                    <div className="bg-black/50 p-6 rounded-2xl border border-white/5 space-y-4 text-left mb-8">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-sm font-bold uppercase">Amount</span>
                            <span className="text-white font-mono">{v1AmountNumber.toLocaleString()} V1</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-sm font-bold uppercase">Received</span>
                            <span className="text-green-400 font-mono font-bold">{v2Expected} V2</span>
                        </div>
                    </div>

                    <a
                        href={`https://polygonscan.com/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 text-blue-400 hover:text-blue-300 transition-colors mb-8"
                    >
                        View on Polygonscan <ExternalLink size={16} />
                    </a>

                    <button
                        onClick={() => window.location.href = '/'}
                        className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-32 pb-12 px-4 bg-gradient-to-b from-black via-gray-900 to-black text-white">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-16 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-yellow-500/10 blur-[100px] -z-10"></div>
                    <h1 className="text-6xl md:text-7xl font-bold tracking-tighter mb-6 bg-gradient-to-r from-white via-white to-gray-500 bg-clip-text text-transparent">
                        THE GREAT MIGRATION
                    </h1>
                    <p className="text-xl text-gray-400 border-l-2 border-yellow-500/50 pl-6 max-w-2xl mx-auto inline-block text-left">
                        Seamlessly upgrade your SGCOIN V1 tokens.
                        <span className="block text-yellow-500 font-bold mt-1">Fair flat ratio: Everyone gets {getMigrationRatioDisplay()}</span>
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 items-stretch mb-12">
                    {/* V1 Card */}
                    <div className="bg-gray-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl flex flex-col relative group overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl group-hover:bg-red-500/10 transition-colors"></div>
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 tracking-[0.3em] uppercase mb-1">Legacy Token</h3>
                                <p className="text-2xl font-bold">SGCOIN (V1)</p>
                            </div>
                            {user && (
                                <div className="flex items-center gap-2 bg-white/5 py-1 px-3 rounded-full border border-white/10">
                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Connected</span>
                                </div>
                            )}
                        </div>

                        <div className="flex-grow">
                            <div className="mb-8">
                                <label className="text-[10px] font-bold text-gray-600 uppercase tracking-widest block mb-2">Available Balance</label>
                                <div className="flex items-end gap-2">
                                    <p className="text-4xl font-mono font-bold truncate">
                                        {user ? parseFloat(ethers.formatUnits(v1Balance, 9)).toLocaleString() : '---'}
                                    </p>
                                    <span className="text-gray-600 font-bold mb-1">V1</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase">Amount to Migrate</p>
                                        <button onClick={handleMax} className="text-[10px] font-bold text-yellow-500 hover:text-yellow-400 uppercase">Use Max</button>
                                    </div>
                                    <div className="relative group">
                                        <input
                                            type="number"
                                            value={migrateAmount}
                                            onChange={(e) => setMigrateAmount(e.target.value)}
                                            className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-xl font-mono focus:outline-none focus:border-yellow-500/50 transition-all placeholder:text-gray-800"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Fair Ratio Display */}
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">Migration System</span>
                                        <span className="text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider bg-green-500/10 text-green-400 border border-green-500/20">
                                            Fair & Equal
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Exchange Ratio</span>
                                        <span className="font-mono font-bold text-white tracking-widest">{getMigrationRatioDisplay()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col gap-2">
                            <div className="flex justify-between text-[10px] font-bold text-gray-600 uppercase">
                                <span>Verified Contract</span>
                                <a
                                    href={`https://polygonscan.com/token/${SGCOIN_V1_CONTRACT_ADDRESS}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white hover:text-yellow-500 flex items-center gap-1"
                                >
                                    View <ExternalLink size={10} />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* V2 Card */}
                    <div className="bg-gradient-to-br from-yellow-500/[0.03] to-transparent backdrop-blur-xl border border-yellow-500/20 p-8 rounded-3xl flex flex-col relative group overflow-hidden">
                        <div className="absolute bottom-0 right-0 w-48 h-48 bg-yellow-500/5 blur-3xl -z-10 group-hover:bg-yellow-500/10 transition-all duration-500"></div>

                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-xs font-bold text-yellow-600/80 tracking-[0.3em] uppercase mb-1">New Standard</h3>
                                <p className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">SGCOIN (V2)</p>
                            </div>
                            <div className={`flex items-center gap-2 py-1 px-3 rounded-full border border-yellow-500/20 ${isWrongNetwork ? 'bg-red-500/10 border-red-500/20' : 'bg-yellow-500/10'}`}>
                                <div className={`w-2 h-2 rounded-full ${isWrongNetwork ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                                <span className={`text-[10px] font-bold uppercase ${isWrongNetwork ? 'text-red-400' : 'text-yellow-500'}`}>
                                    {isWrongNetwork ? 'Wrong Network' : 'Polygon'}
                                </span>
                            </div>
                        </div>

                        <div className="flex-grow flex flex-col justify-center py-8">
                            <label className="text-[10px] font-bold text-yellow-600/60 uppercase tracking-widest block mb-4 text-center">Estimated V2 Output</label>
                            <div className="text-center">
                                <div className="flex justify-center items-end gap-3 mb-2">
                                    <p className="text-6xl font-bold tracking-tighter text-white">
                                        {v2Expected}
                                    </p>
                                    <span className="text-yellow-500 font-bold text-xl mb-2">V2</span>
                                </div>
                                <p className="text-xs text-gray-500 font-mono">≈ ${(parseFloat(v2Expected) * 0.045).toFixed(2)} USD</p>
                            </div>
                        </div>

                        <div className="mt-auto space-y-4">
                            {renderCTA()}

                            <div className="pt-6 border-t border-white/5 flex flex-col gap-2">
                                <div className="flex justify-between text-[10px] font-bold text-gray-600 uppercase">
                                    <span>Verified Migrator</span>
                                    <a
                                        href={`https://polygonscan.com/address/${SGCOIN_MIGRATOR_ADDRESS}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-white hover:text-yellow-500 flex items-center gap-1"
                                    >
                                        Inspect <ExternalLink size={10} />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Safety Guards */}
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                        <Flame className="text-red-500 mb-4" size={24} />
                        <h4 className="font-bold mb-2">One-Way Burn</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Migration is irreversible. V1 tokens are permanently destroyed to mint your new V2 standard tokens.
                        </p>
                    </div>
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                        <Shield className="text-green-500 mb-4" size={24} />
                        <h4 className="font-bold mb-2">Verified Sync</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Every transaction is executed on-chain. We do not hold your keys or tokens during the migration.
                        </p>
                    </div>
                    <div className="p-6 bg-white/5 border border-white/10 rounded-2xl">
                        <RefreshCw className="text-blue-500 mb-4" size={24} />
                        <h4 className="font-bold mb-2">Equal Treatment</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            Every holder receives the same {getMigrationRatioDisplay()} ratio, ensuring fairness and rewarding loyalty equally.
                        </p>
                    </div>
                </div>

                <div className="mt-12 text-center text-xs text-gray-600">
                    <p>Designed for the Coalition Community. Baltimore hustle, global standard.</p>
                </div>
            </div>
        </div>
    );
};

export default MigrationPage;
