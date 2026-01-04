import React from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, ExternalLink } from 'lucide-react';
import { SGCoinData } from '../types';
import AnimatedCounter from './AnimatedCounter';

interface SGCoinCardProps {
    data: SGCoinData | null;
    isLoading?: boolean;
}

const SGCoinCard: React.FC<SGCoinCardProps> = ({ data, isLoading = false }) => {
    if (isLoading || !data) {
        return (
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-12 bg-gray-200 rounded w-1/2 mb-8"></div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="h-6 bg-gray-200 rounded"></div>
                    <div className="h-6 bg-gray-200 rounded"></div>
                </div>
            </div>
        );
    }

    try {
        const isPositive = (data.priceChange24h ?? 0) >= 0;

        return (
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 relative overflow-hidden group hover:shadow-2xl transition-all duration-300">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Activity size={120} />
                </div>

                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-brand-black flex items-center justify-center text-white font-bold text-sm shadow-lg">
                                SG
                            </div>
                            <div>
                                <span className="font-bold text-gray-900 block leading-tight">SGCoin / USDC</span>
                                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Polygon Network</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                                <span className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Live Metrics</span>
                            </div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
                                <Activity size={10} /> Powered by DexScreener
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-4 mb-8">
                        <h2 className="text-6xl md:text-7xl font-display font-bold text-brand-black tracking-tighter">
                            $<AnimatedCounter end={data.price ?? 0} decimals={6} duration={2000} />
                        </h2>
                        <div className={`flex items-center self-start sm:self-auto px-4 py-1.5 rounded-full text-sm font-black shadow-sm ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {isPositive ? <TrendingUp size={16} className="mr-1.5" /> : <TrendingDown size={16} className="mr-1.5" />}
                            {Math.abs(data.priceChange24h ?? 0).toFixed(2)}%
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-gray-100">
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-black mb-1.5 tracking-widest">Market Cap (FDV)</p>
                            <p className="text-xl font-bold text-gray-900 flex items-center">
                                <DollarSign size={16} className="text-gray-300" />
                                <AnimatedCounter end={(data.marketCap ?? 0) / 1000000} decimals={2} suffix="M" duration={2000} />
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 uppercase font-black mb-1.5 tracking-widest">24h Volume</p>
                            <p className="text-xl font-bold text-gray-900 flex items-center">
                                <BarChart3 size={16} className="text-gray-300 mr-1.5" />
                                $<AnimatedCounter end={data.volume24h ?? 0} decimals={0} duration={2000} />
                            </p>
                        </div>
                        <div className="hidden md:block">
                            <p className="text-[10px] text-gray-400 uppercase font-black mb-1.5 tracking-widest">Liquidity</p>
                            <p className="text-xl font-bold text-gray-900">
                                $<AnimatedCounter end={data.liquidity ?? 0} decimals={0} duration={2000} />
                            </p>
                        </div>
                        <div className="flex items-center justify-end col-span-2 md:col-span-1">
                            <a
                                href="https://zapper.xyz/token/polygon/0x951806a2581c22c478ac613a675e6c898e2abe21/SGCOIN/details"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full md:w-auto bg-gradient-to-r from-brand-black to-gray-800 text-white text-[11px] font-black py-4 px-6 rounded-xl uppercase tracking-[0.2em] shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 group/btn"
                            >
                                View on Zapper
                                <ExternalLink size={14} className="group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1 transition-transform" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    } catch (error) {
        console.error('Error rendering SGCoinCard:', error);
        return (
            <div className="bg-red-50 rounded-2xl shadow-xl p-8 border border-red-200">
                <p className="text-red-600 font-bold">Failed to load SGCoin data</p>
            </div>
        );
    }
};

export default SGCoinCard;
