import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, Crown, TrendingUp } from 'lucide-react';

interface StateData {
    id: string;
    name: string;
    count: number;
}

interface StateLeaderboardProps {
    data: StateData[];
}

const StateLeaderboard: React.FC<StateLeaderboardProps> = ({ data }) => {
    // Sort by count descending
    const sortedData = [...data].sort((a, b) => b.count - a.count);
    const topStates = sortedData.slice(0, 10);

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Crown className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />;
            case 2:
                return <Medal className="w-5 h-5 text-gray-300 drop-shadow-[0_0_5px_rgba(209,213,219,0.5)]" />;
            case 3:
                return <Medal className="w-5 h-5 text-amber-600 drop-shadow-[0_0_5px_rgba(180,83,9,0.5)]" />;
            default:
                return <span className="font-mono font-bold text-gray-500">#{rank}</span>;
        }
    };

    const getRowStyle = (rank: number) => {
        switch (rank) {
            case 1:
                return 'border-yellow-500/30 bg-yellow-500/10 shadow-[inset_0_0_20px_rgba(234,179,8,0.05)]';
            case 2:
                return 'border-gray-500/30 bg-gray-500/10';
            case 3:
                return 'border-orange-500/20 bg-orange-500/5';
            default:
                return 'border-gray-800/50 bg-black/40 hover:bg-gray-900';
        }
    };

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 backdrop-blur-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h2 className="font-display text-xl font-bold uppercase tracking-tight flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-purple-400" />
                    Top States
                </h2>
                <div className="text-[10px] font-bold uppercase tracking-widest text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
                    Monthly Reset
                </div>
            </div>

            {/* Perks / Stakes */}
            <div className="mb-6 rounded-xl border border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-blue-900/20 p-4">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Current Stakes (Feb)</h3>
                <div className="flex items-center gap-4 text-sm font-medium text-gray-200">
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                        <span>Early Access</span>
                    </div>
                    <div className="h-1 w-1 rounded-full bg-gray-700"></div>
                    <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                        <span>500 SGCOIN Bonus</span>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-2">
                {topStates.map((state, index) => {
                    const rank = index + 1;
                    return (
                        <motion.div
                            key={state.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-3 rounded-xl border flex items-center justify-between transition group ${getRowStyle(rank)}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 flex justify-center">{getRankIcon(rank)}</div>
                                <div>
                                    <span className="font-bold text-gray-200">{state.name}</span>
                                    {rank === 1 && (
                                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-yellow-500">
                                            Leader
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-purple-200">{state.count}</span>
                                <TrendingUp className="w-3 h-3 text-green-500" />
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <div className="mt-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    * Orders update every 5 mins
                </p>
            </div>
        </div>
    );
};

export default StateLeaderboard;
