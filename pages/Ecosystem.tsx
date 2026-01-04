import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ExternalLink, Gift, Clock, Users, CheckCircle, ArrowRight, MessageCircle, UserPlus, Star, Share2, DollarSign, ShoppingBag, Wallet, ShieldCheck, Activity, BarChart3 } from 'lucide-react';
import SGCoinCard from '../components/SGCoinCard';
import LiveTransactions from '../components/LiveTransactions';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { fetchSGCoinData, fetchRecentTrades } from '../utils/sgcoinApi';
import { addGiveawayEntry } from '../utils/giveawayUtils';
import Seo from '../components/Seo';

const Ecosystem = () => {
    const { user, giveaways } = useApp();
    const { addToast } = useToast();
    const [coinData, setCoinData] = useState<any>(null);
    const [trades, setTrades] = useState<any[]>([]);
    const [activeGiveaway, setActiveGiveaway] = useState<any>(null);
    const [email, setEmail] = useState('');
    const [hasEntered, setHasEntered] = useState(false);
    const [isLoadingCoinData, setIsLoadingCoinData] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoadingCoinData(true);
            const data = await fetchSGCoinData();
            setCoinData(data);
            const recentTrades = await fetchRecentTrades(data?.price || 0);
            setTrades(recentTrades);
            setIsLoadingCoinData(false);
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
            <Seo
                title="Ecosystem & SGCoin"
                description="Earn points, rewards, and cash commissions. Join the Coalition Economy."
            />
            {/* Hero Section */}
            <div className="relative h-[70vh] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black opacity-90 z-10"></div>
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1639762681485-074b7f938ba0?q=80&w=2832&auto=format&fit=crop')] bg-cover bg-center opacity-40"></div>

                <div className="relative z-20 text-center px-4 max-w-5xl mx-auto">
                    <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-6">
                        SG Coalition <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Rewards System</span>
                    </h1>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
                        Welcome to the SG Coalition Rewards Program! Earn points, rewards, and even cash commissions for supporting the community, sharing feedback, and helping spread the word.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/signup" className="bg-white text-black font-bold uppercase tracking-widest py-4 px-8 rounded hover:bg-gray-200 transition-all">
                            Join Now
                        </Link>
                    </div>
                    <div className="mt-8 flex justify-center gap-6">
                        <a href="https://zapper.xyz/token/polygon/0x951806a2581c22c478ac613a675e6c898e2abe21/SGCOIN/details" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition text-xs font-mono flex items-center gap-2">
                            ZAPPER.XYZ <ExternalLink size={12} />
                        </a>
                        <a href="https://dexscreener.com/polygon/0x951806a2581c22c478ac613a675e6c898e2abe21" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition text-xs font-mono flex items-center gap-2">
                            DEXSCREENER.COM <ExternalLink size={12} />
                        </a>
                    </div>
                </div>
            </div>

            {/* Live SGCoin Data */}
            <div className="max-w-7xl mx-auto px-4 -mt-24 relative z-30 mb-20">
                <SGCoinCard data={coinData} isLoading={isLoadingCoinData} />
            </div>

            <div className="max-w-7xl mx-auto px-4 pb-24 grid grid-cols-1 lg:grid-cols-3 gap-12">

                {/* Left Column: Main Content */}
                <div className="lg:col-span-2 space-y-20">

                    {/* What is SGCOIN? */}
                    <section id="about-sgcoin">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 rounded-xl bg-brand-accent/20 flex items-center justify-center">
                                <ShieldCheck className="text-brand-accent" size={24} />
                            </div>
                            <h2 className="font-display text-4xl font-bold uppercase tracking-tight">What is <span className="text-brand-accent">SGCOIN</span>?</h2>
                        </div>
                        <div className="prose prose-invert max-w-none">
                            <p className="text-xl text-gray-300 leading-relaxed">
                                SGCOIN is the native digital currency of the SG Coalition Ecosystem. Built on the Polygon network for speed and low cost, it serves as the foundation of our decentralized rewards economy. Unlike traditional points programs, SGCOIN is a real digital asset that you truly own.
                            </p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-6 mt-12">
                            <div className="bg-gray-900/30 p-6 rounded-xl border border-gray-800">
                                <h4 className="font-bold text-white mb-2">Decentralized</h4>
                                <p className="text-sm text-gray-400">Operates on Polygon PoS, ensuring transparency and security through blockchain technology.</p>
                            </div>
                            <div className="bg-gray-900/30 p-6 rounded-xl border border-gray-800">
                                <h4 className="font-bold text-white mb-2">Liquid</h4>
                                <p className="text-sm text-gray-400">Has real market value and active liquidity pools, allowing for trade and exchange.</p>
                            </div>
                            <div className="bg-gray-900/30 p-6 rounded-xl border border-gray-800">
                                <h4 className="font-bold text-white mb-2">Community Driven</h4>
                                <p className="text-sm text-gray-400">Total supply and distribution is designed to reward active participants and long-term supporters.</p>
                            </div>
                        </div>
                    </section>

                    {/* Token Utility */}
                    <section id="utility">
                        <h2 className="font-display text-3xl font-bold uppercase mb-8 flex items-center gap-3">
                            <Activity className="text-brand-accent" /> Token Utility & Perks
                        </h2>
                        <div className="grid sm:grid-cols-2 gap-4">
                            {[
                                { title: 'Product Redemptions', desc: 'Use SGCOIN to buy exclusive hoodies, tees, and digital goods.', icon: ShoppingBag },
                                { title: 'Early Access', desc: 'SGCoin holders get 24h head start on all seasonal drops.', icon: Clock },
                                { title: 'Governance', desc: 'Vote on upcoming designs and community initiatives.', icon: Users },
                                { title: 'VIP Events', desc: 'Exclusive access to live pop-ups and secret community meets.', icon: Star }
                            ].map((util, i) => (
                                <div key={i} className="flex gap-4 p-5 bg-white/5 rounded-xl border border-white/10 hover:border-brand-accent/50 transition group">
                                    <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0 group-hover:scale-110 transition">
                                        <util.icon className="text-gray-400 group-hover:text-brand-accent" size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white">{util.title}</h4>
                                        <p className="text-sm text-gray-400">{util.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Ways to Earn */}
                    <section id="ways-to-earn">
                        <h2 className="font-display text-3xl font-bold uppercase mb-8 flex items-center gap-3">
                            <Trophy className="text-yellow-500" /> Ways to Earn SGCOIN Points
                        </h2>
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Community Engagement */}
                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 hover:border-blue-500/50 transition duration-300 group">
                                <div className="bg-blue-500/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition">
                                    <MessageCircle className="text-blue-400" />
                                </div>
                                <h3 className="font-bold text-xl mb-3 text-white">Community Engagement</h3>
                                <ul className="space-y-2 text-gray-400 text-sm">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500 mt-1">•</span>
                                        <span><strong>Join the Conversation:</strong> Participate in discussions and share your style.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-500 mt-1">•</span>
                                        <span><strong>Invite Friends:</strong> Get bonus points for every member who joins Discord using your link.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Support & Feedback */}
                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 hover:border-purple-500/50 transition duration-300 group">
                                <div className="bg-purple-500/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-500/20 transition">
                                    <Star className="text-purple-400" />
                                </div>
                                <h3 className="font-bold text-xl mb-3 text-white">Support & Feedback</h3>
                                <ul className="space-y-2 text-gray-400 text-sm">
                                    <li className="flex items-start gap-2">
                                        <span className="text-purple-500 mt-1">•</span>
                                        <span><strong>Product Feedback:</strong> Each meaningful review earns you points!</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-purple-500 mt-1">•</span>
                                        <span><strong>Complete Surveys:</strong> Help us improve and receive points as a thank-you.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Social Media */}
                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 hover:border-pink-500/50 transition duration-300 group">
                                <div className="bg-pink-500/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-pink-500/20 transition">
                                    <Share2 className="text-pink-400" />
                                </div>
                                <h3 className="font-bold text-xl mb-3 text-white">Social Media Support</h3>
                                <ul className="space-y-2 text-gray-400 text-sm">
                                    <li className="flex items-start gap-2">
                                        <span className="text-pink-500 mt-1">•</span>
                                        <span><strong>Tag Us:</strong> Post on Instagram, Twitter, or TikTok and tag us.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-pink-500 mt-1">•</span>
                                        <span><strong>Create Content:</strong> Exceptional posts earn extra points and exclusive rewards!</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Sales & Referrals */}
                            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 hover:border-green-500/50 transition duration-300 group">
                                <div className="bg-green-500/10 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-500/20 transition">
                                    <DollarSign className="text-green-400" />
                                </div>
                                <h3 className="font-bold text-xl mb-3 text-white">Sales & Referrals</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Refer friends or customers to purchase items, and earn <strong className="text-green-400">cash commissions of up to 40%</strong> on each sale made through your referral link.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Value & Redemption */}
                    <section className="grid md:grid-cols-2 gap-8">
                        <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-2xl border border-gray-800">
                            <h2 className="font-display text-2xl font-bold uppercase mb-6 flex items-center gap-2">
                                <DollarSign className="text-green-500" /> SGCOIN Value
                            </h2>
                            <div className="bg-black/40 p-4 rounded-lg border border-gray-700 mb-6 text-center">
                                <p className="text-sm text-gray-400 uppercase tracking-widest mb-1">Current Exchange Rate</p>
                                <p className="text-2xl font-mono font-bold text-white">30,000 SGCOIN = $1 USD</p>
                            </div>

                            {/* Interactive Calculator */}
                            <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700 mb-4">
                                <label className="text-xs font-bold uppercase text-gray-400 mb-3 block">Rewards Calculator</label>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-500 mb-2">If you spend:</div>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">$</span>
                                            <input
                                                type="number"
                                                placeholder="100"
                                                className="w-full bg-black/50 border border-gray-600 rounded py-3 pl-10 pr-4 text-white text-lg focus:border-brand-accent focus:outline-none"
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    const rewards = val * 0.25 * 30000;
                                                    const el = document.getElementById('calc-output');
                                                    if (el) el.innerText = Math.floor(rewards).toLocaleString();
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-center sm:text-left flex justify-center sm:block">
                                        <ArrowRight className="text-gray-600 rotate-90 sm:rotate-0" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-500 mb-2">You earn:</div>
                                        <div className="font-mono font-bold text-brand-accent text-2xl sm:text-lg">
                                            <span id="calc-output">750,000</span> SG
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-3 text-center">*Estimated at max 25% reward tier</p>
                            </div>

                            <div className="flex items-center gap-3 bg-blue-900/20 p-3 rounded border border-blue-500/20">
                                <ShoppingBag className="text-blue-400 w-5 h-5 flex-shrink-0" />
                                <p className="text-sm text-blue-200">
                                    <strong>Purchase Rewards:</strong> Earn 10% to 25% back in SGCOIN on every dollar spent!
                                </p>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-gray-900 to-black p-8 rounded-2xl border border-gray-800">
                            <h2 className="font-display text-2xl font-bold uppercase mb-6 flex items-center gap-2">
                                <Gift className="text-purple-500" /> How to Redeem
                            </h2>
                            <ul className="space-y-4">
                                <li className="flex items-center gap-4 bg-white/5 p-3 rounded hover:bg-white/10 transition">
                                    <div className="bg-purple-500/20 p-2 rounded">
                                        <ShoppingBag className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Exclusive Packs</h4>
                                        <p className="text-xs text-gray-400">Redeem for merch packs & digital content.</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-4 bg-white/5 p-3 rounded hover:bg-white/10 transition">
                                    <div className="bg-yellow-500/20 p-2 rounded">
                                        <Clock className="w-5 h-5 text-yellow-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Early Access</h4>
                                        <p className="text-xs text-gray-400">Get first dibs on new product drops.</p>
                                    </div>
                                </li>
                                <li className="flex items-center gap-4 bg-white/5 p-3 rounded hover:bg-white/10 transition">
                                    <div className="bg-green-500/20 p-2 rounded">
                                        <ArrowRight className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-sm">Conversions (Coming Soon)</h4>
                                        <p className="text-xs text-gray-400">Convert points for exclusive community perks.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Setup Guide */}
                    <section className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                        <div className="p-8 border-b border-gray-800">
                            <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-3">
                                <Wallet className="text-brand-accent" /> Setting Up for SGCOIN Rewards
                            </h2>
                            <p className="text-gray-400 text-sm mt-2">
                                To receive SGCOIN rewards, make sure you have a MetaMask wallet.
                            </p>
                        </div>
                        <div className="p-8 grid md:grid-cols-3 gap-8">
                            <div className="relative">
                                <div className="absolute -left-4 -top-4 w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center font-bold text-gray-500 border border-gray-700">1</div>
                                <h3 className="font-bold text-white mb-2 mt-2">Download MetaMask</h3>
                                <p className="text-sm text-gray-400 mb-4">Visit MetaMask.io and download the wallet for your browser or phone.</p>
                                <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-accent uppercase tracking-wide hover:text-white">Download Now →</a>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-4 -top-4 w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center font-bold text-gray-500 border border-gray-700">2</div>
                                <h3 className="font-bold text-white mb-2 mt-2">Create Your Wallet</h3>
                                <p className="text-sm text-gray-400">Follow the prompts to set up your account. <span className="text-red-400">Important:</span> Keep your recovery phrase safe!</p>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-4 -top-4 w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center font-bold text-gray-500 border border-gray-700">3</div>
                                <h3 className="font-bold text-white mb-2 mt-2">Connect to Coalition</h3>
                                <p className="text-sm text-gray-400 mb-4">Share your wallet address with us or connect directly on this site.</p>
                                <Link to="/tutorial/welcome" className="text-xs font-bold text-brand-accent uppercase tracking-wide hover:text-white">View Setup Guide →</Link>
                            </div>
                        </div>
                    </section>

                    {/* Detailed Liquidity Section */}
                    <section className="bg-gradient-to-r from-gray-900 to-black rounded-2xl border border-gray-800 p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div>
                                <h2 className="font-display text-2xl font-bold uppercase flex items-center gap-3 mb-2">
                                    <BarChart3 className="text-orange-500" /> Active Liquidity Pools
                                </h2>
                                <p className="text-gray-400 text-sm max-w-xl">
                                    SGCOIN maintains active liquidity pairs on decentralized exchanges to ensure users can always exchange their rewards. Primary liquidity is provided on QuickSwap.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <a href="https://quickswap.exchange/#/swap?outputCurrency=0x951806a2581c22c478ac613a675e6c898e2abe21&chain=polygon" target="_blank" rel="noopener noreferrer" className="bg-orange-500 hover:bg-orange-600 text-black font-bold py-2 px-4 rounded text-xs uppercase transition">
                                    Trade on QuickSwap
                                </a>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
                            <div className="p-4 bg-black/40 rounded-lg border border-gray-800">
                                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Primary Pair</div>
                                <div className="text-sm font-mono font-bold text-white">SGCOIN / MATIC</div>
                            </div>
                            <div className="p-4 bg-black/40 rounded-lg border border-gray-800">
                                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">DEX Protocol</div>
                                <div className="text-sm font-bold text-white">QuickSwap V3 (Polygon)</div>
                            </div>
                            <div className="p-4 bg-black/40 rounded-lg border border-gray-800">
                                <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Contract Address</div>
                                <div className="text-[10px] font-mono font-bold text-brand-accent truncate">0x951806a2581c22c478ac613a675e6c898e2abe21</div>
                            </div>
                        </div>
                    </section>

                    {/* Live Transactions */}
                    <LiveTransactions />
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
            </div >
        </div >
    );
};

export default Ecosystem;
