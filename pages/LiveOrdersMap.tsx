import React, { useState } from 'react';
import { motion } from 'framer-motion';
import LiveMap from '../components/LiveMap';
import StateLeaderboard from '../components/StateLeaderboard';
import DropCountdown from '../components/DropCountdown';
import { mockLiveOrders, mockRecentTicker } from '../data/mockLiveOrders';
import { ArrowLeft, Clock, MapPin, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LiveOrdersMap = () => {
    const navigate = useNavigate();
    const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');

    return (
        <div className="min-h-screen bg-black text-white py-12 px-4 selection:bg-purple-500/30">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                    <div>
                        <button
                            onClick={() => navigate('/')}
                            className="flex items-center gap-2 text-gray-500 hover:text-white mb-4 transition text-xs font-bold uppercase tracking-widest"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Home
                        </button>
                        <h1 className="font-display text-4xl md:text-5xl font-black uppercase tracking-tighter mb-2 flex items-center gap-3">
                            <Activity className="w-8 h-8 text-green-400 animate-pulse" />
                            Recently Ordered
                        </h1>
                        <p className="text-gray-400 text-sm md:text-base max-w-xl leading-relaxed">
                            Real orders, real people — moving SG Coalition across the country.
                            <br />
                            <span className="text-xs text-gray-600 uppercase tracking-wider font-bold mt-1 block">
                                * Locations shown at state level only. No personal data.
                            </span>
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1">
                        {(['24h', '7d', '30d'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${timeRange === range
                                    ? 'bg-purple-600 text-white shadow-lg'
                                    : 'text-gray-500 hover:text-white hover:bg-gray-800'
                                    }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Map Section */}
                    <div className="lg:col-span-2 min-h-[500px]">
                        <LiveMap data={mockLiveOrders} timeRange={timeRange} />
                    </div>

                    {/* Sidebar Section */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        {/* Leaderboard */}
                        <div className="h-[380px]">
                            <StateLeaderboard data={mockLiveOrders} />
                        </div>

                        {/* Drop Countdown */}
                        <DropCountdown />

                        {/* Live Ticker */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 backdrop-blur-sm h-[380px] overflow-hidden flex flex-col">
                            <h2 className="font-display text-xl font-bold uppercase tracking-tight mb-6 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-purple-400" />
                                Recent Activity
                            </h2>

                            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                {mockRecentTicker.map((item, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="bg-black border border-gray-800 p-3 rounded-xl flex items-center gap-4 hover:border-purple-500/30 transition group"
                                    >
                                        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-800 group-hover:border-purple-500/50 transition">
                                            <img
                                                src={item.image}
                                                alt="Product"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-200 leading-snug">
                                                {item.text}
                                            </p>
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1 block">
                                                {item.time}
                                            </span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-800 text-center">
                                <p className="text-xs text-gray-600">
                                    Join the movement. Place an order to light up your state.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveOrdersMap;
