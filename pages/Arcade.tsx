import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Gamepad2, Coins, Crown, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import BasketballGame from '../components/arcade/BasketballGame';

const Arcade = () => {
    const { user } = useApp();

    return (
        <div className="min-h-screen bg-black text-white pt-24 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="text-center mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center justify-center p-3 bg-brand-accent/10 rounded-full mb-4 border border-brand-accent/20"
                    >
                        <Gamepad2 className="w-6 h-6 text-brand-accent mr-2" />
                        <span className="text-brand-accent font-bold uppercase tracking-widest text-sm">Coalition Arcade</span>
                    </motion.div>
                    <h1 className="text-4xl md:text-6xl font-display font-bold uppercase mb-4">
                        Play to <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-accent to-purple-500">Earn</span>
                    </h1>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        Compete in mini-games, top the leaderboards, and earn SGCoin rewards.
                        The highest monthly scorer wins exclusive product drops!
                    </p>
                </div>

                {/* User Stats Bar */}
                {user && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white/5 border border-white/10 rounded-xl p-6 mb-12 flex flex-col md:flex-row items-center justify-between gap-6"
                    >
                        <div className="flex items-center">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-accent to-purple-600 flex items-center justify-center text-xl font-bold">
                                {user.displayName?.[0] || 'U'}
                            </div>
                            <div className="ml-4">
                                <h3 className="font-bold text-lg">{user.displayName || 'Player One'}</h3>
                                <p className="text-sm text-gray-400">Rank: #42</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="text-center">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Wallet Balance</p>
                                <p className="text-2xl font-bold font-mono flex items-center justify-center text-brand-accent">
                                    <Coins className="w-5 h-5 mr-2" />
                                    {user.sgCoinBalance || 0}
                                </p>
                            </div>
                            <div className="w-px h-12 bg-white/10 hidden md:block"></div>
                            <div className="text-center">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Monthly High Score</p>
                                <p className="text-2xl font-bold font-mono text-white">
                                    1,240
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Game Area */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                                <h2 className="font-bold uppercase flex items-center">
                                    <Zap className="w-5 h-5 text-yellow-500 mr-2" />
                                    SGCoin Hoops
                                </h2>
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-bold uppercase">Live</span>
                            </div>
                            <div className="p-4">
                                <BasketballGame />
                            </div>
                            <div className="p-4 bg-black/20 border-t border-white/10 text-sm text-gray-400 flex justify-between">
                                <span>Reward: 1 SGCoin per 5 points</span>
                                <span>Daily Cap: 50 SGCoin</span>
                            </div>
                        </div>

                        {/* Coming Soon Games */}
                        <div className="grid grid-cols-2 gap-4">
                            {['Pinball Wizard', 'Cyber Darts'].map((game, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center opacity-50 hover:opacity-75 transition cursor-not-allowed">
                                    <Gamepad2 className="w-8 h-8 text-gray-500 mb-3" />
                                    <h3 className="font-bold text-gray-300">{game}</h3>
                                    <span className="text-xs text-brand-accent mt-2 uppercase tracking-widest">Coming Soon</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar / Leaderboard */}
                    <div className="space-y-8">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                            <h3 className="font-bold uppercase mb-6 flex items-center">
                                <Crown className="w-5 h-5 text-yellow-500 mr-2" />
                                Monthly Leaders
                            </h3>

                            <div className="space-y-4">
                                {[
                                    { name: 'CryptoKing', score: 2450, reward: 'Exclusive Hoodie' },
                                    { name: 'SatoshiStyle', score: 2100, reward: '500 SGCoin' },
                                    { name: 'BlockBaller', score: 1850, reward: '250 SGCoin' },
                                    { name: 'ChainGamer', score: 1620, reward: '100 SGCoin' },
                                    { name: 'TokenMaster', score: 1400, reward: '50 SGCoin' },
                                ].map((player, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5 hover:border-white/10 transition">
                                        <div className="flex items-center">
                                            <span className={`w-6 h-6 flex items-center justify-center rounded font-bold text-xs mr-3 ${i === 0 ? 'bg-yellow-500 text-black' :
                                                    i === 1 ? 'bg-gray-400 text-black' :
                                                        i === 2 ? 'bg-orange-700 text-white' : 'bg-white/10 text-gray-400'
                                                }`}>
                                                {i + 1}
                                            </span>
                                            <div>
                                                <p className="font-bold text-sm">{player.name}</p>
                                                <p className="text-[10px] text-brand-accent">{player.reward}</p>
                                            </div>
                                        </div>
                                        <span className="font-mono font-bold text-gray-300">{player.score}</span>
                                    </div>
                                ))}
                            </div>

                            <button className="w-full mt-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold uppercase transition">
                                View Full Rankings
                            </button>
                        </div>

                        <div className="bg-gradient-to-br from-brand-accent/20 to-purple-900/20 border border-brand-accent/20 rounded-xl p-6 text-center">
                            <Trophy className="w-12 h-12 text-brand-accent mx-auto mb-4" />
                            <h3 className="font-bold text-white mb-2">This Month's Prize</h3>
                            <p className="text-sm text-gray-300 mb-4">
                                The top scorer for November wins a limited edition
                                <span className="text-white font-bold"> "Genesis Block" Hoodie</span> + NFT!
                            </p>
                            <div className="text-xs text-gray-500 uppercase tracking-widest">Ends in 3 Days</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Arcade;
