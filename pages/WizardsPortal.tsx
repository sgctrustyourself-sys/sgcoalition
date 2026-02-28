import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Zap, Flame, Sparkles, Wand2, Globe, Database, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchSGCoinData } from '../utils/sgcoinApi';
import { useApp } from '../context/AppContext';
import { ethers } from 'ethers';
import { getBurnedSGCoinV1, getRobustProvider } from '../services/web3Service';
import { POLYGON_RPC_URL } from '../constants';
import { useLiquidity } from '../hooks/useLiquidity';

const WizardsPortal = () => {
    const { user } = useApp();
    const walletAddress = user?.walletAddress;
    const [coinData, setCoinData] = useState<any>(null);
    const [totalBurned, setTotalBurned] = useState<string>("1,777,161+ SGC");

    // Dynamic Liquidity Tracking
    const {
        liquidity,
        target,
        progress,
        currentUSDValue,
        isLoading: isLiquidityLoading
    } = useLiquidity();

    const tokenStats = {
        price: coinData?.price ? `$${coinData.price.toFixed(6)}` : "$0.0000382",
        burned: totalBurned
    };

    useEffect(() => {
        const loadStats = async () => {
            try {
                const data = await fetchSGCoinData();
                setCoinData(data);

                // Fetch real burn data
                const provider = await getRobustProvider();
                const burned = await getBurnedSGCoinV1(provider);
                setTotalBurned(`${parseFloat(burned).toLocaleString()} SGC`);
            } catch (error) {
                console.error("Error loading coin stats:", error);
            }
        };
        loadStats();
    }, []);

    return (
        <div className="bg-[#050505] text-white min-h-screen font-sans selection:bg-purple-500/30 overflow-x-hidden">

            {/* Arcane Background Layers */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-[80%] h-[80%] bg-purple-600/5 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-0 left-0 w-[60%] h-[60%] bg-blue-600/5 blur-[120px] rounded-full animate-pulse delay-[3000ms]" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-[0.1] mix-blend-screen" />
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-[60] border-b border-white/5 backdrop-blur-xl bg-black/40">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                            <Wand2 className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-display font-black tracking-tighter text-2xl uppercase">MiniWizards</span>
                    </Link>
                    <div className="flex items-center gap-10 text-[10px] uppercase tracking-[0.4em] font-bold">
                        <Link to="/" className="text-gray-400 hover:text-orange-400 transition-colors">Coalition</Link>
                        <Link to="/migrate" className="text-purple-400 hover:text-purple-300 transition-colors">Migration</Link>
                        {walletAddress ? (
                            <Link
                                to="/sgminiwizards/dashboard"
                                className="bg-purple-600 text-white px-6 py-2.5 rounded-full hover:bg-purple-700 transition-all font-black tracking-widest"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <Link to="/sgcoin" className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2.5 rounded-full hover:from-purple-700 hover:to-blue-700 transition-all transform hover:scale-105 active:scale-95 shadow-lg font-black tracking-widest relative">
                                <span className="absolute -top-2 -right-2 bg-green-400 text-black text-[7px] px-1.5 py-0.5 rounded-full font-black">+10%</span>
                                Buy Direct
                            </Link>
                        )}
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-40 relative z-10">

                {/* Hero Feature: The Arcane Core */}
                <section className="px-6 mb-32">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                            <motion.div
                                initial={{ opacity: 0, x: -30 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.8 }}
                            >
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 text-purple-400 text-[10px] mb-8 uppercase tracking-[0.3em] font-bold"
                                >
                                    <Sparkles className="w-3 h-3" /> Arcane Ecosystem Powered
                                </motion.div>
                                <h1 className="text-8xl md:text-[11rem] font-black uppercase tracking-tighter leading-[0.7] mb-10 font-display">
                                    Digital<br />
                                    <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-purple-500 bg-clip-text text-transparent italic">Legacy</span>
                                </h1>
                                <p className="text-xl md:text-2xl text-gray-400 font-light max-w-xl mb-12 leading-relaxed">
                                    The <span className="text-white font-medium">MiniWizards Portal</span> bridges the SGC Arcane Economy across dimensions. From <span className="text-white font-medium">V1 Legacy Wizards</span> to the new <span className="text-white font-medium">WAX Blockchain chain</span> by SurudoiRyu.
                                </p>
                                <div className="flex flex-wrap gap-6">
                                    {walletAddress ? (
                                        <Link to="/sgminiwizards/dashboard">
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest text-xs flex items-center gap-3 rounded-full shadow-2xl hover:bg-purple-600 hover:text-white transition-all"
                                            >
                                                Enter Dashboard <Zap className="w-4 h-4" />
                                            </motion.button>
                                        </Link>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <Link to="/sgcoin">
                                                <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    className="px-12 py-5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-black uppercase tracking-widest text-xs flex items-center gap-3 rounded-full shadow-2xl hover:from-purple-700 hover:to-blue-700 transition-all relative overflow-hidden group"
                                                >
                                                    <span className="absolute top-1 right-1 bg-green-400 text-black text-[8px] px-2 py-0.5 rounded-full font-black">+10% BONUS</span>
                                                    Buy Direct <Zap className="w-4 h-4" />
                                                </motion.button>
                                            </Link>
                                            <a href="https://dapp.quickswap.exchange/swap/best/ETH/0xd53e417107D0e01bBE74a704BB90fe7A6916eE1e" target="_blank" rel="noopener noreferrer">
                                                <motion.button
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    className="px-12 py-5 bg-white/10 border border-white/20 text-white font-black uppercase tracking-widest text-xs flex items-center gap-3 rounded-full hover:bg-white/20 transition-all"
                                                >
                                                    Or Swap <ArrowUpRight className="w-4 h-4" />
                                                </motion.button>
                                            </a>
                                        </div>
                                    )}
                                    <Link to="/migrate">
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            className="px-12 py-5 border border-white/10 text-white font-black uppercase tracking-widest text-xs flex items-center gap-3 backdrop-blur-xl rounded-full bg-white/5 hover:bg-white/10 transition-all"
                                        >
                                            Burn V1 Legacy <Flame className="w-4 h-4 text-purple-500" />
                                        </motion.button>
                                    </Link>
                                </div>
                            </motion.div>

                            {/* Trans-Dimensional Ecosystem (Cross-Chain) */}
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="lg:col-span-1 border border-white/10 bg-black/50 p-10 rounded-[2.5rem]"
                            >
                                <div className="space-y-8">
                                    <div className="p-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-blue-900/20 to-black relative overflow-hidden group hover:border-blue-400/30 transition-all">
                                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                            <Globe className="w-24 h-24 text-blue-400" />
                                        </div>
                                        <h3 className="text-2xl font-black uppercase tracking-tight mb-4 text-blue-400">NeftyBlocks</h3>
                                        <p className="text-gray-500 text-xs leading-relaxed mb-6">
                                            Forged by SurudoiRyu. Dimensional expansion manifested on WAX Origin Chain.
                                        </p>
                                        <a
                                            href="https://neftyblocks.com/collection/sgminiwizard"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-500 text-white rounded-full font-black uppercase tracking-widest text-[9px] hover:bg-blue-600 transition-all"
                                        >
                                            Explore <ArrowUpRight className="w-3 h-3" />
                                        </a>
                                    </div>

                                    <div className="p-8 rounded-[2rem] border border-white/10 bg-gradient-to-br from-purple-900/20 to-black relative overflow-hidden group hover:border-purple-400/30 transition-all">
                                        <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                            <Database className="w-24 h-24 text-purple-400" />
                                        </div>
                                        <h3 className="text-2xl font-black uppercase tracking-tight mb-4 text-purple-400">V1 Wizards</h3>
                                        <p className="text-gray-500 text-xs leading-relaxed mb-6">
                                            The Original Ignition. Explore the genesis collection on OpenSea.
                                        </p>
                                        <a
                                            href="https://opensea.io/collection/spazgang-miniwizards"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-6 py-2.5 border border-purple-500/30 text-purple-400 rounded-full font-black uppercase tracking-widest text-[9px] hover:bg-purple-500/10 transition-all"
                                        >
                                            View Collection <ArrowUpRight className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            </motion.section>
                        </div>
                    </div>
                </section>

                <section className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 mb-32">
                    {/* Liquidity Progress Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="p-10 rounded-[2.5rem] border border-white/10 bg-white/[0.02] backdrop-blur-3xl relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                        <div className="relative z-10">
                            {isLiquidityLoading ? (
                                <div className="animate-pulse space-y-6">
                                    <div className="h-6 bg-white/5 rounded w-1/3" />
                                    <div className="h-12 bg-white/5 rounded w-2/3" />
                                    <div className="h-4 bg-white/5 rounded w-full" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-10">
                                        <div>
                                            <div className="flex items-center gap-3 text-purple-400 mb-4">
                                                <Zap className="w-6 h-6 animate-pulse" />
                                                <span className="text-xs font-black uppercase tracking-[0.4em]">Strategic Liquidity Goal</span>
                                            </div>
                                            <div className="text-5xl md:text-6xl font-black tracking-tighter">
                                                {liquidity.toFixed(2)} <span className="text-gray-600 font-light text-3xl">/ {target} POL</span>
                                            </div>
                                            <p className="text-gray-500 text-sm mt-4 font-medium uppercase tracking-widest italic">
                                                Current Valuation: <span className="text-white">${currentUSDValue} USD</span>
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-500">
                                                {progress.toFixed(1)}%
                                            </div>
                                            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-gray-500">Activation Progress</div>
                                        </div>
                                    </div>

                                    {/* Neon Progress Bar */}
                                    <div className="h-4 w-full bg-white/5 rounded-full p-1 border border-white/10 overflow-hidden relative">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(progress, 100)}%` }}
                                            transition={{ duration: 2, ease: "easeOut" }}
                                            className="h-full bg-gradient-to-r from-purple-600 via-blue-500 to-purple-400 rounded-full relative"
                                        >
                                            <div className="absolute inset-0 bg-white/20 blur-sm" />
                                        </motion.div>
                                    </div>
                                    <div className="flex justify-between mt-4">
                                        <span className="text-[9px] uppercase tracking-widest font-bold text-gray-600">Foundation Stage</span>
                                        <span className="text-[9px] uppercase tracking-widest font-bold text-purple-500 animate-pulse">Arcane Threshold: {target} POL</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>

                    {/* Stat Grid: High-Precision Glass Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {[
                            { label: 'Market Cap', value: coinData?.marketCap ? `$${(coinData.marketCap / 1000).toFixed(0)}K` : '$450K', icon: <Globe className="w-5 h-5" />, color: 'purple' },
                            { label: 'Circulating Supply', value: '10,000,000', icon: <Database className="w-5 h-5" />, color: 'blue' },
                            { label: 'Current Price', value: tokenStats.price, icon: <TrendingUp className="w-5 h-5" />, color: 'purple' },
                            { label: 'Legacy V1 Burned', value: totalBurned, icon: <Flame className="w-5 h-5" />, color: 'blue' },
                        ].map((stat, idx) => (
                            <div key={idx} className="p-8 rounded-3xl border border-white/5 bg-white/[0.03] backdrop-blur-3xl group hover:border-purple-500/20 transition-all">
                                <div className={`p-3 rounded-xl bg-${stat.color === 'purple' ? 'purple' : 'blue'}-500/10 border border-${stat.color === 'purple' ? 'purple' : 'blue'}-500/20 w-fit mb-6 group-hover:scale-110 transition-transform`}>
                                    {React.cloneElement(stat.icon as React.ReactElement<any>, { className: `w-6 h-6 text-${stat.color === 'purple' ? 'purple' : 'blue'}-400` })}
                                </div>
                                <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-gray-500 mb-2">{stat.label}</div>
                                <div className="text-3xl font-black tracking-tight text-white">{stat.value}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="px-6">
                    <div className="max-w-7xl mx-auto rounded-[3rem] border border-white/5 bg-gradient-to-br from-purple-900/10 via-black to-blue-900/10 p-12 md:p-24 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-12 opacity-[0.05] group-hover:rotate-12 transition-transform duration-1000">
                            <Wand2 className="w-64 h-64" />
                        </div>
                        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                            <div>
                                <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-8 font-display">
                                    The Arcane<br />
                                    <span className="text-purple-500">Infrastructure</span>
                                </h2>
                                <p className="text-gray-400 text-xl leading-relaxed mb-10 max-w-xl font-light">
                                    Leveraging the speed of Polygon to create a high-velocity reward loop. The Arcane Ecosystem isn't just about trading—it's about <span className="text-white">sustained brand equity</span>.
                                </p>
                                <Link to="/ecosystem" className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[0.4em] text-white hover:text-purple-400 transition-all border-b border-white/20 hover:border-purple-500 pb-3">
                                    Project Dynamics <ArrowUpRight className="w-4 h-4" />
                                </Link>
                            </div>
                            <div className="space-y-4">
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-6 group hover:bg-white/10 transition-all">
                                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center font-black">01</div>
                                    <div className="text-sm font-bold uppercase tracking-widest">Deflationary Supply Mechanics</div>
                                </div>
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-6 group hover:bg-white/10 transition-all">
                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center font-black">02</div>
                                    <div className="text-sm font-bold uppercase tracking-widest">Verified Digital Provenance</div>
                                </div>
                                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-6 group hover:bg-white/10 transition-all">
                                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center font-black">03</div>
                                    <div className="text-sm font-bold uppercase tracking-widest">Multi-Tier Holder Rewards</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="py-20 px-6 border-t border-white/5 text-center">
                <div className="text-[10px] uppercase tracking-[0.5em] font-bold text-gray-700">
                    © 2026 MiniWizards | Powered by SGCoalition Technology
                </div>
            </footer>
        </div>
    );
};

export default WizardsPortal;
