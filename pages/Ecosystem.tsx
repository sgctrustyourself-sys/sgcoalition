import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ExternalLink, Gift, Clock, Users, CheckCircle, ArrowRight } from 'lucide-react';
import SGCoinCard from '../components/SGCoinCard';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { fetchSGCoinData, fetchRecentTrades } from '../utils/sgcoinApi';
import { addGiveawayEntry } from '../utils/giveawayUtils';

const Ecosystem = () => {
    const { user, giveaways } = useApp();
    const { addToast } = useToast();
    const [coinData, setCoinData] = useState<any>(null);
    const [trades, setTrades] = useState<any[]>([]);
    const [activeGiveaway, setActiveGiveaway] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [hasEntered, setHasEntered] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const data = await fetchSGCoinData();
            setCoinData(data);
            const recentTrades = await fetchRecentTrades(data?.price || 0);
            setTrades(recentTrades);
        };

        loadData();
        const interval = setInterval(loadData, 30000);
        return () => clearInterval(interval);
    }, []);

    // Load Active Giveaway
    useEffect(() => {
        const active = giveaways.find(g => g.status === 'active');
        setActiveGiveaway(active || null);

        // Check if user has already entered
        if (active && user) {
            const entered = active.entries.some(e => e.email === user.email || e.userId === user.uid);
            setHasEntered(entered);
        }
    }, [giveaways, user]);

    const handleEnterGiveaway = async () => {
        if (!activeGiveaway) return;
        if (!email && !user) {
            addToast('Please enter your email to join.', 'warning');
            return;
        }

        try {
            await addGiveawayEntry({
                id: `entry_${Date.now()}`,
                giveawayId: activeGiveaway.id,
                userId: user?.uid,
                name: user?.displayName || email.split('@')[0],
                email: user?.email || email,
                entryCount: 1,
                timestamp: Date.now(),
                source: 'form'
            });
            setHasEntered(true);
            addToast('You have successfully entered the giveaway!', 'success');
        } catch (error: any) {
            addToast('Failed to enter giveaway: ' + error.message, 'error');
        }
    };

    return (
        <div className="bg-black min-h-screen text-white">
            {/* Hero Section */}
            <div className="relative h-[60vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black opacity-90 z-10"></div>
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>

                <div className="relative z-20 text-center px-4 max-w-4xl mx-auto">
                    <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-6">
                        The <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Ecosystem</span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
                        A decentralized economy powered by SGCoin. Stake, earn, and unlock exclusive rewards in the Coalition universe.
                    </p>
                </div>
            </div>

            {/* Live SGCoin Data */}
            <div className="max-w-7xl mx-auto px-4 -mt-20 relative z-30 mb-12">
                <SGCoinCard data={coinData} />

                <div className="mt-8 text-center">
                    <Link
                        to="/buy-sgcoin"
                        className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white font-display font-bold text-xl uppercase tracking-widest py-5 px-12 rounded-full hover:scale-105 transition-transform shadow-lg shadow-purple-500/20 border border-white/10"
                    >
                        ( Click Here To Buy SGCOIN/GMONEY from Coalition )
                    </Link>
                </div>
            </div>

            {/* DexScreener Live Chart */}
            <div className="max-w-7xl mx-auto px-4 mb-24">
                <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-800">
                        <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-3">
                            <ExternalLink className="text-blue-400" />
                            Live Trading Chart
                        </h2>
                        <p className="text-gray-400 text-sm mt-2">
                            Real-time SGCOIN / WBTC trading data on QuickSwap (Polygon)
                        </p>
                    </div>
                    <div className="relative w-full h-[600px]">
                        <iframe
                            src="https://dexscreener.com/polygon/0x951806a2581c22C478aC613a675e6c898E2aBe21?embed=1&theme=dark&trades=0&info=0"
                            className="w-full h-full border-0"
                            title="DexScreener SGCOIN Chart"
                        />
                    </div>
                    <div className="p-4 bg-black/50 border-t border-gray-800">
                        <a
                            href="https://dexscreener.com/polygon/0x951806a2581c22C478aC613a675e6c898E2aBe21"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-2 justify-center"
                        >
                            View Full Chart on DexScreener <ExternalLink size={14} />
                        </a>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="max-w-7xl mx-auto px-4 pb-24 grid grid-cols-1 lg:grid-cols-3 gap-12">

                {/* Left Column: Token Info & Staking */}
                <div className="lg:col-span-2 space-y-12">

                    {/* Token Utility */}
                    <section>
                        <h2 className="font-display text-3xl font-bold uppercase mb-8 flex items-center gap-3">
                            <Trophy className="text-yellow-500" /> Token Utility
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 hover:border-gray-700 transition">
                                <h3 className="font-bold text-xl mb-3 text-blue-400">Governance</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Holders vote on future product drops, charity initiatives, and brand direction. Your voice shapes the Coalition.
                                </p>
                            </div>
                            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 hover:border-gray-700 transition">
                                <h3 className="font-bold text-xl mb-3 text-purple-400">Staking Rewards</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Lock your SGCoin to earn APY and gain early access to limited edition merchandise.
                                </p>
                            </div>
                            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 hover:border-gray-700 transition">
                                <h3 className="font-bold text-xl mb-3 text-green-400">Marketplace</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Use SGCoin to purchase exclusive items in the shop with zero transaction fees.
                                </p>
                            </div>
                            <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 hover:border-gray-700 transition">
                                <h3 className="font-bold text-xl mb-3 text-pink-400">NFT Integration</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Connect your wallet to verify ownership of Coalition NFTs and unlock digital-physical twins.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Roadmap / Future */}
                    <section className="bg-gradient-to-r from-gray-900 to-black p-8 rounded-2xl border border-gray-800">
                        <h2 className="font-display text-2xl font-bold uppercase mb-6">The Roadmap</h2>
                        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:w-0.5 before:bg-gray-800">
                            <div className="relative pl-12">
                                <div className="absolute left-4 top-2 w-4 h-4 bg-green-500 rounded-full border-4 border-gray-900"></div>
                                <h4 className="font-bold text-lg text-white">Phase 1: Launch</h4>
                                <p className="text-gray-400 text-sm">Token deployment, website launch, and initial merch drop.</p>
                            </div>
                            <div className="relative pl-12">
                                <div className="absolute left-4 top-2 w-4 h-4 bg-blue-500 rounded-full border-4 border-gray-900"></div>
                                <h4 className="font-bold text-lg text-white">Phase 2: Expansion</h4>
                                <p className="text-gray-400 text-sm">Staking platform, community governance, and charity partnerships.</p>
                            </div>
                            <div className="relative pl-12">
                                <div className="absolute left-4 top-2 w-4 h-4 bg-gray-700 rounded-full border-4 border-gray-900"></div>
                                <h4 className="font-bold text-lg text-gray-500">Phase 3: Metaverse</h4>
                                <p className="text-gray-500 text-sm">Virtual showroom and digital-only fashion collections.</p>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column: Giveaway Widget */}
                <div className="lg:col-span-1">
                    <div className="sticky top-24">
                        <div className="bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-gray-800 p-1 shadow-2xl overflow-hidden">
                            {/* Gradient Border Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 animate-pulse"></div>

                            <div className="relative bg-gray-900 rounded-xl p-6 h-full flex flex-col">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded uppercase animate-pulse">
                                        Live Now
                                    </div>
                                    <Gift className="text-purple-400 w-6 h-6" />
                                </div>

                                {activeGiveaway ? (
                                    <>
                                        <h3 className="font-display text-3xl font-bold uppercase mb-2 leading-none">
                                            {activeGiveaway.title}
                                        </h3>
                                        <p className="text-gray-400 text-sm mb-6">
                                            {activeGiveaway.description || "Enter now for a chance to win exclusive rewards!"}
                                        </p>

                                        <div className="bg-black/50 rounded-lg p-4 mb-6 border border-gray-800">
                                            <div className="text-xs text-gray-500 uppercase font-bold mb-1">Current Prize</div>
                                            <div className="text-xl font-bold text-white">{activeGiveaway.prize}</div>
                                            {activeGiveaway.prizeImage && (
                                                <img src={activeGiveaway.prizeImage} alt="Prize" className="mt-3 rounded w-full h-32 object-cover" />
                                            )}
                                        </div>

                                        <div className="space-y-3 mb-6">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-500 flex items-center gap-2"><Clock size={14} /> Ends In</span>
                                                <span className="font-mono font-bold text-yellow-500">
                                                    {Math.max(0, Math.ceil((new Date(activeGiveaway.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} Days
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-gray-500 flex items-center gap-2"><Users size={14} /> Entries</span>
                                                <span className="font-mono font-bold text-blue-400">{activeGiveaway.entries.length}</span>
                                            </div>
                                        </div>

                                        {hasEntered ? (
                                            <div className="bg-green-900/30 border border-green-800 p-4 rounded-lg text-center">
                                                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                                <h4 className="font-bold text-green-400">You're In!</h4>
                                                <p className="text-xs text-green-300">Good luck! Winner announced soon.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <a
                                                    href={`/#/giveaway/${activeGiveaway.id}`}
                                                    className="block w-full bg-white text-black font-bold uppercase py-3 rounded hover:bg-gray-200 transition text-center flex items-center justify-center gap-2"
                                                >
                                                    Enter Giveaway <ArrowRight size={16} />
                                                </a>
                                                <p className="text-xs text-center text-gray-600">
                                                    Follow @sgcoalition, like a post, and share to your story to enter!
                                                </p>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-12">
                                        <Trophy className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                        <h3 className="font-bold text-xl text-gray-500">No Active Giveaways</h3>
                                        <p className="text-gray-600 text-sm mt-2">Check back soon for new rewards!</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Ecosystem;
