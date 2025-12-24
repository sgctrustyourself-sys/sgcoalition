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
import { customizeReferralCode } from '../utils/customizeReferralCode';

const ReferralDashboard = () => {
    const { user } = useApp();
    const { addToast } = useToast();
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [history, setHistory] = useState<Referral[]>([]);
    const [analytics, setAnalytics] = useState({ clicks: 0, views: 0, signups: 0, purchases: 0, conversionRate: 0 });
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [isEditingCode, setIsEditingCode] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [editError, setEditError] = useState('');

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

    const handleEditCode = () => {
        if (!stats) return;
        setNewCode(stats.referral_code);
        setEditError('');
        setIsEditingCode(true);
    };

    const handleSaveCode = async () => {
        if (!user || !stats) return;

        setEditError('');

        const result = await customizeReferralCode(user.uid, newCode);

        if (result.success) {
            addToast('Referral code updated successfully!', 'success');
            setIsEditingCode(false);
            // Reload data to show new code
            await loadReferralData();
        } else {
            setEditError(result.error || 'Failed to update code');
        }
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
                                // @ts-ignore - Dynamic width required for progress animation
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

            {/* Coupon Code - Double-Sided Rewards */}
            <div className="bg-gradient-to-br from-green-900 to-emerald-900 rounded-xl p-6 border border-green-500/20">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Award size={18} className="text-green-400" />
                        Your Referral Code
                    </h3>
                    <div className="bg-green-500/20 px-3 py-1 rounded-full">
                        <span className="text-xs font-bold text-green-300">WIN-WIN!</span>
                    </div>
                </div>

                {/* Highlight Double-Sided Value */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-3">
                        <div className="text-2xl">🎁</div>
                        <div className="flex-1">
                            <h4 className="font-bold text-yellow-200 mb-1">Give Friends 15% Off Their First Order</h4>
                            <p className="text-sm text-yellow-100/80">
                                They save money, you earn {tierInfo.rate}% commission. Everyone wins!
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-black/30 rounded-lg p-6 mb-4 text-center">
                    <div className="text-4xl font-bold font-mono text-white tracking-wider mb-2">
                        {stats.referral_code}
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-3">
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(stats.referral_code);
                                addToast('Referral code copied!', 'success');
                            }}
                            className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-bold transition flex items-center gap-2"
                        >
                            <Copy size={16} />
                            Copy Code
                        </button>
                        {!stats.code_customized && (
                            <button
                                onClick={handleEditCode}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-bold transition flex items-center gap-2"
                            >
                                ✏️ Customize
                            </button>
                        )}
                    </div>
                    {stats.code_customized && (
                        <p className="text-xs text-green-400 mt-2">✓ Customized code (no more changes allowed)</p>
                    )}
                </div>

                {/* Edit Code Modal */}
                {isEditingCode && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold text-white mb-4">Customize Your Referral Code</h3>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
                                <p className="text-sm text-yellow-200">
                                    ⚠️ <strong>One-time change!</strong> Once you save, you cannot change it again.
                                </p>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm text-gray-400 mb-2">Your Code (4-12 characters)</label>
                                <input
                                    type="text"
                                    value={newCode}
                                    onChange={(e) => {
                                        setNewCode(e.target.value.toUpperCase());
                                        setEditError('');
                                    }}
                                    placeholder="YOURCODE123"
                                    maxLength={12}
                                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-lg focus:border-blue-500 focus:outline-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Letters, numbers, and hyphens only
                                </p>
                            </div>

                            {editError && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
                                    <p className="text-sm text-red-300">{editError}</p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsEditingCode(false);
                                        setEditError('');
                                    }}
                                    className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-bold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveCode}
                                    disabled={!newCode || newCode.length < 4}
                                    className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-bold transition"
                                >
                                    Save Code
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2 text-sm text-green-100">
                    <p className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        Share this code anywhere: texts, DMs, stories, posts
                    </p>
                    <p className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        Friends enter it at checkout - no special link needed
                    </p>
                    <p className="flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        They get 15% off, you earn {tierInfo.rate}% commission instantly
                    </p>
                </div>
            </div>

            {/* Referral Link + Social Sharing */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <ExternalLink size={18} />
                    Your Referral Link
                </h3>
                <div className="flex gap-2 mb-6">
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

                {/* Social Share Buttons */}
                <div className="bg-black/30 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-400 mb-3">Share on social media:</p>
                    <div className="flex gap-2 flex-wrap">
                        <a
                            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out Coalition Brand! Use my code ${stats.referral_code} for 15% off your first order 🔥`)}&url=${encodeURIComponent(referralLink)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded font-bold transition text-sm"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                            Twitter
                        </a>
                        <a
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] hover:bg-[#166fe5] text-white rounded font-bold transition text-sm"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                            Facebook
                        </a>
                        <a
                            href={`https://wa.me/?text=${encodeURIComponent(`Use my code ${stats.referral_code} for 15% off at Coalition Brand! ${referralLink}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#22c55e] text-white rounded font-bold transition text-sm"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            WhatsApp
                        </a>
                    </div>
                </div>

                <p className="text-xs text-gray-500">
                    Share this link with friends. When they make a purchase, you earn {tierInfo.rate}% commission AND they get 15% off! 🎁
                </p>
            </div>

            {/* Pre-Written Share Templates */}
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="font-bold text-white mb-4">📱 Copy & Share Templates</h3>
                <p className="text-sm text-gray-400 mb-4">Click to copy these ready-to-use messages:</p>
                <div className="space-y-2">
                    {[
                        `Just found Coalition Brand - use code ${stats.referral_code} for 15% off! 🔥`,
                        `Coalition has amazing streetwear. Get 15% off with my code: ${stats.referral_code}`,
                        `Support my style journey! Use ${stats.referral_code} at Coalition Brand for 15% off your first order`,
                        `🎁 Gift for you: ${stats.referral_code} = 15% off at coalitionbrand.xyz`
                    ].map((template, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                navigator.clipboard.writeText(template);
                                addToast('Message copied to clipboard!', 'success');
                            }}
                            className="w-full text-left p-3 bg-black/30 rounded-lg hover:bg-black/50 transition text-sm text-gray-300 border border-gray-800 hover:border-purple-500/30"
                        >
                            <div className="flex items-start gap-3">
                                <Copy size={16} className="mt-0.5 text-gray-400 flex-shrink-0" />
                                <span>"{template}"</span>
                            </div>
                        </button>
                    ))}
                </div>
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
