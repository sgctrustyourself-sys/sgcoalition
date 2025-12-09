import React from 'react';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3 } from 'lucide-react';
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
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-brand-black flex items-center justify-center text-white font-bold text-xs">
                                SG
                            </div>
                            <span className="font-bold text-gray-500 uppercase tracking-wider text-sm">SGCoin Price</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                            </span>
                            <span className="text-xs font-bold text-green-600 ml-1 uppercase tracking-wider">Live</span>
                        </div>
                    </div>

                    <div className="flex items-baseline gap-4 mb-6">
                        <h2 className="text-5xl md:text-6xl font-display font-bold text-brand-black tracking-tight">
                            $<AnimatedCounter end={data.price ?? 0} decimals={6} duration={2000} />
                        </h2>
                        <div className={`flex items-center px-3 py-1 rounded-full text-sm font-bold ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {isPositive ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                            {Math.abs(data.priceChange24h ?? 0).toFixed(2)}%
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-gray-100">
                        <div>
                            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Market Cap</p>
                            <p className="font-bold text-gray-900 flex items-center">
                                <DollarSign size={14} className="text-gray-400" />
                                <AnimatedCounter end={(data.marketCap ?? 0) / 1000} decimals={1} suffix="K" duration={2000} />
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase font-bold mb-1">24h Volume</p>
                            <p className="font-bold text-gray-900 flex items-center">
                                <BarChart3 size={14} className="text-gray-400 mr-1" />
                                $<AnimatedCounter end={data.volume24h ?? 0} duration={2000} />
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Liquidity</p>
                            <p className="font-bold text-gray-900">
                                $<AnimatedCounter end={data.liquidity ?? 0} duration={2000} />
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 uppercase font-bold mb-1">Network</p>
                            <p className="font-bold text-purple-600">Polygon</p>
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
