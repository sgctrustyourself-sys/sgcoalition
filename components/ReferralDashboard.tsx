import React, { useState, useEffect } from 'react';
import { Copy, Check, TrendingUp, Users, DollarSign, Award, ExternalLink, Eye, MousePointerClick } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import {
    getReferralStats,
    getReferralHistory,
    generateReferralLink,
    calculateCommissionTier,
    COMMISSION_TIERS,
    type ReferralStats,
    type Referral
} from '../utils/referralSystem';
import { getReferrerAnalytics } from '../utils/referralAnalytics';

const ReferralDashboard = () => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [history, setHistory] = useState<Referral[]>([]);
    const [analytics, setAnalytics] = useState({ clicks: 0, views: 0, signups: 0, purchases: 0, conversionRate: 0 });
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (user) {
            loadReferralData();
        }
    }, [user]);

    const loadReferralData = async () => {
        if (!user) return;

        setLoading(true);
        const [statsData, historyData, analyticsData] = await Promise.all([
            getReferralStats(user.uid),
            getReferralHistory(user.uid),
            getReferrerAnalytics(user.uid)
        ]);

        setStats(statsData);
        setHistory(historyData);
        setAnalytics(analyticsData);
        setLoading(false);
    };

    const copyReferralLink = () => {
        if (!stats) return;

        const link = generateReferralLink(stats.referral_code);
        navigator.clipboard.writeText(link);
        setCopied(true);
        addToast('Referral link copied!', 'success');

        setTimeout(() => setCopied(false), 2000);
    };

    if (!user) {
        return (
            <div className="bg-gray-900 rounded-xl p-8 text-center">
                <Award className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Sign in to access referrals</h3>
                <p className="text-gray-400">Create an account to start earning commissions!</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-gray-900 rounded-xl p-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-800 rounded w-1/3"></div>
                    <div className="h-32 bg-gray-800 rounded"></div>
                    <div className="h-24 bg-gray-800 rounded"></div>
                </div>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="bg-gray-900 rounded-xl p-8 text-center">
                <p className="text-gray-400">Unable to load referral data</p>
            </div>
        );
    }

    const tierInfo = calculateCommissionTier(stats.successful_referrals);
    const referralLink = generateReferralLink(stats.referral_code);

    return (
        <div className="space-y-6">
            {/* Header with Tier Info */}
            <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-xl p-6 border border-purple-500/20">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-display font-bold uppercase text-white mb-1">
                            Referral Program
                        </h2>
                        <p className="text-purple-200 text-sm">Earn up to 40% commission on every sale!</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 text-center">
                        <div className="text-xs text-purple-200 uppercase">Current Tier</div>
                        <div className="text-3xl font-bold text-white">{tierInfo.tier}</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-3">
                    <TrendingUp className="text-green-400" size={24} />
                    <div className="flex-1">
                        <div className="text-sm text-purple-200">Your Commission Rate</div>
                        <div className="text-2xl font-bold text-white">{tierInfo.rate}%</div>
                    </div>
                    {tierInfo.nextTier && (
                        <div className="text-right">
                            <div className="text-xs text-purple-200">Next: {tierInfo.nextTier.rate}%</div>
                            <div className="text-sm font-bold text-white">
                                {tierInfo.referralsToNextTier} more {tierInfo.referralsToNextTier === 1 ? 'sale' : 'sales'}
                            </div>
                        </div>
                    )}
                </div>

                {tierInfo.nextTier && (
                    <div className="mt-4">
                        <div className="flex justify-between text-xs text-purple-200 mb-1">
                            <span>Tier {tierInfo.tier}</span>
                            <span>Tier {tierInfo.nextTier.tier}</span>
                        </div>
                        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500"
                                style={{ width: `${Math.min(tierInfo.progress, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            {/* Earnings Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="text-blue-400" size={20} />
                        <span className="text-gray-400 text-sm">Total Referrals</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.total_referrals}</div>
                    <div className="text-xs text-gray-500 mt-1">{stats.successful_referrals} successful</div>
                </div>

                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                    <div className="flex items-center gap-3 mb-2">
                        <DollarSign className="text-green-400" size={20} />
                        <span className="text-gray-400 text-sm">Total Earnings</span>
                    </div>
                    <div className="text-3xl font-bold text-white">${stats.total_earnings.toFixed(2)}</div>
                    <div className="text-xs text-gray-500 mt-1">${stats.pending_earnings.toFixed(2)} pending</div>
                </div>

                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                    <div className="flex items-center gap-3 mb-2">
                        <Award className="text-purple-400" size={20} />
                        <span className="text-gray-400 text-sm">Paid Out</span>
                    </div>
                    <div className="text-3xl font-bold text-white">${stats.paid_earnings.toFixed(2)}</div>
                    <div className="text-xs text-gray-500 mt-1">Lifetime earnings</div>
                </div>
            </div>

            {/* Analytics Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                    <div className="flex items-center gap-3 mb-2">
                        <MousePointerClick className="text-orange-400" size={20} />
                        <span className="text-gray-400 text-sm">Total Clicks</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{analytics.clicks}</div>
                    <div className="text-xs text-gray-500 mt-1">Link visits</div>
                </div>

                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                    <div className="flex items-center gap-3 mb-2">
                        <Eye className="text-cyan-400" size={20} />
                        <span className="text-gray-400 text-sm">Page Views</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{analytics.views}</div>
                    <div className="text-xs text-gray-500 mt-1">From referrals</div>
                </div>

                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                    <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="text-green-400" size={20} />
                        <span className="text-gray-400 text-sm">Conversion Rate</span>
                    </div>
                    <div className="text-3xl font-bold text-white">{analytics.conversionRate.toFixed(1)}%</div>
                    <div className="text-xs text-gray-500 mt-1">Clicks to sales</div>
                </div>
            </div>

            {/* Coupon Code - NEW */}
            <div className="bg-gradient-to-br from-green-900 to-emerald-900 rounded-xl p-6 border border-green-500/20">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Award size={18} className="text-green-400" />
                        Your Referral Code
                    </h3>
                    <div className="bg-green-500/20 px-3 py-1 rounded-full">
                        <span className="text-xs font-bold text-green-300">EASY TO SHARE!</span>
                    </div>
                </div>

                <div className="bg-black/30 rounded-lg p-6 mb-4 text-center">
                    <div className="text-4xl font-bold font-mono text-white tracking-wider mb-2">
                        {stats.referral_code}
                    </div>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(stats.referral_code);
                            addToast('Referral code copied!', 'success');
                        }}
                        className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-bold transition flex items-center gap-2 mx-auto mt-3"
                    >
                        <Copy size={16} />
                        Copy Code
                    </button>
                </div>

                <div className="space-y-2 text-sm text-green-100">
                    <p className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        Share this code with friends on social media, texts, or emails
                    </p>
                    <p className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        They enter it at checkout - no special link needed!
                    </p>
                    <p className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        You earn {tierInfo.rate}% commission on every purchase
                    </p>
                </div>
            </div>

            {/* Referral Link */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <ExternalLink size={18} />
                    Your Referral Link
                </h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={referralLink}
                        readOnly
                        aria-label="Referral link"
                        className="flex-1 bg-black/50 border border-gray-700 rounded px-4 py-3 text-white font-mono text-sm"
                    />
                    <button
                        onClick={copyReferralLink}
                        className="bg-brand-accent hover:bg-brand-accent/80 text-white px-6 py-3 rounded font-bold transition flex items-center gap-2"
                    >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Prefer a link? Share this URL with friends. When they make a purchase, you earn {tierInfo.rate}% commission!
                </p>
            </div>

            {/* Commission Tiers Table */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="font-bold text-white mb-4">Commission Tiers</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-800">
                                <th className="text-left py-2 text-gray-400 font-normal">Tier</th>
                                <th className="text-left py-2 text-gray-400 font-normal">Successful Referrals</th>
                                <th className="text-left py-2 text-gray-400 font-normal">Commission Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {COMMISSION_TIERS.map((tier) => (
                                <tr
                                    key={tier.tier}
                                    className={`border-b border-gray-800/50 ${tier.tier === stats.current_tier ? 'bg-purple-500/10' : ''}`}
                                >
                                    <td className="py-3">
                                        <span className={`font-bold ${tier.tier === stats.current_tier ? 'text-purple-400' : 'text-white'}`}>
                                            Tier {tier.tier}
                                            {tier.tier === stats.current_tier && ' (Current)'}
                                        </span>
                                    </td>
                                    <td className="py-3 text-gray-300">
                                        {tier.minReferrals === tier.maxReferrals
                                            ? tier.minReferrals
                                            : tier.maxReferrals === Infinity
                                                ? `${tier.minReferrals}+`
                                                : `${tier.minReferrals}-${tier.maxReferrals}`
                                        }
                                    </td>
                                    <td className="py-3">
                                        <span className="font-bold text-green-400">{tier.rate}%</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Recent Referrals */}
            {history.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                    <h3 className="font-bold text-white mb-4">Recent Referrals</h3>
                    <div className="space-y-3">
                        {history.slice(0, 5).map((referral) => (
                            <div
                                key={referral.id}
                                className="flex items-center justify-between p-3 bg-black/30 rounded-lg"
                            >
                                <div>
                                    <div className="text-sm text-white font-medium">
                                        {referral.status === 'completed' ? 'Sale Completed' :
                                            referral.status === 'paid' ? 'Commission Paid' :
                                                'Pending'}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {new Date(referral.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                {referral.commission_earned && (
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-green-400">
                                            +${referral.commission_earned.toFixed(2)}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {referral.commission_rate}% of ${referral.order_total?.toFixed(2)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReferralDashboard;
