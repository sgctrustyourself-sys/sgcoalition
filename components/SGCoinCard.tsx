import React from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Zap, Shield, Sparkles } from 'lucide-react';
import { SGCoinData } from '../types';
import AnimatedCounter from './AnimatedCounter';

interface SGCoinCardProps {
    data: SGCoinData | null;
    isLoading?: boolean;
}

const SGCoinCard: React.FC<SGCoinCardProps> = ({ data, isLoading = false }) => {
    if (isLoading || !data) {
        return (
            <div className="bg-white/5 backdrop-blur-3xl rounded-[2.5rem] p-12 border border-white/10 animate-pulse h-64 shadow-2xl">
                <div className="h-4 bg-white/10 rounded w-1/4 mb-8"></div>
                <div className="h-16 bg-white/10 rounded w-1/2 mb-12"></div>
                <div className="grid grid-cols-4 gap-8">
                    <div className="h-8 bg-white/10 rounded"></div>
                    <div className="h-8 bg-white/10 rounded"></div>
                    <div className="h-8 bg-white/10 rounded"></div>
                    <div className="h-8 bg-white/10 rounded"></div>
                </div>
            </div>
        );
    }

    const isPositive = (data.priceChange24h ?? 0) >= 0;

    return (
        <div className="relative overflow-hidden rounded-[3rem] border border-white/10 bg-black shadow-2xl group transition-all duration-700 hover:border-orange-500/30">
            {/* Ambient Glows */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2 group-hover:bg-orange-600/20 transition-all duration-1000" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10 p-10 md:p-14">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400">Project Dynamics</span>
                        </div>
                        <div className="flex items-baseline gap-6 font-display">
                            <h2 className="text-7xl md:text-9xl font-black uppercase tracking-tighter text-white leading-none">
                                $<AnimatedCounter end={data.price ?? 0} decimals={4} duration={1500} />
                            </h2>
                            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${isPositive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                {Math.abs(data.priceChange24h ?? 0).toFixed(2)}%
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl w-fit h-fit">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                        </span>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Oracle Live</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 pt-14 border-t border-white/5 leading-none">
                    <div className="group/item">
                        <div className="flex items-center gap-2 text-gray-500 mb-4 transition-colors group-hover/item:text-orange-500">
                            <DollarSign size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Market Cap</span>
                        </div>
                        <div className="text-3xl font-black text-white tracking-tight">
                            $<AnimatedCounter end={(data.marketCap ?? 0) / 1000} decimals={1} suffix="K" duration={1500} />
                        </div>
                    </div>
                    <div className="group/item">
                        <div className="flex items-center gap-2 text-gray-500 mb-4 transition-colors group-hover/item:text-orange-500">
                            <BarChart3 size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest">24h Vol</span>
                        </div>
                        <div className="text-3xl font-black text-white tracking-tight">
                            $<AnimatedCounter end={data.volume24h ?? 0} duration={1500} />
                        </div>
                    </div>
                    <div className="group/item">
                        <div className="flex items-center gap-2 text-gray-500 mb-4 transition-colors group-hover/item:text-orange-500">
                            <Zap size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Liquidity</span>
                        </div>
                        <div className="text-3xl font-black text-white tracking-tight">
                            $<AnimatedCounter end={data.liquidity ?? 0} duration={1500} />
                        </div>
                    </div>
                    <div className="group/item">
                        <div className="flex items-center gap-2 text-gray-500 mb-4 transition-colors group-hover/item:text-orange-500">
                            <Shield size={12} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Network</span>
                        </div>
                        <div className="text-3xl font-black text-purple-400 tracking-tight uppercase">Polygon</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SGCoinCard;
