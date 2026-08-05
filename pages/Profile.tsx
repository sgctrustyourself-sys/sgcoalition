import React, { useState, useEffect, Suspense } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Hexagon, Package, Truck, CheckCircle, Clock, Settings, Wallet, Link as LinkIcon, AlertCircle, CheckCircle2, Copy, Check, DollarSign, Star, Ticket, Heart, Vote, Users } from 'lucide-react';
import { getReferralStats, generateReferralLink, type ReferralStats } from '../utils/referralSystem';
import { trackReferralShare } from '../utils/referralAnalytics';
import { useApp } from '../context/AppContext';
import ProductCard from '../components/ProductCard';
import Skeleton from '../components/ui/Skeleton';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import OrderSkeleton from '../components/OrderSkeleton';
// Heavy tab bodies ship as separate chunks so the eager Profile bundle
// drops ~63 KB raw (ReferralDashboard 22 + AccountLinking 31 +
// PurchaseRequestsTab 10). They only download the first time their tab
// is opened, with a skeleton fallback during the fetch.
const ReferralDashboard = React.lazy(() => import('../components/ReferralDashboard'));
const AccountLinking = React.lazy(() => import('../components/AccountLinking'));
const PurchaseRequestsTab = React.lazy(() => import('../components/profile/PurchaseRequestsTab'));
// SGCoinPayoutTab ships as a separate chunk so the eager Profile bundle
// does not grow by ~14 KB raw. The tab itself renders <100 KB lazy + motion
// only when the user opens the SGCOIN payout section.
const SGCoinPayoutTab = React.lazy(() => import('../components/profile/SGCoinPayoutTab'));

interface Order {
    id: string;
    items: any[];
    total: number;
    status: string;
    shippingStatus: string;
    trackingNumber: string | null;
    createdAt: string;
    paymentMethod: string;
    userId?: string;
}

const Profile = () => {
    const { user, products, connectMetaMaskWallet, connectManualWallet, disconnectWallet, isLoading } = useApp();
    const [orders, setOrders] = useState<Order[]>([]);
    // Tabs include 'payout' (SGCOIN withdrawal dashboard + history, see
    // components/profile/SGCoinPayoutTab.tsx) alongside the existing
    // 'requests' tab (purchase requests).
    const [activeTab, setActiveTab] = useState<'favorites' | 'orders' | 'referrals' | 'settings' | 'vip' | 'requests' | 'payout'>('orders');
    const [manualAddress, setManualAddress] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showManualInput, setShowManualInput] = useState(false);
    const [profileReferralStats, setProfileReferralStats] = useState<ReferralStats | null>(null);
    const [profileReferralCopied, setProfileReferralCopied] = useState(false);

    useEffect(() => {
        // Load referral stats for quick-access card in header
        if (user) {
            getReferralStats(user.uid).then(stats => {
                if (stats) setProfileReferralStats(stats);
            });
        }
    }, [user]);

    useEffect(() => {
        // Load orders from localStorage
        const savedOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        // Filter orders for current user if logged in
        const userOrders = user?.uid
            ? savedOrders.filter((o: Order) => o.userId === user.uid)
            : savedOrders;
        setOrders(userOrders.reverse()); // Show newest first
    }, [user]);

    if (!user) return <Navigate to="/" />;

    const favorites = products.filter(p => user.favorites.includes(p.id));
    const isVipMember = Boolean(user.isVIP || user.subscriptionStatus === 'active');
    // Most recent in-transit order with a tracking number — used by the
    // "Track latest order" quick-action pill in the header card. Order
    // list is reverse-chronological (newest first), so Array#find picks
    // the freshest one naturally.
    const trackableOrder = orders.find(o => o.trackingNumber && o.shippingStatus !== 'delivered');

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'processing':
                return <Clock className="w-5 h-5 text-yellow-600" />;
            case 'shipped':
                return <Truck className="w-5 h-5 text-blue-600" />;
            case 'delivered':
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            default:
                return <Package className="w-5 h-5 text-gray-600" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'processing':
                return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'shipped':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'delivered':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'pending_verification':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Profile Header */}
            <div className="bg-black text-white rounded-2xl p-8 md:p-12 mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    {isLoading ? (
                        <div className="w-full flex flex-col md:flex-row justify-between gap-6">
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-64 bg-white/20" />
                                <Skeleton className="h-4 w-48 bg-white/20" />
                            </div>
                            <Skeleton className="h-32 w-64 rounded-xl bg-white/20" />
                        </div>
                    ) : (
                        <>
                            <div>
                                <h1 className="font-display text-3xl md:text-4xl font-bold uppercase mb-2">
                                    Welcome back, {user.displayName || 'Member'}
                                </h1>
                                <p className="text-gray-400 font-mono text-sm">
                                    {user.walletAddress ? user.walletAddress : user.email}
                                </p>
                            </div>
                            <div className="flex gap-4">
                                <div className={`backdrop-blur-md p-6 rounded-xl border min-w-[220px] relative overflow-hidden group ${isVipMember ? 'bg-gradient-to-br from-purple-900/50 to-blue-900/50 border-purple-500/30' : 'bg-white/10 border-white/10'}`}>
                                    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity ${isVipMember ? 'bg-purple-500/10' : 'bg-white/5'}`}></div>
                                    <div className={`text-xs uppercase tracking-widest mb-1 font-bold ${isVipMember ? 'text-purple-300' : 'text-gray-400'}`}>Membership</div>
                                    <div className="text-xl font-bold text-white flex items-center gap-2">
                                        <Star className={`w-5 h-5 fill-current ${isVipMember ? 'text-purple-400' : 'text-gray-400'}`} />
                                        {isVipMember ? 'Coalition VIP' : 'Unlock VIP'}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${isVipMember ? 'border-purple-400/30 bg-purple-500/10 text-purple-200' : 'border-white/10 bg-white/5 text-gray-300'}`}>
                                            <Ticket className="h-3 w-3" />
                                            15 giveaway tickets
                                        </span>
                                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${isVipMember ? 'border-green-500/20 bg-green-500/10 text-green-300' : 'border-white/10 bg-white/5 text-gray-300'}`}>
                                            {isVipMember ? 'Auto-entered' : 'Every giveaway'}
                                        </span>
                                    </div>
                                    <div className={`mt-3 text-xs flex items-center gap-1 ${isVipMember ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {isVipMember ? (
                                            <>Active <CheckCircle2 className="w-3 h-3 text-green-500" /></>
                                        ) : (
                                            <>VIP members are auto-entered with 15 tickets.</>
                                        )}
                                    </div>
                                    {!isVipMember && (
                                        <Link
                                            to="/membership"
                                            className="mt-4 inline-flex items-center justify-center rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200 transition hover:bg-purple-500/20"
                                        >
                                            Join VIP
                                        </Link>
                                    )}
                                </div>

                                {user.storeCredit && user.storeCredit > 0 && (
                                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/10 min-w-[200px]">
                                        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">Store Credit</div>
                                        <div className="text-4xl font-bold text-white flex items-center">
                                            <span className="text-2xl mr-1">$</span>
                                            {user.storeCredit.toFixed(2)}
                                        </div>
                                        <div className="text-xs text-green-400 mt-2">
                                            Available for checkout
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/10 min-w-[250px]">
                                    <div className="text-xs text-gray-400 uppercase tracking-widest mb-1">SGCoin Balance</div>
                                    <div className="text-4xl font-bold text-brand-accent flex items-center">
                                        <Hexagon className="w-8 h-8 mr-3 fill-current" />
                                        {user.sgCoinBalance.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2">
                                        Current Value: ${(user.sgCoinBalance * 0.002).toFixed(2)} USD
                                    </div>
                                </div>

                                {/* Quick-access referral code card */}
                                {profileReferralStats && (
                                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/10 min-w-[220px] cursor-pointer hover:bg-white/[0.15] transition" onClick={() => setActiveTab('referrals')}>
                                        <div className="text-xs text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-purple-400" />
                                            Referral Code
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <code className="text-xl font-bold text-white font-mono tracking-wider">
                                                {profileReferralStats.referral_code}
                                            </code>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigator.clipboard.writeText(
                                                        generateReferralLink(profileReferralStats.referral_code)
                                                    );
                                                    void trackReferralShare(profileReferralStats.referral_code, 'profile_header');
                                                    setProfileReferralCopied(true);
                                                    setSuccess('Referral link copied!');
                                                    setTimeout(() => {
                                                        setProfileReferralCopied(false);
                                                        setSuccess('');
                                                    }, 2000);
                                                }}
                                                className="p-2 rounded-lg hover:bg-white/10 transition text-gray-400 hover:text-white"
                                                title="Copy referral link"
                                            >
                                                {profileReferralCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <div className="text-xs text-purple-300 mt-1">Click to manage →</div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
            </div>

            {!isLoading && (
                <div className="relative z-10 mt-6 pt-6 border-t border-white/10 flex flex-wrap gap-3">
                    <Link
                        to="/blog/referendum-referral-program-2027"
                        className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-200 hover:text-amber-100 hover:bg-amber-500/20 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition"
                    >
                        <Vote className="w-4 h-4" />
                        Continue referrals in 2027?
                    </Link>
                    {trackableOrder && (
                        <a
                            href={`https://www.ups.com/track?tracknum=${encodeURIComponent(trackableOrder.trackingNumber!)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-200 hover:text-blue-100 hover:bg-blue-500/20 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition"
                        >
                            <Truck className="w-4 h-4" />
                            Track order #{trackableOrder.id?.slice(-6) || 'order'}
                        </a>
                    )}
                </div>
            )}
        </div>            {/* Tabs — labels hidden below `sm:` so six icons stay compact on mobile;
                counts stay visible at all sizes (smaller on mobile); `title` attribute
                provides the long-press tooltip. The SGCoin Requests tab gets a
                shorter "Requests" label under md since the full label crowds. */}
            <div className="flex gap-2 sm:gap-4 mb-8 border-b border-gray-200 overflow-x-auto pb-2 scrollbar-hide">
                <button
                    onClick={() => setActiveTab('orders')}
                    title={`Orders (${orders.length})`}
                    aria-label={`Orders, ${orders.length} total`}
                    className={`pb-4 px-2 font-bold uppercase tracking-wide transition border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'orders'
                        ? 'border-black text-black'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <Package className="w-5 h-5 flex-shrink-0" />
                    <span className="hidden sm:inline">Orders</span>
                    <span className="text-[10px] sm:text-base opacity-70 sm:opacity-100">({orders.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab('favorites')}
                    title={`Favorites (${favorites.length})`}
                    aria-label={`Favorites, ${favorites.length} total`}
                    className={`pb-4 px-2 font-bold uppercase tracking-wide transition border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'favorites'
                        ? 'border-black text-black'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <Heart className="w-5 h-5 flex-shrink-0" />
                    <span className="hidden sm:inline">Favorites</span>
                    <span className="text-[10px] sm:text-base opacity-70 sm:opacity-100">({favorites.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab('referrals')}
                    title="Referrals"
                    aria-label="Referrals"
                    className={`pb-4 px-2 font-bold uppercase tracking-wide transition border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'referrals'
                        ? 'border-black text-black'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <DollarSign className="w-5 h-5 flex-shrink-0" />
                    <span className="hidden sm:inline">Referrals</span>
                </button>
                <button
                    onClick={() => setActiveTab('vip')}
                    title="VIP Membership"
                    aria-label="VIP Membership"
                    className={`pb-4 px-2 font-bold uppercase tracking-wide transition border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'vip'
                        ? 'border-black text-black'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <Star className="w-5 h-5 flex-shrink-0 text-purple-500" />
                    <span className="hidden sm:inline">VIP Membership</span>
                </button>
                <button
                    onClick={() => setActiveTab('requests')}
                    title="SGCoin Requests"
                    aria-label="SGCoin Requests"
                    className={`pb-4 px-2 font-bold uppercase tracking-wide transition border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'requests'
                        ? 'border-black text-black'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <DollarSign className="w-5 h-5 flex-shrink-0" />
                    <span className="hidden md:inline">SGCoin Requests</span>
                    <span className="md:hidden">Requests</span>
                </button>
                <button
                    onClick={() => setActiveTab('payout')}
                    title="SGCOIN Payout"
                    aria-label="SGCOIN Payout"
                    className={`pb-4 px-2 font-bold uppercase tracking-wide transition border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'payout'
                        ? 'border-black text-black'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <Wallet className="w-5 h-5 flex-shrink-0" />
                    <span className="hidden md:inline">SGCOIN Payout</span>
                    <span className="md:hidden">Payout</span>
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    title="Account Settings"
                    aria-label="Account Settings"
                    className={`pb-4 px-2 font-bold uppercase tracking-wide transition border-b-2 flex items-center gap-2 whitespace-nowrap ${activeTab === 'settings'
                        ? 'border-black text-black'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                        }`}
                >
                    <Settings className="w-5 h-5 flex-shrink-0" />
                    <span className="hidden sm:inline">Account Settings</span>
                </button>
            </div>

            {/* Orders Tab */}
            {activeTab === 'orders' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h2 className="font-display text-2xl font-bold uppercase mb-6">Your Orders</h2>
                    {isLoading ? (
                        <div className="space-y-6">
                            <OrderSkeleton />
                            <OrderSkeleton />
                            <OrderSkeleton />
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500 mb-4">No orders yet</p>
                            <a
                                href="/shop"
                                className="inline-block bg-black text-white px-6 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition"
                            >
                                Start Shopping
                            </a>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {orders.map((order) => (
                                <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    {/* Order Header */}
                                    <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                            <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                                    Order Number
                                                </p>
                                                <p className="font-mono text-sm font-bold">{order.id}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {new Date(order.createdAt).toLocaleDateString('en-US', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                    })}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                                        Total
                                                    </p>
                                                    <p className="text-xl font-bold">${order.total.toFixed(2)}</p>
                                                </div>
                                                <div className={`flex items-center gap-2 px-3 py-2 rounded-full border ${getStatusColor(order.shippingStatus)}`}>
                                                    {getStatusIcon(order.shippingStatus)}
                                                    <span className="text-sm font-medium capitalize">
                                                        {order.shippingStatus.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order Items */}
                                    <div className="px-6 py-4">
                                        <div className="space-y-3">
                                            {order.items.map((item: any, index: number) => (
                                                <div key={index} className="flex items-center gap-4">
                                                    <img
                                                        src={item.image}
                                                        alt={item.name}
                                                        className="w-16 h-16 object-cover rounded bg-gray-100"
                                                    />
                                                    <div className="flex-1">
                                                        <p className="font-medium">{item.name}</p>
                                                        <p className="text-sm text-gray-500">
                                                            Size: {item.size} • Qty: {item.quantity}
                                                        </p>
                                                    </div>
                                                    <p className="font-bold">${item.price.toFixed(2)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tracking Info */}
                                    {order.trackingNumber && (
                                        <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
                                            <div className="flex items-center gap-3">
                                                <Truck className="w-5 h-5 text-blue-600" />
                                                <div>
                                                    <p className="text-sm font-medium text-blue-900">
                                                        Tracking Number
                                                    </p>
                                                    <p className="text-sm font-mono text-blue-700">
                                                        {order.trackingNumber}
                                                    </p>
                                                </div>
                                                <a
                                                    href={`https://www.ups.com/track?tracknum=${order.trackingNumber}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="ml-auto text-sm font-bold text-blue-600 hover:text-blue-800 underline"
                                                >
                                                    Track Package →
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payment Method */}
                                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                                        <p className="text-xs text-gray-500">
                                            Payment: {order.paymentMethod === 'crypto' ? '🔗 Cryptocurrency' : '💳 Card'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Favorites Tab */}
            {activeTab === 'favorites' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h2 className="font-display text-2xl font-bold uppercase mb-6">Your Favorites</h2>
                    {isLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <ProductCardSkeleton />
                            <ProductCardSkeleton />
                            <ProductCardSkeleton />
                            <ProductCardSkeleton />
                        </div>
                    ) : favorites.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg">
                            <p className="text-gray-500 mb-4">No favorites yet. Go shop!</p>
                            <a
                                href="/shop"
                                className="inline-block bg-black text-white px-6 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition"
                            >
                                Browse Products
                            </a>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {favorites.map(p => <ProductCard key={p.id} product={p} />)}
                        </div>
                    )}
                </div>
            )}

            {/* Referrals Tab — lazy-loaded via React.lazy above */}
            {activeTab === 'referrals' && (
                <Suspense
                    fallback={
                        <div className="space-y-3" aria-busy="true">
                            <Skeleton className="h-10 w-1/3 bg-gray-200 rounded" />
                            <Skeleton className="h-32 w-full rounded-xl bg-gray-200" />
                            <Skeleton className="h-12 w-3/4 rounded-xl bg-gray-200" />
                        </div>
                    }
                >
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <h2 className="font-display text-2xl font-bold uppercase mb-6">Referral Program</h2>
                        <ReferralDashboard />
                    </div>
                </Suspense>
            )}

            {/* VIP Membership Tab */}
            {activeTab === 'vip' && (
                <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h2 className="font-display text-2xl font-bold uppercase mb-6">VIP Membership Status</h2>
                    {isVipMember ? (
                        <div className="bg-gradient-to-br from-purple-900/40 to-black border-2 border-purple-500/50 rounded-2xl p-8 text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-16 h-16 rounded-full bg-purple-500 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                                        <Star className="w-8 h-8 text-white fill-current" />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-bold uppercase tracking-tighter">Verified VIP Member</h3>
                                        <p className="text-purple-300 font-mono text-sm">Status: Active Lifetime Member</p>
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-3 gap-6 mt-8">
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                        <h4 className="font-bold uppercase text-xs tracking-widest text-gray-400 mb-2">Monthly Credit</h4>
                                        <p className="text-xl font-bold">$15 Store Credit</p>
                                        <p className="text-sm text-gray-500 mt-1">Automatically added every month</p>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                        <h4 className="font-bold uppercase text-xs tracking-widest text-gray-400 mb-2">Shipping</h4>
                                        <p className="text-xl font-bold">Free Standard</p>
                                        <p className="text-sm text-gray-500 mt-1">VIP members pay no shipping on standard orders</p>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                        <h4 className="font-bold uppercase text-xs tracking-widest text-gray-400 mb-2">Giveaway Boost</h4>
                                        <p className="text-xl font-bold flex items-center gap-2">
                                            <Ticket className="h-5 w-5 text-purple-400" />
                                            15 Tickets
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1">Auto-entered into every active giveaway</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
                            <Star className="w-16 h-16 mx-auto text-gray-300 mb-6" />
                            <h3 className="text-2xl font-bold text-gray-900 mb-4 uppercase">Unlock VIP Status</h3>
                            <p className="text-gray-600 mb-8 max-w-md mx-auto">
                                Join our inner circle to unlock $15 monthly credit, free shipping, and auto-entry into every giveaway with 15 tickets.
                            </p>
                            <Link
                                to="/membership"
                                className="inline-block bg-purple-600 text-white px-8 py-4 rounded-sm font-bold uppercase tracking-widest hover:bg-purple-700 transition shadow-[0_4px_14px_0_rgba(147,51,234,0.39)]"
                            >
                                Learn More & Join
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* Purchase Requests Tab — lazy-loaded via React.lazy above */}
            {activeTab === 'requests' && (
                <Suspense
                    fallback={
                        <div className="space-y-3" aria-busy="true">
                            <Skeleton className="h-10 w-1/3 bg-gray-200 rounded" />
                            <Skeleton className="h-32 w-full rounded-xl bg-gray-200" />
                            <Skeleton className="h-12 w-3/4 rounded-xl bg-gray-200" />
                        </div>
                    }
                >
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <PurchaseRequestsTab userId={user.uid} />
                    </div>
                </Suspense>
            )}

            {/* SGCOIN Payout Tab — lazy-loaded. Mounts when user opens the
                SGCOIN Payout tab. Renders the dashboard (balance + 2 action cards
                + info notice) + history + Request Payout modal. */}
            {activeTab === 'payout' && (
                <Suspense
                    fallback={
                        <div className="space-y-3" aria-busy="true">
                            <Skeleton className="h-32 w-full rounded-xl bg-gray-200" />
                            <Skeleton className="h-24 w-full rounded-xl bg-gray-200" />
                            <Skeleton className="h-12 w-3/4 rounded-xl bg-gray-200" />
                        </div>
                    }
                >
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <SGCoinPayoutTab userId={user.uid} balance={user.sgCoinBalance} />
                    </div>
                </Suspense>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <h2 className="font-display text-2xl font-bold uppercase mb-6">Account Settings</h2>

                    {/* Account Linking Section — AccountLinking is lazy-loaded */}
                    <div className="mb-8">
                        <Suspense
                            fallback={
                                <div className="space-y-3" aria-busy="true">
                                    <Skeleton className="h-6 w-1/3 bg-gray-200 rounded" />
                                    <Skeleton className="h-20 w-full rounded-xl bg-gray-200" />
                                    <Skeleton className="h-20 w-full rounded-xl bg-gray-200" />
                                </div>
                            }
                        >
                            <AccountLinking />
                        </Suspense>
                    </div>

                    {/* Wallet Connection Card */}
                    <div className="bg-white rounded-xl border-2 border-gray-200 p-6 max-w-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <Wallet className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Wallet Connection</h3>
                                <p className="text-sm text-gray-600">Link your wallet to convert SGCoin to cash</p>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-green-800">{success}</p>
                            </div>
                        )}

                        {user?.connectedWalletAddress ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        <span className="font-bold text-green-900">Wallet Connected</span>
                                    </div>
                                    <div className="flex items-center justify-between bg-white p-3 rounded border border-green-200">
                                        <code className="text-sm text-gray-900 font-mono break-all mr-2">
                                            {user.connectedWalletAddress}
                                        </code>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(user.connectedWalletAddress!);
                                                setSuccess('Address copied!');
                                                setTimeout(() => setSuccess(''), 2000);
                                            }}
                                            className="p-2 hover:bg-gray-100 rounded transition flex-shrink-0"
                                            title="Copy address"
                                        >
                                            <Copy className="w-4 h-4 text-gray-600" />
                                        </button>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-600">
                                        Connected via: <span className="font-semibold capitalize">{user.walletConnectionMethod}</span>
                                        {user.walletConnectedAt && (
                                            <span className="ml-2">
                                                • {new Date(user.walletConnectedAt).toLocaleDateString()}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        if (window.confirm('Disconnect wallet? You will not be able to convert SGCoin to cash until you reconnect.')) {
                                            await disconnectWallet();
                                            setSuccess('Wallet disconnected');
                                            setTimeout(() => setSuccess(''), 3000);
                                        }
                                    }}
                                    className="w-full py-3 border-2 border-red-300 text-red-700 font-bold rounded-lg hover:bg-red-50 transition"
                                >
                                    Disconnect Wallet
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-yellow-800">
                                        <p className="font-semibold mb-1">No wallet connected</p>
                                        <p>Connect a wallet to convert SGCoin to cash and receive NFTs.</p>
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        setError('');
                                        setSuccess('');
                                        setIsConnecting(true);
                                        try {
                                            if (typeof window.ethereum === 'undefined') {
                                                setError('MetaMask not installed. Please install MetaMask extension.');
                                                setIsConnecting(false);
                                                return;
                                            }
                                            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                                            if (accounts[0]) {
                                                await connectMetaMaskWallet(accounts[0]);
                                                setSuccess('MetaMask wallet connected!');
                                            }
                                        } catch (err: any) {
                                            setError(err.message || 'Failed to connect MetaMask');
                                        } finally {
                                            setIsConnecting(false);
                                        }
                                    }}
                                    disabled={isConnecting}
                                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-lg hover:from-orange-600 hover:to-orange-700 transition flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    <Wallet className="w-5 h-5" />
                                    {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                                </button>

                                {!showManualInput ? (
                                    <button
                                        onClick={() => setShowManualInput(true)}
                                        className="w-full py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2"
                                    >
                                        <LinkIcon className="w-4 h-4" />
                                        Enter Wallet Address Manually
                                    </button>
                                ) : (
                                    <div className="space-y-3">
                                        <label className="block">
                                            <span className="text-sm font-bold text-gray-900 mb-2 block">Wallet Address</span>
                                            <input
                                                type="text"
                                                value={manualAddress}
                                                onChange={(e) => setManualAddress(e.target.value)}
                                                placeholder="0x..."
                                                className="w-full border-2 border-gray-400 rounded-lg px-4 py-3 text-gray-900 bg-white focus:ring-2 focus:ring-black focus:border-black font-mono text-sm"
                                            />
                                        </label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    setError('');
                                                    setSuccess('');
                                                    if (!manualAddress.trim()) {
                                                        setError('Please enter a wallet address');
                                                        return;
                                                    }
                                                    if (!/^0x[a-fA-F0-9]{40}$/.test(manualAddress)) {
                                                        setError('Invalid address. Must start with 0x and be 42 characters.');
                                                        return;
                                                    }
                                                    setIsConnecting(true);
                                                    try {
                                                        await connectManualWallet(manualAddress);
                                                        setSuccess('Wallet address saved!');
                                                        setManualAddress('');
                                                        setShowManualInput(false);
                                                    } catch (err: any) {
                                                        setError(err.message || 'Failed to save address');
                                                    } finally {
                                                        setIsConnecting(false);
                                                    }
                                                }}
                                                disabled={isConnecting}
                                                className="flex-1 py-3 bg-black text-white font-bold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                                            >
                                                {isConnecting ? 'Saving...' : 'Save Address'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowManualInput(false);
                                                    setManualAddress('');
                                                    setError('');
                                                }}
                                                className="px-4 py-3 border-2 border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
