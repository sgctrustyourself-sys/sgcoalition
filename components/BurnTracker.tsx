import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, ArrowUpRight, TrendingUp, ShoppingBag, Zap, Ticket } from 'lucide-react';

interface BurnTrackerProps {
    initialBurn?: string;
}

const BurnTracker: React.FC<BurnTrackerProps> = ({ initialBurn = "1,777,161" }) => {
    const [burnAmount, setBurnAmount] = useState<string | number>(initialBurn);

    useEffect(() => {
        if (initialBurn && initialBurn !== "0" && initialBurn !== "0.0") {
            setBurnAmount(initialBurn);
        }
    }, [initialBurn]);

    const sources = [
        { id: 'migration', label: 'Migration Swaps', icon: ShoppingBag, color: 'text-pink-500', bg: 'bg-pink-500', percent: 85 },
        { id: 'dead', label: 'Protocol Burns', icon: Zap, color: 'text-purple-500', bg: 'bg-purple-500', percent: 12 },
        { id: 'treasury', label: 'Treasury Recycling', icon: Ticket, color: 'text-orange-500', bg: 'bg-orange-500', percent: 3 },
    ];

    return (
        <div className="relative overflow-hidden rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-900/10 via-black to-black p-8">
            {/* Ambient Background Effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 animate-pulse" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-600/5 blur-[80px] rounded-full -translate-x-1/2 translate-y-1/2" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">

                {/* Left: Total Burned Counter */}
                <div className="text-center md:text-left">
                    <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                        <div className="p-2 rounded-full bg-orange-500/10 border border-orange-500/20">
                            <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                        </div>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-orange-200/70">Total SGCOIN Burned</h3>
                    </div>

                    <motion.div
                        key={burnAmount}
                        initial={{ scale: 0.95, color: '#fb923c' }} // orange-400
                        animate={{ scale: 1, color: '#ffffff' }}
                        transition={{ duration: 0.2 }}
                        className="text-5xl md:text-6xl font-display font-bold tabular-nums tracking-tight text-white drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]"
                    >
                        {(() => {
                            if (typeof burnAmount === 'number') return burnAmount.toLocaleString();
                            // If it's a string, try to parse and format if it's a number string
                            const num = parseFloat(burnAmount.replace(/,/g, ''));
                            return isNaN(num) ? burnAmount : num.toLocaleString();
                        })()}
                    </motion.div>

                    <div className="mt-4 flex items-center gap-2 justify-center md:justify-start text-xs text-orange-300/60 font-mono">
                        <TrendingUp className="w-3 h-3" />
                        <span>Burn Velocity: ~450 SGC / Hour</span>
                    </div>
                </div>

                {/* Right: Sources Breakdown */}
                <div className="flex-1 w-full max-w-md space-y-5">
                    {sources.map((source, index) => (
                        <div key={source.id} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
                                <span className={`flex items-center gap-2 ${source.color}`}>
                                    <source.icon className="w-3.5 h-3.5" />
                                    {source.label}
                                </span>
                                <span className="text-gray-500">{source.percent}%</span>
                            </div>
                            <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${source.percent}%` }}
                                    transition={{ duration: 1, delay: index * 0.2, ease: "easeOut" }}
                                    className={`h-full ${source.bg} shadow-[0_0_10px_currentColor]`}
                                />
                            </div>
                        </div>
                    ))}

                    <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                        <p className="text-[10px] text-gray-500 max-w-[200px] leading-tight">
                            Every transaction permanently removes SGCOIN from circulation, increasing scarcity.
                        </p>
                        <a href="#" className="flex items-center gap-1 text-[10px] uppercase font-bold text-orange-400 hover:text-orange-300 transition-colors">
                            View Contract <ArrowUpRight className="w-3 h-3" />
                        </a>
                    </div>
                </div>

            </div>

            {/* Ember Particles (Visual Decoration) */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[...Array(5)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-orange-400 rounded-full blur-[1px]"
                        initial={{
                            x: Math.random() * 100 + "%",
                            y: "120%",
                            opacity: 0
                        }}
                        animate={{
                            y: "-20%",
                            opacity: [0, 1, 0],
                            x: `calc(${Math.random() * 100}% + ${Math.random() * 50 - 25}px)`
                        }}
                        transition={{
                            duration: Math.random() * 5 + 5,
                            repeat: Infinity,
                            delay: Math.random() * 5,
                            ease: "linear"
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default BurnTracker;
