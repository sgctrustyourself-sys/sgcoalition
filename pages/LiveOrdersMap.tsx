import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Clock, MapPin, Activity, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import LiveMap from '../components/LiveMap';
import StateLeaderboard from '../components/StateLeaderboard';
import DropCountdown from '../components/DropCountdown';
import { buildLiveOrdersFeed, type LiveOrdersTimeRange } from '../utils/liveOrdersFeed';

interface SummaryCardProps {
    label: string;
    value: string;
    helper: string;
    icon: React.ReactNode;
    accentClass: string;
}

const SummaryCard = ({ label, value, helper, icon, accentClass }: SummaryCardProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/60 p-5 backdrop-blur-sm shadow-2xl"
        >
            <div className={`absolute inset-0 bg-gradient-to-br ${accentClass} opacity-60 pointer-events-none`} />
            <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">{label}</p>
                    <p className="truncate font-display text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                        {value}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-gray-400">{helper}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/40 text-white/90">
                    {icon}
                </div>
            </div>
        </motion.div>
    );
};

const RANGE_LABELS: Record<LiveOrdersTimeRange, string> = {
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
    '30d': 'Last 30 days',
};

const LiveOrdersMap = () => {
    const navigate = useNavigate();
    const { orders } = useApp();
    const [timeRange, setTimeRange] = useState<LiveOrdersTimeRange>('7d');

    const feed = buildLiveOrdersFeed(orders, timeRange);

    const summaryCards = [
        {
            label: 'Orders',
            value: feed.summary.totalOrders.toLocaleString(),
            helper: `Live window: ${RANGE_LABELS[timeRange]}`,
            icon: <Activity className="w-5 h-5 text-purple-300" />,
            accentClass: 'from-purple-500/20 via-purple-500/5 to-transparent',
        },
        {
            label: 'Active States',
            value: feed.summary.activeStates.toString(),
            helper: feed.summary.topState
                ? `${feed.summary.topState.name} is leading right now`
                : 'Waiting for live order data',
            icon: <MapPin className="w-5 h-5 text-sky-300" />,
            accentClass: 'from-sky-500/20 via-sky-500/5 to-transparent',
        },
        {
            label: 'Latest Order',
            value: feed.summary.latestOrder?.timeLabel || 'N/A',
            helper: feed.summary.latestOrder
                ? `${feed.summary.latestOrder.productName} in ${feed.summary.latestOrder.stateName}`
                : 'No recent order activity yet',
            icon: <Clock className="w-5 h-5 text-emerald-300" />,
            accentClass: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
        },
        {
            label: 'Top State',
            value: feed.summary.topState?.name || 'N/A',
            helper: feed.summary.topState
                ? `${feed.summary.topState.count} orders in this window`
                : 'No tracked states yet',
            icon: <TrendingUp className="w-5 h-5 text-amber-300" />,
            accentClass: 'from-amber-500/20 via-amber-500/5 to-transparent',
        },
    ];

    return (
        <div className="min-h-screen bg-black px-4 py-12 text-white selection:bg-purple-500/30">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="mb-8 flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                    <div>
                        <button
                            onClick={() => navigate('/')}
                            className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 transition hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to Home
                        </button>
                        <h1 className="font-display mb-2 flex items-center gap-3 text-4xl font-black uppercase tracking-tighter md:text-5xl">
                            <Activity className="h-8 w-8 animate-pulse text-green-400" />
                            Recently Ordered
                        </h1>
                        <p className="max-w-xl text-sm leading-relaxed text-gray-400 md:text-base">
                            Real orders, real people - moving SG Coalition across the country.
                            <br />
                            <span className="mt-1 block text-xs font-bold uppercase tracking-wider text-gray-600">
                                * Locations shown at state level only. No personal data.
                            </span>
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="flex rounded-xl border border-gray-800 bg-gray-900 p-1">
                        {(['24h', '7d', '30d'] as const).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${
                                    timeRange === range
                                        ? 'bg-purple-600 text-white shadow-lg'
                                        : 'text-gray-500 hover:bg-gray-800 hover:text-white'
                                }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((card) => (
                        <SummaryCard
                            key={card.label}
                            label={card.label}
                            value={card.value}
                            helper={card.helper}
                            icon={card.icon}
                            accentClass={card.accentClass}
                        />
                    ))}
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                    {/* Map Section */}
                    <div className="min-h-[500px] lg:col-span-2">
                        <LiveMap data={feed.states} timeRange={timeRange} />
                    </div>

                    {/* Sidebar Section */}
                    <div className="flex flex-col gap-6 lg:col-span-1">
                        {/* Leaderboard */}
                        <div className="h-[380px]">
                            <StateLeaderboard data={feed.states} />
                        </div>

                        {/* Drop Countdown */}
                        <DropCountdown />

                        {/* Live Ticker */}
                        <div className="flex h-[380px] flex-col overflow-hidden rounded-3xl border border-gray-800 bg-gray-900/50 p-6 backdrop-blur-sm">
                            <h2 className="font-display mb-6 flex items-center gap-2 text-xl font-bold uppercase tracking-tight">
                                <Clock className="h-5 w-5 text-purple-400" />
                                Recent Activity
                            </h2>

                            <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto pr-2">
                                {feed.recentActivity.length > 0 ? (
                                    feed.recentActivity.map((item, index) => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="group flex items-center gap-4 rounded-xl border border-gray-800 bg-black p-3 transition hover:border-purple-500/30"
                                        >
                                            <div className="relative h-12 w-12 overflow-hidden rounded-lg border border-gray-800 transition group-hover:border-purple-500/50">
                                                <img
                                                    src={item.image}
                                                    alt="Product"
                                                    className="h-full w-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium leading-snug text-gray-200">
                                                    {item.text}
                                                </p>
                                                <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500">
                                                    {item.time}
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-gray-800 bg-black/40 p-6 text-center">
                                        <p className="text-sm font-medium text-gray-300">No live orders in this window yet.</p>
                                        <p className="mt-2 text-xs uppercase tracking-widest text-gray-600">
                                            Orders will appear here once they are placed.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 border-t border-gray-800 pt-6 text-center">
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
