import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Copy, TrendingUp, Users, Coins, Award, Gift, Check, Twitter, MessageCircle, Share2, ChevronRight, Wallet, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { fetchSGCoinData, fetchRecentTrades } from '../services/priceService';
import { SGCoinData, Trade } from '../types';
import { connectWallet, getSGCoinBalance, formatAddress } from '../services/web3Service';
import { ethers } from 'ethers';

const Ecosystem = () => {
    const [tokenData, setTokenData] = useState<SGCoinData | null>(null);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [copied, setCopied] = useState(false);
    const [completedTasks, setCompletedTasks] = useState<string[]>([]);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [userSGCoinBalance, setUserSGCoinBalance] = useState<number | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const CONTRACT_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';

    React.useEffect(() => {
        const loadData = async () => {
            const data = await fetchSGCoinData();
            if (data) {
                setTokenData(data);
                const recentTrades = await fetchRecentTrades(data.price);
                setTrades(recentTrades);
            }
        };
        loadData();
        // Refresh every 60 seconds
        const interval = setInterval(loadData, 60000);
        return () => clearInterval(interval);
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(CONTRACT_ADDRESS);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const giveawayTasks = [
        { id: 'twitter', title: 'Follow @CoalitionBrand on Twitter', icon: Twitter, url: 'https://twitter.com/intent/follow?screen_name=CoalitionBrand' },
        { id: 'discord', title: 'Join our Discord community', icon: MessageCircle, url: 'https://discord.gg/bByqsC5f5V' },
        { id: 'share', title: 'Share this page on Twitter', icon: Share2, url: 'https://twitter.com/intent/tweet?text=Check%20out%20SGCoin%20Ecosystem!' }
    ];

    const toggleTask = (taskId: string) => {
        setCompletedTasks(prev =>
            prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
        );
    };

    const allTasksCompleted = completedTasks.length === giveawayTasks.length;

    const handleConnectWallet = async () => {
        setIsConnecting(true);
        try {
            const walletData = await connectWallet();
            if (walletData) {
                setWalletAddress(walletData.address);

                // Fetch SGCoin balance
                if (window.ethereum) {
                    const provider = new ethers.BrowserProvider(window.ethereum);
                    const balance = await getSGCoinBalance(walletData.address, provider);
                    setUserSGCoinBalance(balance);
                }
            }
        } catch (error) {
            console.error('Error connecting wallet:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
            {/* Hero Section */}
            <section className="relative bg-gradient-to-r from-brand-black to-gray-900 text-white py-20 px-4 overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHptMC0xMGMwLTIuMjEtMS43OS00LTQtNHMtNCAxLjc5LTQgNCAxLjc5IDQgNCA0IDQtMS43OSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] bg-repeat"></div>
                </div>
                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="text-center mb-12">
                        <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-4">
                            SGCoin Ecosystem
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-300 font-light">
                            Powering Digital Fashion Since 2019
                        </p>
                    </div>

                    {/* Token Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-300 text-sm">Current Price</span>
                                <TrendingUp className="w-5 h-5 text-brand-accent" />
                            </div>
                            <p className="text-3xl font-bold">
                                {tokenData ? `$${tokenData.price.toFixed(8)}` : 'Loading...'}
                            </p>
                            {tokenData && (
                                <p className={`text-sm mt-1 ${tokenData.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {tokenData.priceChange24h ? (
                                        <>
                                            {tokenData.priceChange24h >= 0 ? '+' : ''}{tokenData.priceChange24h.toFixed(2)}% (24h)
                                        </>
                                    ) : (
                                        <span className="text-gray-400">No change (24h)</span>
                                    )}
                                </p>
                            )}
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-300 text-sm">Market Cap</span>
                                <Coins className="w-5 h-5 text-brand-accent" />
                            </div>
                            <p className="text-3xl font-bold">
                                {tokenData ? `$${(tokenData.marketCap / 1000).toFixed(1)}K` : 'Loading...'}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">Fully Diluted</p>
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-300 text-sm">Liquidity</span>
                                <Users className="w-5 h-5 text-brand-accent" />
                            </div>
                            <p className="text-3xl font-bold">
                                {tokenData ? `$${(tokenData.liquidity / 1000).toFixed(1)}K` : 'Loading...'}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">Total Liquidity</p>
                        </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-wrap justify-center gap-4">
                        <a href={`https://polygonscan.com/token/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="bg-white text-black px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-200 transition flex items-center">
                            View on PolygonScan <ExternalLink className="w-4 h-4 ml-2" />
                        </a>
                        <button className="border-2 border-white text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-white hover:text-black transition">
                            Add to Wallet
                        </button>
                    </div>

                    {/* Wallet Connection */}
                    <div className="mt-8 flex justify-center">
                        {!walletAddress ? (
                            <button
                                onClick={handleConnectWallet}
                                disabled={isConnecting}
                                className="bg-gradient-to-r from-brand-accent to-purple-600 text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:opacity-90 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                <Wallet className="w-5 h-5" />
                                {isConnecting ? 'Connecting...' : 'Connect Wallet to See Your Balance'}
                            </button>
                        ) : (
                            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 text-center">
                                <div className="flex items-center justify-center gap-2 mb-3">
                                    <Wallet className="w-5 h-5 text-brand-accent" />
                                    <span className="text-sm text-gray-300">Connected: {formatAddress(walletAddress)}</span>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-gray-300 mb-1">Your SGCoin Balance</p>
                                    <p className="text-4xl font-bold text-white">
                                        {userSGCoinBalance !== null ? userSGCoinBalance.toLocaleString() : 'Loading...'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">SGCOIN</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Token Information */}
            <section className="py-16 px-4 max-w-6xl mx-auto">
                <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
                    <h2 className="font-display text-3xl font-bold uppercase mb-6">Token Information</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Contract Address</label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-gray-100 px-4 py-3 rounded-sm text-sm font-mono break-all">
                                    {CONTRACT_ADDRESS}
                                </code>
                                <button onClick={copyToClipboard} className="p-3 hover:bg-gray-100 rounded-sm transition" title="Copy address">
                                    {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Network</label>
                            <p className="bg-gray-100 px-4 py-3 rounded-sm font-medium">Polygon (MATIC)</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Token Type</label>
                            <p className="bg-gray-100 px-4 py-3 rounded-sm font-medium">ERC-20</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-500 uppercase mb-2">Decimals</label>
                            <p className="bg-gray-100 px-4 py-3 rounded-sm font-medium">18</p>
                        </div>
                        <div className="md:col-span-2 bg-purple-50 p-4 rounded border border-purple-100">
                            <label className="block text-sm font-bold text-purple-800 uppercase mb-2">Tokenomics</label>
                            <div className="flex flex-wrap gap-4">
                                <span className="bg-white px-3 py-1 rounded border border-purple-200 text-sm font-medium text-purple-700">
                                    💎 Reflections (Earn by Holding)
                                </span>
                                <span className="bg-white px-3 py-1 rounded border border-purple-200 text-sm font-medium text-purple-700">
                                    💧 Automatic Liquidity
                                </span>
                                <span className="bg-white px-3 py-1 rounded border border-purple-200 text-sm font-medium text-purple-700">
                                    🔥 Deflationary
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Ecosystem Growth & Lifestyle */}
            <section className="py-16 px-4 bg-black text-white">
                <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="font-display text-4xl font-bold uppercase mb-6 leading-tight">
                            Building a <span className="text-brand-accent">Decentralized</span> Lifestyle
                        </h2>
                        <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                            We are building a world where we own everything we make and buy what we can afford.
                            It's a lot of different lifestyles here, united by freedom and ownership.
                        </p>
                        <div className="space-y-6">
                            <div className="flex items-start">
                                <div className="bg-brand-accent/20 p-3 rounded-lg mr-4">
                                    <RefreshCw className="w-6 h-6 text-brand-accent" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2">10% Reinvestment Protocol</h3>
                                    <p className="text-gray-400">
                                        Every purchase in our ecosystem automatically triggers a 10% reinvestment back into the SGCoin fund.
                                        This mechanism sustains liquidity and helps grow the token price organically with every sale.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start">
                                <div className="bg-purple-500/20 p-3 rounded-lg mr-4">
                                    <Award className="w-6 h-6 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl mb-2">NFT Integration</h3>
                                    <p className="text-gray-400">
                                        Our shirt NFTs are more than just digital collectibles—they are your entry pass into this decentralized land.
                                        Own your style, own your assets, and join a community that values true ownership.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-xl uppercase">Recent Ecosystem Activity</h3>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                Live Updates
                            </div>
                        </div>
                        <div className="overflow-hidden">
                            <div className="grid grid-cols-4 text-xs font-bold text-gray-500 uppercase mb-3 px-2">
                                <div>Type</div>
                                <div>Price</div>
                                <div>Amount</div>
                                <div className="text-right">Time</div>
                            </div>
                            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {trades.length > 0 ? trades.map((trade) => (
                                    <div key={trade.id} className="grid grid-cols-4 text-sm p-2 rounded hover:bg-white/5 transition border-b border-gray-800/50 last:border-0">
                                        <div className={`font-bold flex items-center ${trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                                            {trade.type === 'buy' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                                            {trade.type.toUpperCase()}
                                        </div>
                                        <div className="font-mono text-gray-300">${trade.price.toFixed(6)}</div>
                                        <div className="text-gray-400">{trade.amount.toLocaleString()}</div>
                                        <div className="text-right text-gray-500 text-xs">
                                            {Math.floor((Date.now() - trade.timestamp) / 60000)}m ago
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-8 text-gray-500">Loading trades...</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Community Story */}
            <section className="py-16 px-4 bg-gradient-to-r from-brand-accent/10 to-purple-100">
                <div className="max-w-4xl mx-auto text-center">
                    <Award className="w-16 h-16 mx-auto mb-6 text-brand-accent" />
                    <h2 className="font-display text-4xl font-bold uppercase mb-6">The Decentraland Drip Provider</h2>
                    <blockquote className="text-xl md:text-2xl text-gray-700 italic mb-8 leading-relaxed">
                        "I went around to everyone, new or old member. Come into my stream, you got my newest items. I love doing giveaways."
                    </blockquote>
                    <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
                        <h3 className="font-bold text-xl mb-4 flex items-center justify-center">
                            <Award className="w-6 h-6 mr-2 text-yellow-500" />
                            Community Achievement
                        </h3>
                        <p className="text-gray-700 mb-4">
                            Nearly won a <span className="font-bold text-brand-accent">$10,000+ grant</span> with overwhelming community support:
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                                <p className="text-4xl font-bold text-green-600">30+</p>
                                <p className="text-sm text-gray-600 mt-1">Community Votes</p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
                                <p className="text-4xl font-bold text-red-600">5</p>
                                <p className="text-sm text-gray-600 mt-1">Whale Votes (Won)</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 mt-4 italic">
                            The community support showed what truly matters - not the size of wallets, but the size of hearts.
                        </p>
                    </div>
                </div>
            </section>

            {/* NFT Journey Timeline */}
            <section className="py-16 px-4 max-w-6xl mx-auto">
                <h2 className="font-display text-4xl font-bold uppercase text-center mb-12">Our NFT Journey</h2>
                <div className="relative">
                    {/* Timeline Line */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-gradient-to-b from-brand-accent to-purple-500 hidden md:block"></div>

                    {/* Timeline Items */}
                    <div className="space-y-12">
                        {[
                            { year: '2019-2020', title: 'The Beginning', items: ['Early NFT experiments', 'Community building', 'Vision formation'] },
                            { year: '2021', title: 'Decentraland Era', items: ['Became "Decentraland Drip Provider"', 'Stream giveaways launched', 'Community growth'] },
                            { year: '2022', title: 'Grant Campaign', items: ['30+ community votes', '$10k+ grant nomination', 'Learned about whale voting power'] },
                            { year: '2023-2024', title: 'Coalition Evolution', items: ['SGCoin token launch', 'Physical clothing line', 'Ecosystem expansion'] }
                        ].map((period, idx) => (
                            <div key={idx} className={`flex items-center ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                                <div className={`flex-1 ${idx % 2 === 0 ? 'md:text-right md:pr-12' : 'md:pl-12'}`}>
                                    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-brand-accent/20 hover:border-brand-accent transition">
                                        <span className="text-brand-accent font-bold text-sm uppercase tracking-widest">{period.year}</span>
                                        <h3 className="font-display text-2xl font-bold mt-2 mb-4">{period.title}</h3>
                                        <ul className="space-y-2">
                                            {period.items.map((item, i) => (
                                                <li key={i} className="text-gray-600 flex items-start">
                                                    <ChevronRight className="w-4 h-4 mr-2 text-brand-accent flex-shrink-0 mt-1" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                <div className="hidden md:block w-8 h-8 bg-brand-accent rounded-full border-4 border-white shadow-lg z-10"></div>
                                <div className="flex-1"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Giveaway Widget */}
            <section className="py-16 px-4 bg-gradient-to-r from-purple-600 to-brand-accent text-white">
                <div className="max-w-2xl mx-auto">
                    <div className="text-center mb-8">
                        <Gift className="w-16 h-16 mx-auto mb-4" />
                        <h2 className="font-display text-4xl font-bold uppercase mb-2">Weekly Giveaway</h2>
                        <p className="text-xl text-purple-100">Continue the tradition of giving back</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 border border-white/20">
                        <div className="mb-6">
                            <h3 className="font-bold text-2xl mb-2">This Week's Prize</h3>
                            <p className="text-xl">Coalition Hoodie + 1,000 SGCoin</p>
                            <p className="text-sm text-purple-200 mt-2">Ends: December 1, 2024</p>
                        </div>

                        <div className="mb-6">
                            <h4 className="font-bold mb-4">Complete tasks to enter:</h4>
                            <div className="space-y-3">
                                {giveawayTasks.map(task => {
                                    const Icon = task.icon;
                                    const isCompleted = completedTasks.includes(task.id);
                                    return (
                                        <label key={task.id} className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition ${isCompleted ? 'bg-green-500/20 border-2 border-green-400' : 'bg-white/10 border-2 border-white/20 hover:bg-white/20'}`}>
                                            <input
                                                type="checkbox"
                                                checked={isCompleted}
                                                onChange={() => toggleTask(task.id)}
                                                className="w-5 h-5"
                                            />
                                            <Icon className="w-5 h-5" />
                                            <span className="flex-1">{task.title}</span>
                                            {task.url !== '#' && (
                                                <a href={task.url} target="_blank" rel="noopener noreferrer" className="text-sm underline hover:text-purple-200">
                                                    Go <ExternalLink className="w-3 h-3 inline ml-1" />
                                                </a>
                                            )}
                                        </label>
                                    );
                                })}</div>
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span>Progress</span>
                                <span>{completedTasks.length}/{giveawayTasks.length} tasks</span>
                            </div>
                            <div className="w-full bg-white/20 rounded-full h-3">
                                <div className="bg-white rounded-full h-3 transition-all" style={{ width: `${(completedTasks.length / giveawayTasks.length) * 100}%` }}></div>
                            </div>
                        </div>

                        <button
                            disabled={!allTasksCompleted}
                            className={`w-full py-4 rounded-sm font-bold uppercase tracking-widest transition ${allTasksCompleted ? 'bg-white text-purple-600 hover:bg-gray-100' : 'bg-white/20 text-white/50 cursor-not-allowed'}`}
                        >
                            {allTasksCompleted ? 'Enter Giveaway' : 'Complete All Tasks to Enter'}
                        </button>

                        <p className="text-center text-sm text-purple-200 mt-4">
                            Current entries: 47 • Winner announced weekly
                        </p>
                    </div>
                </div>
            </section>

            {/* OpenSea Collections */}
            <section className="py-16 px-4 max-w-6xl mx-auto">
                <h2 className="font-display text-4xl font-bold uppercase text-center mb-12">OpenSea Collections</h2>
                <div className="bg-gray-100 rounded-lg p-12 text-center border-2 border-dashed border-gray-300">
                    <p className="text-gray-500 text-lg mb-4">📦 OpenSea collections will appear here</p>
                    <p className="text-sm text-gray-400">Send your collection URLs to add them!</p>
                </div>
            </section>

            {/* Decentraland Wearables */}
            <section className="py-16 px-4 max-w-6xl mx-auto bg-gray-50">
                <h2 className="font-display text-4xl font-bold uppercase text-center mb-4">Decentraland Wearables</h2>
                <p className="text-center text-gray-600 mb-12">Virtual fashion for the metaverse</p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Trust Yourself (T-Shirt + Sword) */}
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-gray-200 hover:border-brand-accent transition group">
                        <div className="aspect-square bg-black relative overflow-hidden flex items-center justify-center">
                            <img
                                src="https://i.imgur.com/dUr24UZ.png"
                                alt="Trust Yourself T-Shirt with Sword"
                                className="w-full h-full object-contain"
                            />
                            <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                RARE
                            </div>
                        </div>
                        <div className="p-6">
                            <h3 className="font-bold text-lg mb-2">Trust Yourself (T-Shirt + Sword)</h3>
                            <p className="text-sm text-gray-600 mb-3">Wearable shirt with sword included - Black/Yellow colorways with Red Glow effect</p>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-bold">Upper Body</span>
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold">Collaboration: LingXing</span>
                            </div>
                            <a
                                href="https://decentraland.org/marketplace/contracts/0x2691f0feaa0137af3edb3acaf83ca5d6a3cfdf32/items/0"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full bg-brand-accent text-white text-center py-3 rounded-sm font-bold uppercase tracking-wide hover:bg-purple-700 transition"
                            >
                                View in Marketplace <ExternalLink className="w-4 h-4 inline ml-1" />
                            </a>
                        </div>
                    </div>

                    {/* Add More Products Card */}
                    <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg shadow-lg overflow-hidden border-2 border-dashed border-gray-400 flex items-center justify-center p-12">
                        <div className="text-center">
                            <p className="text-4xl mb-4">➕</p>
                            <p className="font-bold text-gray-700 mb-2">More Products Coming</p>
                            <p className="text-sm text-gray-500">Send more Decentraland links to add them!</p>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <a
                        href="https://decentraland.org/marketplace"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-brand-accent hover:text-brand-black font-bold"
                    >
                        Visit Decentraland Marketplace <ChevronRight className="w-4 h-4 ml-1" />
                    </a>
                </div>
            </section>

            {/* Back to Home */}
            <section className="py-12 px-4 text-center">
                <Link to="/" className="inline-flex items-center text-brand-accent hover:text-brand-black font-bold">
                    ← Back to Home
                </Link>
            </section>
        </div>
    );
};

export default Ecosystem;
