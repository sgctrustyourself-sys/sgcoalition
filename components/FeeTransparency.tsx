import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, ExternalLink, ArrowRight, Wallet, PieChart, Zap } from 'lucide-react';
import { getNativeBalance, getRobustProvider, formatAddress as formatEthAddress } from '../services/web3Service';
import { TREASURY_WALLET_ADDRESS } from '../constants';

const WALLETS = {
    treasury: TREASURY_WALLET_ADDRESS,
    dev: "0x123...789",      // Secondary/Internal Dev (TBD)
};

const FeeTransparency = () => {
    const [totalFees, setTotalFees] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const fetchFees = async () => {
        try {
            const provider = await getRobustProvider();
            const balance = await getNativeBalance(TREASURY_WALLET_ADDRESS, provider);
            setTotalFees(parseFloat(balance));
        } catch (error) {
            console.error("Error fetching treasury fees:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFees();
        const interval = setInterval(fetchFees, 300000); // Refresh every 5 mins
        return () => clearInterval(interval);
    }, []);

    const treasuryShare = totalFees * 0.7;
    const devShare = totalFees * 0.3;

    return (
        <div className="rounded-[2.5rem] border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden relative">
            {/* Background Gradient */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full translate-x-1/3 -translate-y-1/3" />

            <div className="p-10 relative z-10">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-6 mb-10">
                    <div className="flex-grow">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <Shield className="w-5 h-5 text-blue-400" />
                            </div>
                            <h2 className="font-display text-xl font-black uppercase tracking-widest text-white">Fee Architecture</h2>
                        </div>
                        <p className="text-gray-400 text-[11px] leading-relaxed max-w-md mt-4 font-medium italic">
                            A 2.5% marketplace fee is applied to all secondary sales. This revenue is strictly programmed for ecosystem sustainability.
                        </p>
                    </div>
                    <div className="text-left sm:text-right bg-blue-500/5 p-4 rounded-2xl border border-blue-500/10 min-w-fit">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Total MATIC Collected</p>
                        <p className="text-3xl font-black font-display text-white tracking-tighter">
                            {isLoading ? "..." : totalFees.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                            <span className="text-xs text-blue-400 ml-2 font-bold uppercase">MATIC</span>
                        </p>
                    </div>
                </div>

                {/* Split Visualizer */}
                <div className="mb-12">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-3">
                        <span className="text-purple-400">Mini Wizards Treasury (70%)</span>
                        <span className="text-blue-400">SG Coalition Dev (30%)</span>
                    </div>

                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden flex relative">
                        {/* Treasury Bar */}
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '70%' }}
                            transition={{ duration: 1.5, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-purple-600 to-purple-400 relative group"
                        >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.div>

                        {/* Split Marker */}
                        <div className="w-1 h-full bg-black z-10" />

                        {/* Dev Bar */}
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '30%' }}
                            transition={{ duration: 1.5, delay: 0.2, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 relative group"
                        >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.div>
                    </div>

                    <div className="flex justify-between mt-2 font-mono text-sm text-gray-500">
                        <span>{treasuryShare.toLocaleString(undefined, { maximumFractionDigits: 1 })} MATIC</span>
                        <span>{devShare.toLocaleString(undefined, { maximumFractionDigits: 1 })} MATIC</span>
                    </div>
                </div>

                {/* Details Grid - Stacked for Sidebar compatibility */}
                <div className="grid grid-cols-1 gap-6">
                    {/* Treasury Detail */}
                    <div className="p-6 rounded-2xl bg-purple-900/10 border border-purple-500/20 hover:border-purple-500/40 transition-colors group">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg text-purple-200">Community Treasury</h3>
                            <PieChart className="w-5 h-5 text-purple-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-xs text-gray-400">
                                <div className="w-1 h-1 bg-purple-500 rounded-full" /> Prize Pools & Giveaways
                            </li>
                            <li className="flex items-center gap-2 text-xs text-gray-400">
                                <div className="w-1 h-1 bg-purple-500 rounded-full" /> Floor Sweeps & Buybacks
                            </li>
                        </ul>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-purple-500/10">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Wallet className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                <span className="font-mono text-[10px] text-gray-400 truncate">{WALLETS.treasury}</span>
                            </div>
                            <a
                                href={`https://polygonscan.com/address/${WALLETS.treasury}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0"
                                title="View on PolygonScan"
                            >
                                <ExternalLink className="w-3 h-3 text-gray-600 hover:text-white cursor-pointer transition-colors" />
                            </a>
                        </div>
                    </div>

                    {/* Dev Detail */}
                    <div className="p-6 rounded-2xl bg-blue-900/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors group">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-lg text-blue-200">Development Fund</h3>
                            <Zap className="w-5 h-5 text-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <ul className="space-y-2 mb-6">
                            <li className="flex items-center gap-2 text-xs text-gray-400">
                                <div className="w-1 h-1 bg-blue-500 rounded-full" /> Platform Operations (Servers, RPC)
                            </li>
                            <li className="flex items-center gap-2 text-xs text-gray-400">
                                <div className="w-1 h-1 bg-blue-500 rounded-full" /> New Feature Development
                            </li>
                        </ul>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-blue-500/10">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-blue-500" />
                                <span className="font-mono text-xs text-gray-400">{WALLETS.dev}</span>
                            </div>
                            <ExternalLink className="w-3 h-3 text-gray-600 hover:text-white cursor-pointer transition-colors" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeeTransparency;
