import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Trophy, ExternalLink, Gift, Clock, Users, CheckCircle, ArrowRight, MessageCircle, Star, Share2, DollarSign, ShoppingBag, Wallet, Flame, Zap, Shield, Sparkles, Activity } from 'lucide-react';
import SGCoinCard from '../components/SGCoinCard';
import LiveTransactions from '../components/LiveTransactions';
import BurnTracker from '../components/BurnTracker';
import FeeTransparency from '../components/FeeTransparency';
import FeedbackLoop from '../components/FeedbackLoop';
import { useApp } from '../context/AppContext';
import { fetchSGCoinData, fetchRecentTrades } from '../utils/sgcoinApi';
import { getGiveawayTicketCount, isSubscriberEligible } from '../utils/giveawayUtils';

import { V2_REWARD_RATE, POLYGON_RPC_URL, POLYGON_RPC_URLS } from '../constants';
import { getBurnedSGCoinV1 } from '../services/web3Service';
import { ethers } from 'ethers';

const Ecosystem = () => {
    const { user, giveaways } = useApp();
    const [coinData, setCoinData] = useState<any>(null);
    const [trades, setTrades] = useState<any[]>([]);
    const [totalBurned, setTotalBurned] = useState<string>('1,777,161');
    const [activeGiveaway, setActiveGiveaway] = useState<any>(null);
    const [hasEntered, setHasEntered] = useState(false);
    const [isLoadingCoinData, setIsLoadingCoinData] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoadingCoinData(true);
            try {
                // Try multiple RPCs for the burn stats
                let provider = new ethers.JsonRpcProvider(POLYGON_RPC_URLS[0]);
                try {
                    await provider.getNetwork();
                } catch (e) {
                    provider = new ethers.JsonRpcProvider(POLYGON_RPC_URLS[1]);
                }

                const [data, burned] = await Promise.all([
                    fetchSGCoinData(),
                    getBurnedSGCoinV1(provider)
                ]);

                setCoinData(data);
                setTotalBurned(burned);

                const recentTrades = await fetchRecentTrades(data?.price || 0);
                setTrades(recentTrades);
            } catch (error) {
                console.error('Error loading ecosystem data:', error);
            } finally {
                setIsLoadingCoinData(false);
            }
        };

        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    // Load Active Giveaway
    useEffect(() => {
        const active = giveaways.find(g => g.status === 'active');
        setActiveGiveaway(active || null);
        setHasEntered(Boolean(active && user && (isSubscriberEligible(user) || active.entries.some(e => e.email === user.email || e.userId === user.uid))));
    }, [giveaways, user]);

    return (
        <div className="bg-[#050505] text-white min-h-screen font-sans selection:bg-orange-500/30 overflow-x-hidden">

            {/* Ambient Background Layers */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-0 w-[100%] h-[100%] bg-gradient-to-br from-orange-600/5 via-transparent to-purple-600/5 blur-[120px]" />
                <div className="absolute top-[20%] right-[10%] w-96 h-96 bg-orange-500/10 blur-[150px] rounded-full animate-pulse" />
                <div className="absolute bottom-[20%] left-[10%] w-96 h-96 bg-purple-500/10 blur-[150px] rounded-full animate-pulse" />
            </div>

            <main className="relative z-10">
                {/* Hero Section: Cyber-Luxe Welcome */}
                <section className="relative h-[80vh] flex items-center justify-center px-6 overflow-hidden">
                    {/* ... (Hero Content) ... */}
                    <div className="max-w-7xl mx-auto text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 text-orange-400 text-[10px] mb-10 uppercase tracking-[0.3em] font-bold"
                        >
                            <Zap className="w-3 h-3" /> System Synchronized
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="text-7xl md:text-[11.5rem] font-black uppercase tracking-tighter leading-[0.7] mb-12 font-display"
                        >
                            Ecosystem<br />
                            <span className="bg-gradient-to-r from-orange-400 via-purple-400 to-orange-500 bg-clip-text text-transparent italic">Dynamics</span>
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                            className="text-xl md:text-2xl text-gray-400 font-light max-w-2xl mx-auto mb-16 leading-relaxed"
                        >
                            Welcome to the <span className="text-white font-medium">high-velocity rewards layer</span> of SG Coalition. Earn, burn, and optimize your equity in the digital-physical synthesis.
                        </motion.p>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.6 }}
                            className="flex flex-wrap gap-6 justify-center"
                        >
                            <Link to="/sgminiwizards">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    className="relative group px-14 py-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black uppercase tracking-widest text-xs flex items-center gap-3 rounded-full shadow-[0_0_30px_rgba(147,51,234,0.3)] hover:shadow-[0_0_50px_rgba(147,51,234,0.5)] transition-all overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
                                    <Sparkles size={16} className="animate-pulse" />
                                    Wizard Dashboard
                                </motion.button>
                            </Link>
                            <Link to="/migrate">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    className="px-14 py-6 bg-white text-black font-black uppercase tracking-widest text-xs flex items-center gap-3 rounded-full shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:bg-orange-500 hover:text-white transition-all"
                                >
                                    Access Migration <ArrowRight size={16} />
                                </motion.button>
                            </Link>
                            <Link to="/tutorial/welcome">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    className="px-14 py-6 border border-white/10 text-white font-black uppercase tracking-widest text-xs flex items-center gap-3 backdrop-blur-xl rounded-full bg-white/5 hover:bg-white/10 transition-all font-bold"
                                >
                                    Ecosystem Guide
                                </motion.button>
                            </Link>
                        </motion.div>
                    </div>
                </section>

                {/* SGCoin Stats: The Core Data Module */}
                <section className="max-w-7xl mx-auto px-6 -mt-32 mb-40 relative z-30">
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <SGCoinCard data={coinData} isLoading={isLoadingCoinData} />
                    </motion.div>
                </section>

                <section className="max-w-7xl mx-auto px-6 mb-24 relative z-30">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.8 }}
                    >
                        <BurnTracker initialBurn={totalBurned} />
                    </motion.div>
                </section>

                <div className="max-w-7xl mx-auto px-6 pb-40 grid grid-cols-1 lg:grid-cols-12 gap-16 font-bold">
                    {/* Left Column: Utility Infrastructure */}
                    <div className="lg:col-span-8 space-y-24">

                        {/* Ways to Earn: Functional Blocks */}
                        <motion.section
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            id="ways-to-earn"
                        >
                            <div className="flex items-center gap-4 mb-16">
                                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                                    <Trophy className="text-orange-400" />
                                </div>
                                <div>
                                    <h2 className="font-display text-4xl font-black uppercase tracking-tighter">Utility Acquisition</h2>
                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">Multiple Stream Integration</p>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                {[
                                    { icon: <MessageCircle />, title: 'Community Pulse', desc: 'Participate in governance & discourse to build brand social weight.', color: 'blue' },
                                    { icon: <Star />, title: 'Signal Feedback', desc: 'Direct feedback loops on physical product R&D earn deep equity.', color: 'purple' },
                                    { icon: <Share2 />, title: 'Digital Amplification', desc: 'High-quality content creation integrated with SGC Oracle verification.', color: 'pink' },
                                    { icon: <DollarSign />, title: 'Referral Synthesis', desc: 'Up to 40% commissions on physical-digital hybrid bridge sales.', color: 'orange' }
                                ].map((way, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: idx * 0.1, duration: 0.5 }}
                                        className="p-8 rounded-[2rem] border border-white/5 bg-white/[0.03] backdrop-blur-3xl group hover:border-orange-500/20 transition-all"
                                    >
                                        <div className="bg-white/5 w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform border border-white/5 font-bold">
                                            {React.cloneElement(way.icon as React.ReactElement<any>, { className: 'w-6 h-6 text-white' })}
                                        </div>
                                        <h3 className="font-display text-2xl font-black uppercase tracking-tight mb-4">{way.title}</h3>
                                        <p className="text-gray-400 text-sm leading-relaxed font-light">{way.desc}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.section>

                        {/* Value & Redemption Layer */}
                        <section className="grid md:grid-cols-2 gap-12">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="bg-gradient-to-br from-white/[0.05] to-transparent p-12 rounded-[3rem] border border-white/10 backdrop-blur-xl"
                            >
                                <h2 className="font-display text-3xl font-black uppercase tracking-tighter mb-10 flex items-center gap-4">
                                    <Sparkles className="text-orange-500" /> Redemption Loop
                                </h2>
                                <div className="space-y-6">
                                    {[
                                        { icon: <ShoppingBag />, title: 'Asset Packs', desc: 'Redeem for limited physical metadata.', color: 'purple' },
                                        { icon: <Clock />, title: 'Temporal Priority', desc: 'Early access to high-velocity drops.', color: 'orange' },
                                        { icon: <ArrowRight />, title: 'Protocol Conversion', desc: 'Trade for extended community access.', color: 'blue' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-6 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all font-bold">
                                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                                                {React.cloneElement(item.icon as React.ReactElement<any>, { className: 'w-5 h-5 text-white' })}
                                            </div>
                                            <div>
                                                <h4 className="font-display text-lg font-black uppercase tracking-tight">{item.title}</h4>
                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            {/* Calculator Module */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="bg-black p-12 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden font-bold"
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                                    <Activity className="w-32 h-32" />
                                </div>
                                <h2 className="font-display text-3xl font-black uppercase tracking-tighter mb-10 flex items-center gap-4 relative z-10">
                                    <DollarSign className="text-orange-500" /> Value Matrix
                                </h2>
                                <div className="space-y-8 relative z-10">
                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/5 text-center">
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Core Exchange rate</div>
                                        <div className="text-3xl font-black font-display tracking-tight text-white">1 SGC V2 = $0.045</div>
                                    </div>

                                    <div className="space-y-4 font-bold">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Reward Projection</label>
                                        <div className="relative">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 font-mono">$</span>
                                            <input
                                                type="number"
                                                placeholder="100.00"
                                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-12 pr-6 text-white text-xl font-mono focus:border-orange-500/50 focus:outline-none transition-all"
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    const rewardsInUsd = val * V2_REWARD_RATE;
                                                    const sgV2Tokens = (rewardsInUsd / 0.045);
                                                    const el = document.getElementById('calc-output');
                                                    if (el) el.innerText = sgV2Tokens.toFixed(1).toLocaleString();
                                                }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between px-2 pt-2">
                                            <span className="text-[10px] text-gray-500 uppercase tracking-widest">Projected SGC V2</span>
                                            <div className="text-2xl font-black font-display text-orange-500 tracking-tighter">
                                                <span id="calc-output">25.0</span> SGC
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </section>

                        {/* Integration Transmissions */}
                        <LiveTransactions />

                        {/* Concept Feedback Loop */}
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                        >
                            <FeedbackLoop />
                        </motion.div>
                    </div>

                    {/* Right Column: Giveaways & Authority */}
                    <div className="lg:col-span-4">
                        <div className="sticky top-32 space-y-12">
                            {/* Giveaway Card */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: 0.2 }}
                                className="relative group"
                            >
                                <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-purple-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                                <div className="relative bg-black rounded-[2.5rem] border border-white/10 p-10 overflow-hidden font-bold">
                                    <div className="flex items-center justify-between mb-10">
                                        <div className="bg-orange-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                                            In Transit
                                        </div>
                                        <Gift className="text-white/20 w-8 h-8" />
                                    </div>

                                    {activeGiveaway ? (
                                        <>
                                            <h3 className="font-display text-4xl font-black uppercase tracking-tighter leading-none mb-4">
                                                {activeGiveaway.title}
                                            </h3>
                                            <p className="text-gray-400 text-sm font-light leading-relaxed mb-10">
                                                {activeGiveaway.description || "Secure your allocation in the upcoming reward cycle."}
                                            </p>

                                            <div className="space-y-6 mb-12">
                                                <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                                                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2">Target Asset</div>
                                                    <div className="text-3xl font-black font-display text-white italic">{activeGiveaway.prize}</div>
                                                </div>

                                                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-black text-gray-500 px-2">
                                                    <div className="flex items-center gap-2"><Clock size={12} /> Cycle Reset: <span className="text-white">5D</span></div>
                                                    <div className="flex items-center gap-2"><Users size={12} /> Tickets: <span className="text-white">{getGiveawayTicketCount(activeGiveaway.entries)}</span></div>
                                                </div>
                                            </div>

                                            {hasEntered ? (
                                                <div className="p-8 rounded-3xl bg-orange-500/10 border border-orange-500/20 text-center">
                                                    <CheckCircle className="w-10 h-10 text-orange-500 mx-auto mb-4" />
                                                    <div className="font-display text-xl font-black uppercase text-orange-400">Signal Logged</div>
                                                    <p className="text-[10px] text-orange-500/60 uppercase tracking-widest mt-1 font-bold">Awaiting oracle confirmation</p>
                                                </div>
                                            ) : (
                                                <Link to={`/giveaway/${activeGiveaway.id}`}>
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        className="w-full bg-white text-black font-black uppercase py-6 rounded-full text-xs tracking-widest hover:bg-orange-500 hover:text-white transition-all shadow-2xl"
                                                    >
                                                        Log Signal <ArrowRight size={16} className="inline ml-2" />
                                                    </motion.button>
                                                </Link>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-24">
                                            <Sparkles className="w-16 h-16 text-gray-800 mx-auto mb-6 opacity-20" />
                                            <div className="font-display text-2xl font-black uppercase text-gray-700">Awaiting Signal</div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>

                            {/* Fee Transparency */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: 0.4 }}
                            >
                                <FeeTransparency />
                            </motion.div>

                            {/* Authority Box */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: 0.6 }}
                                className="p-10 rounded-[2.5rem] bg-white/[0.02] border border-white/5 backdrop-blur-3xl font-bold"
                            >
                                <h4 className="font-display text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-3">
                                    <Shield className="w-5 h-5 text-gray-500" /> SGC Architecture
                                </h4>
                                <ul className="space-y-6">
                                    <li className="flex items-start gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5" />
                                        <p className="text-xs text-gray-400 leading-relaxed"><span className="text-white font-black">MetaMask Core</span>: Wallet infrastructure required for reward receipt.</p>
                                    </li>
                                    <li className="flex items-start gap-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5" />
                                        <p className="text-xs text-gray-400 leading-relaxed"><span className="text-white font-black">Polygon Mainnet</span>: Low-latency, high-precision execution.</p>
                                    </li>
                                </ul>
                                <Link to="/signup" className="mt-8 block w-full py-4 text-center border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all font-bold">
                                    Initialize Identity →
                                </Link>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Ecosystem;
