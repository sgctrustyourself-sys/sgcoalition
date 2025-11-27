import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Gift, Shield, Zap, Map, ArrowRight, Wallet, CheckCircle2 } from 'lucide-react';
import { fetchSGCoinData, fetchRecentTrades } from '../services/priceService';
import { SGCoinData } from '../types';
import { connectWallet, getSGCoinBalance, formatAddress } from '../services/web3Service';
import { ethers } from 'ethers';
import SGCoinCard from '../components/SGCoinCard';

const Ecosystem = () => {
    const [tokenData, setTokenData] = useState<SGCoinData | null>(null);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [userSGCoinBalance, setUserSGCoinBalance] = useState<number | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const CONTRACT_ADDRESS = '0x951806a2581c22C478aC613a675e6c898E2aBe21';

    const loadData = async () => {
        try {
            const data = await fetchSGCoinData();
            if (data) {
                setTokenData(data);
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error("Failed to load token data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const handleConnectWallet = async () => {
        setIsConnecting(true);
        try {
            const walletData = await connectWallet();
            if (walletData) {
                setWalletAddress(walletData.address);
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
        <div className="min-h-screen bg-gray-50 font-sans text-brand-black">
            {/* Hero Section */}
            <section className="bg-brand-black text-white py-20 px-4 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
                <div className="max-w-7xl mx-auto relative z-10 text-center">
                    <h1 className="font-display text-6xl md:text-8xl font-bold uppercase tracking-tighter mb-6">
                        The Ecosystem
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto font-light">
                        Fueling the future of decentralized fashion with <span className="text-brand-accent font-bold">SGCoin</span>.
                    </p>
                </div>
            </section>

            {/* SGCoin Live Data Section */}
            <section className="py-12 px-4 -mt-10 relative z-20">
                <div className="max-w-5xl mx-auto">
                    <SGCoinCard data={tokenData} isLoading={isLoading} />
                    <div className="text-center mt-4 text-xs text-gray-400 flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </div>
                </div>
            </section>

            {/* Main Content Grid */}
            <section className="py-16 px-4 max-w-7xl mx-auto grid md:grid-cols-2 gap-12">

                {/* Staking Section */}
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:border-brand-accent/50 transition-colors">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6 text-purple-600">
                        <Shield size={24} />
                    </div>
                    <h2 className="font-display text-3xl font-bold uppercase mb-4">Staking Rewards</h2>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        Lock your SGCoin to earn passive rewards. Stakers receive a share of transaction fees and exclusive access to limited drops.
                    </p>
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-sm uppercase text-gray-500">Current APY</span>
                            <span className="font-bold text-green-600 text-xl">12.5%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '65%' }}></div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 text-right">Total Value Locked: $45,230</p>
                    </div>
                    <button className="w-full py-3 bg-black text-white font-bold uppercase tracking-widest rounded hover:bg-gray-800 transition">
                        Start Staking
                    </button>
                </div>

                {/* Utilities Section */}
                <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:border-brand-accent/50 transition-colors">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6 text-blue-600">
                        <Zap size={24} />
                    </div>
                    <h2 className="font-display text-3xl font-bold uppercase mb-4">Coalition Utility</h2>
                    <p className="text-gray-600 mb-6 leading-relaxed">
                        SGCoin isn't just a token; it's your key to the Coalition universe. Use it for real-world benefits.
                    </p>
                    <ul className="space-y-4 mb-8">
                        <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-brand-accent flex-shrink-0 mt-0.5" />
                            <span className="text-sm font-medium">Purchase exclusive "Token-Only" merchandise</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-brand-accent flex-shrink-0 mt-0.5" />
                            <span className="text-sm font-medium">Get 15% discount on all store items when paying with SGCoin</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-brand-accent flex-shrink-0 mt-0.5" />
                            <span className="text-sm font-medium">Vote on future designs and brand direction</span>
                        </li>
                    </ul>
                    <Link to="/shop" className="block w-full py-3 border-2 border-black text-center font-bold uppercase tracking-widest rounded hover:bg-black hover:text-white transition">
                        Shop with SGCoin
                    </Link>
                </div>
            </section>

            {/* Rewards / Giveaway Section */}
            <section className="py-16 px-4 bg-brand-accent text-white">
                <div className="max-w-4xl mx-auto text-center">
                    <Gift size={48} className="mx-auto mb-6 opacity-90" />
                    <h2 className="font-display text-4xl font-bold uppercase mb-4">Weekly Rewards</h2>
                    <p className="text-xl text-white/80 mb-8">
                        Hold SGCoin to automatically enter our weekly giveaways.
                    </p>
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 inline-block w-full max-w-lg">
                        <p className="text-sm font-bold uppercase tracking-widest mb-2 text-white/60">Next Draw In</p>
                        <div className="text-4xl font-bold font-mono mb-6">04d : 12h : 45m</div>
                        <div className="flex items-center justify-center gap-2 text-sm">
                            <Wallet size={16} />
                            <span>Connect wallet to verify eligibility</span>
                        </div>
                        {!walletAddress && (
                            <button
                                onClick={handleConnectWallet}
                                disabled={isConnecting}
                                className="mt-6 px-8 py-3 bg-white text-brand-accent font-bold uppercase tracking-widest rounded hover:bg-gray-100 transition"
                            >
                                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                            </button>
                        )}
                        {walletAddress && (
                            <div className="mt-6 text-green-300 font-bold flex items-center justify-center gap-2">
                                <CheckCircle2 size={20} />
                                Wallet Connected: {formatAddress(walletAddress)}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Roadmap Section */}
            <section className="py-20 px-4 max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-6 text-gray-600 mx-auto">
                        <Map size={24} />
                    </div>
                    <h2 className="font-display text-4xl font-bold uppercase">The Roadmap</h2>
                </div>

                <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gray-200">
                    {[
                        { phase: 'Phase 1', title: 'Foundation', status: 'completed', items: ['Token Launch', 'Website V1', 'Community Building'] },
                        { phase: 'Phase 2', title: 'Integration', status: 'current', items: ['E-commerce Integration', 'Staking Dashboard', 'NFT Verification'] },
                        { phase: 'Phase 3', title: 'Expansion', status: 'upcoming', items: ['Mobile App', 'Global Events', 'DAO Governance'] }
                    ].map((item, idx) => (
                        <div key={idx} className={`relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group`}>
                            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${item.status === 'completed' ? 'bg-black' : item.status === 'current' ? 'bg-brand-accent' : 'bg-gray-300'}`}>
                                {item.status === 'completed' && <CheckCircle2 size={16} className="text-white" />}
                                {item.status === 'current' && <div className="w-3 h-3 bg-white rounded-full animate-pulse" />}
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${item.status === 'completed' ? 'bg-gray-100 text-gray-600' : item.status === 'current' ? 'bg-brand-accent/10 text-brand-accent' : 'bg-gray-50 text-gray-400'}`}>
                                        {item.phase}
                                    </span>
                                    {item.status === 'current' && <span className="text-xs font-bold text-brand-accent animate-pulse">In Progress</span>}
                                </div>
                                <h3 className="font-bold text-xl mb-3">{item.title}</h3>
                                <ul className="space-y-2">
                                    {item.items.map((subItem, i) => (
                                        <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                                            <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                            {subItem}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer CTA */}
            <section className="py-16 text-center">
                <a
                    href={`https://polygonscan.com/token/${CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-gray-400 hover:text-brand-black transition font-medium"
                >
                    View Contract on PolygonScan <ExternalLink size={16} className="ml-2" />
                </a>
            </section>
        </div>
    );
};

export default Ecosystem;
