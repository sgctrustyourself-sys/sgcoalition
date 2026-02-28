import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign, Eye, MousePointerClick, ShoppingCart, Award } from 'lucide-react';
import { getTopReferrers, getDetailedReferrerStats } from '../utils/referralAnalytics';

interface TopReferrer {
    user_id: string;
    referral_code: string;
    total_clicks: number;
    total_views: number;
    successful_referrals: number;
    conversion_rate: number;
    total_earnings: number;
    current_tier: number;
}

const ReferralAnalytics: React.FC = () => {
    const [topReferrers, setTopReferrers] = useState<TopReferrer[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'all'>('30d');

    useEffect(() => {
        loadAnalytics();
    }, [timeframe]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const data = await getTopReferrers(20);
            setTopReferrers(data || []);
        } catch (error) {
            console.error('Error loading referral analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTierBadgeColor = (tier: number) => {
        if (tier >= 7) return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        if (tier >= 5) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        if (tier >= 3) return 'bg-green-500/20 text-green-400 border-green-500/30';
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    };

    const totalStats = topReferrers.reduce((acc, ref) => ({
        clicks: acc.clicks + ref.total_clicks,
        views: acc.views + ref.total_views,
        referrals: acc.referrals + ref.successful_referrals,
        earnings: acc.earnings + ref.total_earnings
    }), { clicks: 0, views: 0, referrals: 0, earnings: 0 });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Referral Analytics</h2>
                    <p className="text-gray-400 text-sm mt-1">Track top referrers and conversion metrics</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setTimeframe('7d')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${timeframe === '7d'
                                ? 'bg-white text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        7 Days
                    </button>
                    <button
                        onClick={() => setTimeframe('30d')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${timeframe === '30d'
                                ? 'bg-white text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        30 Days
                    </button>
                    <button
                        onClick={() => setTimeframe('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${timeframe === 'all'
                                ? 'bg-white text-black'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        All Time
                    </button>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Total Clicks</span>
                        <MousePointerClick className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">{totalStats.clicks.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Total Views</span>
                        <Eye className="w-5 h-5 text-purple-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">{totalStats.views.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Successful Referrals</span>
                        <ShoppingCart className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">{totalStats.referrals.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Total Earnings</span>
                        <DollarSign className="w-5 h-5 text-yellow-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">${totalStats.earnings.toFixed(2)}</p>
                </div>
            </div>

            {/* Top Referrers Table */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Top Referrers
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Rank
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Referral Code
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Tier
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Clicks
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Views
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Referrals
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Conversion
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                    Earnings
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {topReferrers.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                        No referral data available yet
                                    </td>
                                </tr>
                            ) : (
                                topReferrers.map((referrer, index) => (
                                    <tr key={referrer.user_id} className="hover:bg-white/5 transition">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {index < 3 ? (
                                                    <Award className={`w-5 h-5 ${index === 0 ? 'text-yellow-400' :
                                                            index === 1 ? 'text-gray-300' :
                                                                'text-orange-400'
                                                        }`} />
                                                ) : (
                                                    <span className="text-gray-400 text-sm w-5 text-center">
                                                        {index + 1}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <code className="text-sm font-mono text-white bg-white/10 px-2 py-1 rounded">
                                                {referrer.referral_code}
                                            </code>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTierBadgeColor(referrer.current_tier)}`}>
                                                Tier {referrer.current_tier}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                                            {referrer.total_clicks.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                                            {referrer.total_views.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-white">
                                            {referrer.successful_referrals.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <span className={`font-medium ${referrer.conversion_rate >= 10 ? 'text-green-400' :
                                                    referrer.conversion_rate >= 5 ? 'text-yellow-400' :
                                                        'text-gray-400'
                                                }`}>
                                                {referrer.conversion_rate.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-white">
                                            ${referrer.total_earnings.toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReferralAnalytics;
