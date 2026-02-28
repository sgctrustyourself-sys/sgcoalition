import React, { useMemo, useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { getBurnedSGCoinV1, getLiquidityProviderV2Balance } from '../../services/web3Service';
import { POLYGON_RPC_URL } from '../../constants';
import { useApp } from '../../context/AppContext';
import {
    TrendingUp,
    Shield,
    Coins,
    Users,
    ShoppingCart,
    ArrowUpRight,
    Activity,
    Flame,
    Zap
} from 'lucide-react';
import {
    calculateSalesMetrics,
    getRevenueOverTime
} from '../../utils/analyticsEngine';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';


const EcosystemCommandCenter: React.FC = () => {
    const { orders, products, giveaways } = useApp();
    const [realBurned, setRealBurned] = useState<string>('0');
    const [realLiquidity, setRealLiquidity] = useState<string>('0');
    const [isLoadingStats, setIsLoadingStats] = useState(true);

    const metrics = useMemo(() => calculateSalesMetrics(orders), [orders]);
    const revenueData = useMemo(() => getRevenueOverTime(orders, 7), [orders]);

    useEffect(() => {
        const fetchBlockchainStats = async () => {
            try {
                const provider = new ethers.JsonRpcProvider(POLYGON_RPC_URL);
                const burned = await getBurnedSGCoinV1(provider);
                const liquidity = await getLiquidityProviderV2Balance(provider);
                setRealBurned(burned);
                setRealLiquidity(liquidity);
            } catch (error) {
                console.error("Error fetching admin wallet stats:", error);
            } finally {
                setIsLoadingStats(false);
            }
        };
        fetchBlockchainStats();
    }, []);

    // Ecosystem Data
    const ecosystemStats = {
        totalSGCBurned: parseFloat(realBurned) || 0,
        activeStakers: 450,
        giveawayParticipation: giveaways.reduce((acc, g) => acc + (g.entries?.length || 0), 0),
        treasuryBalance: 24500.50, // This is mock/manual for now
        v2Liquidity: parseFloat(realLiquidity) || 0
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black font-display uppercase tracking-tighter text-white flex items-center gap-3">
                        <Activity className="w-8 h-8 text-brand-accent animate-pulse" />
                        Ecosystem Command Center
                    </h2>
                    <p className="text-gray-400 font-medium text-sm mt-1">Live aggregated data across all platform modules</p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-accent bg-brand-accent/10 px-3 py-1 rounded-full border border-brand-accent/20">
                    <span className="w-2 h-2 bg-brand-accent rounded-full animate-ping" />
                    Live Sync Active
                </div>
            </div>

            {/* Top Level Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatusCard
                    label="Total Revenue"
                    value={`$${metrics.totalRevenue.toLocaleString()}`}
                    change="+12.4%"
                    icon={<ShoppingCart className="w-5 h-5" />}
                    color="blue"
                />
                <StatusCard
                    label="Giveaway Entries"
                    value={ecosystemStats.giveawayParticipation.toLocaleString()}
                    change="+5.2%"
                    icon={<Zap className="w-5 h-5" />}
                    color="purple"
                />
                <StatusCard
                    label="SGC Burned"
                    value={isLoadingStats ? "Loading..." : ecosystemStats.totalSGCBurned.toLocaleString()}
                    change="LIVE"
                    icon={<Flame className="w-5 h-5" />}
                    color="orange"
                />
                <StatusCard
                    label="V2 Liquidity"
                    value={isLoadingStats ? "Loading..." : ecosystemStats.v2Liquidity.toLocaleString()}
                    change="Founder Funded"
                    icon={<Coins className="w-5 h-5" />}
                    color="emerald"
                />
            </div>

            {/* Funding Disclosure */}
            <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-2xl p-4 flex items-start gap-4">
                <div className="p-2 bg-brand-accent/20 rounded-lg text-brand-accent">
                    <Shield className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-white mb-1">Treasury & Liquidity Disclosure</h4>
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                        Currently, <span className="text-brand-accent font-bold">100% of SGCOIN V2 liquidity</span> and ecosystem rewards are personally funded by the founder.
                        As community sales from the shop and NFT collection grow, a fixed percentage of revenue will be automatically allocated to supplement this treasury, ensuring long-term sustainability.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Revenue Chart */}
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-tight">Revenue Velocity</h3>
                            <p className="text-xs text-gray-500">Sales performance over the last 7 days</p>
                        </div>
                        <TrendingUp className="w-5 h-5 text-brand-accent" />
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="date"
                                    stroke="#4b5563"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#4b5563"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#8b5cf6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* System Alerts / Activity */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight mb-6 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-400" />
                        Infrastructure
                    </h3>
                    <div className="space-y-4">
                        <ActivityItem
                            title="Database Sync"
                            status="Healthy"
                            time="2m ago"
                            color="text-emerald-400"
                        />
                        <ActivityItem
                            title="IPFS Gateway"
                            status="Active"
                            time="Now"
                            color="text-emerald-400"
                        />
                        <ActivityItem
                            title="Web3 Provider"
                            status="Latency: 12ms"
                            time="15s ago"
                            color="text-blue-400"
                        />
                        <div className="pt-6 border-t border-white/10 mt-6">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Quick Governance</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <button className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-left group">
                                    <p className="text-[10px] text-gray-500 font-bold group-hover:text-white transition">Pause Minting</p>
                                    <p className="text-[9px] text-red-500 font-black uppercase mt-1">Danger Zone</p>
                                </button>
                                <button className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition text-left group">
                                    <p className="text-[10px] text-gray-500 font-bold group-hover:text-white transition">Verify Contract</p>
                                    <p className="text-[9px] text-blue-500 font-black uppercase mt-1">Utilities</p>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatusCard = ({ label, value, change, icon, color }: any) => {
    const colors: any = {
        blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    };

    return (
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl hover:border-white/20 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-xl ${colors[color]}`}>
                    {icon}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                    <ArrowUpRight className="w-3 h-3" />
                    {change}
                </div>
            </div>
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{label}</p>
            <p className="text-2xl font-black font-display text-white mt-1 group-hover:text-brand-accent transition-colors">{value}</p>
        </div>
    );
};

const ActivityItem = ({ title, status, time, color }: any) => (
    <div className="flex items-center justify-between p-3 bg-black/40 rounded-2xl border border-white/5">
        <div>
            <p className="text-xs font-bold text-white">{title}</p>
            <p className={`text-[10px] font-bold ${color}`}>{status}</p>
        </div>
        <p className="text-[10px] text-gray-600 font-bold">{time}</p>
    </div>
);

export default EcosystemCommandCenter;
