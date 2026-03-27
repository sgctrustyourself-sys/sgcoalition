import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Flame, Shield, Coins, ArrowUpRight, TrendingUp, Info, RefreshCw, Wallet } from 'lucide-react';
import { ethers } from 'ethers';
import { getBurnedSGCoinV1, getLiquidityProviderV2Balance, getRecentBurnActivity, BurnActivity, getRobustProvider, getNativeBalance } from '../services/web3Service';
import { POLYGON_RPC_URL, TREASURY_WALLET_ADDRESS, QUICKSWAP_LP_ADDRESS, QUICKSWAP_V3_LP_ADDRESS, WPOL_ADDRESS } from '../constants';
import DashboardLayout from '../components/layouts/DashboardLayout';

const TreasuryPage: React.FC = () => {
    const [realBurned, setRealBurned] = useState<string>('0');
    const [totalLiquidity, setTotalLiquidity] = useState<number>(0);
    const [treasuryBalance, setTreasuryBalance] = useState<string>('0');
    const [burnActivity, setBurnActivity] = useState<BurnActivity[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const provider = await getRobustProvider();

                // Fetch stats in parallel
                const [burned, v2LpBalance, treasuryBal, activity] = await Promise.all([
                    getBurnedSGCoinV1(provider),
                    getLiquidityProviderV2Balance(provider),
                    getNativeBalance(TREASURY_WALLET_ADDRESS, provider),
                    getRecentBurnActivity(provider)
                ]);

                // Also fetch V3 and V2 liquidity (MATIC/WPOL) similar to useLiquidity
                const [v2Native, v3Native] = await Promise.all([
                    provider.getBalance(QUICKSWAP_LP_ADDRESS),
                    provider.getBalance(QUICKSWAP_V3_LP_ADDRESS)
                ]);

                const wpolContract = new ethers.Contract(WPOL_ADDRESS, ['function balanceOf(address owner) view returns (uint256)'], provider);
                const [v2Wpol, v3Wpol] = await Promise.all([
                    wpolContract.balanceOf(QUICKSWAP_LP_ADDRESS),
                    wpolContract.balanceOf(QUICKSWAP_V3_LP_ADDRESS)
                ]);

                const totalLiq = parseFloat(ethers.formatEther(v2Native)) +
                    parseFloat(ethers.formatEther(v3Native)) +
                    parseFloat(ethers.formatUnits(v2Wpol, 18)) +
                    parseFloat(ethers.formatUnits(v3Wpol, 18));

                // Total burned formatted similarly to Ecosystem dashboard
                setRealBurned(burned);
                setTotalLiquidity(totalLiq);
                setTreasuryBalance(treasuryBal);
                setBurnActivity(activity);
            } catch (error) {
                console.error("Error fetching treasury stats:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <DashboardLayout>
            <div className="space-y-10">
                {/* Header */}
                <div>
                    <h1 className="text-4xl font-display font-black uppercase tracking-tighter mb-2 flex items-center gap-3">
                        <Zap className="w-8 h-8 text-brand-accent animate-pulse" />
                        Arcane Treasury
                    </h1>
                    <p className="text-gray-500 font-medium max-w-2xl">
                        Transparent, real-time tracking of the SGC ecosystem reserves, burn events, and strategic liquidity funding.
                    </p>
                </div>

                {/* Primary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <StatCard
                        label="Total SGC V1 Burned"
                        value={isLoading ? "Loading..." : `${parseFloat(realBurned).toLocaleString()} SGC`}
                        subtext="Permanent reduction in legacy supply"
                        icon={<Flame className="w-5 h-5" />}
                        color="orange"
                    />
                    <StatCard
                        label="Ecosystem Liquidity"
                        value={isLoading ? "Loading..." : `${totalLiquidity.toLocaleString(undefined, { maximumFractionDigits: 1 })} MATIC`}
                        subtext="Combined V2 & V3 Reserves"
                        icon={<Coins className="w-5 h-5" />}
                        color="purple"
                    />
                    <StatCard
                        label="Treasury Balance"
                        value={isLoading ? "Loading..." : `${parseFloat(treasuryBalance).toLocaleString(undefined, { maximumFractionDigits: 1 })} MATIC`}
                        subtext="Protocol Managed Reserves"
                        icon={<Wallet className="w-5 h-5" />}
                        color="blue"
                    />
                </div>

                {/* Transparency Disclosure */}
                <section className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-10 opacity-[0.05]">
                        <Shield className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-2xl font-black uppercase tracking-tight mb-6 flex items-center gap-3">
                            <Info className="w-6 h-6 text-brand-accent" />
                            Funding & Sustainability Model
                        </h2>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-4">
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    To ensure a fair and stable migration from SGCOIN V1 to V2, the founder of the SG Coalition has <span className="text-white font-bold">personally provided 100% of the initial V2 liquidity</span> and migration reserves.
                                </p>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Unlike most projects that rely on pre-sales or VC funding, SGC V2 is built on organic growth and founder commitment. This eliminates "rug-pull" risks and ensures that the long-term holders are prioritized.
                                </p>
                            </div>
                            <div className="space-y-4 p-6 bg-brand-accent/5 border border-brand-accent/10 rounded-2xl">
                                <h3 className="text-xs font-black uppercase tracking-widest text-brand-accent">Future Evolution</h3>
                                <p className="text-[11px] text-gray-500 leading-relaxed italic">
                                    "As community sales from our merchandise shop, NFT collections, and integrated dApps grow, a portion of every transaction will be auto-allocated to maintain and expand this treasury. This moves us toward a community-sustained liquidity model while maintaining my personal backing."
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Live Activity & Strategic Goals */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Live Burn Feed */}
                    <div className="p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.01] relative overflow-hidden group">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                                <RefreshCw className="w-5 h-5 text-brand-accent animate-spin-slow" />
                                Live Burn Feed
                            </h3>
                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest border border-white/10 px-3 py-1 rounded-full">
                                Total Live Signals: {burnActivity.length}
                            </span>
                        </div>

                        <div className="space-y-4">
                            {isLoading ? (
                                [1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 animate-pulse rounded-2xl" />)
                            ) : burnActivity.length > 0 ? (
                                burnActivity.map((activity, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-brand-accent/20 transition-all group/item">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                                                <Flame className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-white">
                                                    {parseFloat(activity.amount).toLocaleString()} SGC {activity.type === 'migration' ? 'Migrated' : 'Burned'}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-medium">
                                                    via {activity.address?.slice(0, 6)}...{activity.address?.slice(-4)}
                                                </div>
                                            </div>
                                        </div>
                                        <a
                                            href={`https://polygonscan.com/tx/${activity.txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                            title="View Transaction"
                                        >
                                            <ArrowUpRight className="w-4 h-4" />
                                        </a>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-gray-600 italic text-sm">
                                    No recent burn transfers detected in the last 5000 blocks.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.01] hover:bg-white/5 transition-all group">
                            <TrendingUp className="w-8 h-8 text-blue-400 mb-6 group-hover:scale-110 transition-transform" />
                            <h3 className="text-lg font-bold uppercase tracking-tight mb-2">Liquidity Threshold</h3>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Our primary goal is to reach <span className="text-white font-bold">500 POL</span> in the QuickSwap V2 pair to enable deep liquidity and institutional-grade trading volume.
                            </p>
                        </div>
                        <div className="p-8 rounded-3xl border border-white/5 bg-white/[0.01] hover:bg-white/5 transition-all group">
                            <Flame className="w-8 h-8 text-orange-400 mb-6 group-hover:scale-110 transition-transform" />
                            <h3 className="text-lg font-bold uppercase tracking-tight mb-2">Burn Velocity</h3>
                            <p className="text-xs text-brand-accent font-black uppercase tracking-widest mb-2">~450 SGC / Hour</p>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Migration burns were designed with marginal rates to encourage smaller holders. This ensures the V2 supply remains scarce and highly valued.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

const StatCard = ({ label, value, subtext, icon, color }: any) => {
    const colors: any = {
        orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    };

    return (
        <div className="p-8 rounded-[2rem] border border-white/5 bg-white/[0.02] backdrop-blur-3xl group hover:border-white/20 transition-all">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${colors[color]}`}>
                {icon}
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-500 mb-1">{label}</div>
            <div className="text-3xl font-black font-display text-white mb-2">{value}</div>
            <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{subtext}</div>
        </div>
    );
};

export default TreasuryPage;
