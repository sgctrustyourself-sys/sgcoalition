import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, CreditCard, ShoppingBag, Check, Star, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

const Membership = () => {
    const { addToast } = useToast();
    const { user } = useApp();

    const [isLoading, setIsLoading] = React.useState(false);

    const handleSubscribe = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/create-subscription-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user?.uid
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start subscription checkout');
            }

            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL received');
            }
        } catch (error: any) {
            console.error('Subscription error:', error);
            addToast(error.message || 'Failed to start checkout. Please try again.', 'error');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-20 pb-20 bg-black text-white">
            {/* Hero Section */}
            <div className="relative py-24 px-4 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md">
                        <Star className="w-4 h-4 text-purple-400 fill-current" />
                        <span className="text-xs font-bold uppercase tracking-widest text-purple-200">The Elite Circle</span>
                    </div>

                    <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400">
                        Coalition <span className="text-purple-500">VIP</span>
                    </h1>

                    <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto mb-12 leading-relaxed">
                        Upgrade your status. Build your credit. Get paid to shop.
                        The membership that pays for itself.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                        <button
                            onClick={handleSubscribe}
                            disabled={isLoading}
                            className="w-full sm:w-auto px-10 py-5 bg-white text-black font-bold text-lg uppercase tracking-widest hover:bg-gray-200 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Loading...' : 'Join for $15/mo'}
                        </button>
                        <Link
                            to="/shop"
                            className="w-full sm:w-auto px-10 py-5 border border-white/20 text-white font-bold text-lg uppercase tracking-widest hover:bg-white/5 transition-all"
                        >
                            View Collection
                        </Link>
                    </div>
                </div>
            </div>

            {/* Benefits Grid */}
            <div className="max-w-7xl mx-auto px-4 py-20">
                <div className="grid md:grid-cols-3 gap-8">
                    {/* Benefit 1 */}
                    <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-purple-500/30 transition-colors group">
                        <div className="bg-purple-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <CreditCard className="w-8 h-8 text-purple-400" />
                        </div>
                        <h3 className="font-display text-2xl font-bold uppercase mb-4">Build Credit</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Works with <span className="text-white font-bold">Ava</span> and other credit-builder cards. Since this is a subscription, it qualifies for recurring payment reporting to help boost your score.
                        </p>
                    </div>

                    {/* Benefit 2 */}
                    <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-blue-500/30 transition-colors group">
                        <div className="bg-blue-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <ShoppingBag className="w-8 h-8 text-blue-400" />
                        </div>
                        <h3 className="font-display text-2xl font-bold uppercase mb-4">$15 Monthly Credit</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Get <span className="text-white font-bold">$15 store credit</span> added to your account every month. Use it on any drop. The membership effectively costs you nothing.
                        </p>
                    </div>

                    {/* Benefit 3 */}
                    <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-green-500/30 transition-colors group">
                        <div className="bg-green-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Shield className="w-8 h-8 text-green-400" />
                        </div>
                        <h3 className="font-display text-2xl font-bold uppercase mb-4">VIP Status</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Unlock the exclusive <span className="text-white font-bold">VIP Badge</span> on your profile. Get early access to limited drops and free shipping on all orders.
                        </p>
                    </div>
                </div>
            </div>

            {/* Economy & SGCoin Section */}
            <div className="max-w-7xl mx-auto px-4 py-20 border-t border-white/10">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-md">
                        <Zap className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-xs font-bold uppercase tracking-widest text-yellow-200">The Coalition Economy</span>
                    </div>
                    <h2 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight mb-4">
                        Understanding <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">SGCoin</span>
                    </h2>
                    <p className="text-xl text-gray-400 max-w-3xl mx-auto">
                        Your gateway to exclusive rewards, discounts, and community perks in the Coalition ecosystem.
                    </p>
                </div>

                {/* SGCoin Info Grid */}
                <div className="grid md:grid-cols-2 gap-8 mb-16">
                    {/* What is SGCoin */}
                    <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-500/20 p-8 rounded-2xl">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="bg-yellow-500/20 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Star className="w-6 h-6 text-yellow-400 fill-current" />
                            </div>
                            <div>
                                <h3 className="font-display text-2xl font-bold uppercase mb-2">What is SGCoin?</h3>
                                <p className="text-gray-400 leading-relaxed">
                                    SGCoin is Coalition's digital token built on Polygon blockchain. Earn it through purchases,
                                    giveaways, and community engagement—then use it for exclusive discounts and perks.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                                <span className="text-gray-300">Blockchain-verified ownership</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                                <span className="text-gray-300">Trade or hold your tokens</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                                <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                                <span className="text-gray-300">Growing utility across Coalition</span>
                            </div>
                        </div>
                    </div>

                    {/* How to Earn */}
                    <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20 p-8 rounded-2xl">
                        <div className="flex items-start gap-4 mb-6">
                            <div className="bg-purple-500/20 w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Zap className="w-6 h-6 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="font-display text-2xl font-bold uppercase mb-2">How to Earn SGCoin</h3>
                                <p className="text-gray-400 leading-relaxed">
                                    Multiple ways to stack tokens and grow your balance in the Coalition economy.
                                </p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-lg p-4">
                                <div className="text-2xl">🛍️</div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-white mb-1">Every Purchase</h4>
                                    <p className="text-sm text-gray-400">Earn 1000 SGCoin per $1 spent on all Coalition products</p>
                                    <p className="text-xs text-yellow-400 mt-1">⚠️ Starting rate - will be adjusted to a more stable price soon</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-lg p-4">
                                <div className="text-2xl">🎁</div>
                                <div>
                                    <h4 className="font-bold text-white mb-1">Giveaways & Contests</h4>
                                    <p className="text-sm text-gray-400">Win tokens through community events</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-lg p-4">
                                <div className="text-2xl">👥</div>
                                <div>
                                    <h4 className="font-bold text-white mb-1">Referral Rewards</h4>
                                    <p className="text-sm text-gray-400">Earn when friends make their first purchase</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-lg p-4">
                                <div className="text-2xl">⭐</div>
                                <div>
                                    <h4 className="font-bold text-white mb-1">VIP Members</h4>
                                    <p className="text-sm text-gray-400">Bonus tokens monthly + exclusive airdrops</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* How to Use SGCoin */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12">
                    <div className="text-center mb-10">
                        <h3 className="font-display text-3xl font-bold uppercase mb-3">How to Use SGCoin</h3>
                        <p className="text-gray-400">Turn your tokens into real value</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10 hover:border-yellow-500/30 transition-colors group">
                            <div className="text-4xl mb-4">💰</div>
                            <h4 className="font-bold text-white mb-2 uppercase tracking-wide">Discounts</h4>
                            <p className="text-sm text-gray-400">Apply tokens at checkout for instant savings on products</p>
                        </div>
                        <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10 hover:border-yellow-500/30 transition-colors group">
                            <div className="text-4xl mb-4">🎯</div>
                            <h4 className="font-bold text-white mb-2 uppercase tracking-wide">Exclusive Access</h4>
                            <p className="text-sm text-gray-400">Unlock VIP-only drops and limited edition items</p>
                        </div>
                        <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10 hover:border-yellow-500/30 transition-colors group">
                            <div className="text-4xl mb-4">🔥</div>
                            <h4 className="font-bold text-white mb-2 uppercase tracking-wide">Future Perks</h4>
                            <p className="text-sm text-gray-400">Governance votes, merch collabs, and ecosystem expansion</p>
                        </div>
                    </div>

                    <div className="mt-10 text-center">
                        <div className="inline-flex flex-col sm:flex-row items-center gap-4">
                            <Link
                                to="/shop"
                                className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold uppercase tracking-widest hover:brightness-110 transition-all rounded-sm"
                            >
                                Start Earning Now
                            </Link>
                            <Link
                                to="/help"
                                className="px-8 py-3 border border-white/20 text-white font-bold uppercase tracking-widest hover:bg-white/5 transition-all rounded-sm"
                            >
                                Learn More
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparison Table */}
            <div className="max-w-3xl mx-auto px-4 py-20 border-t border-white/10">
                <h2 className="font-display text-3xl font-bold uppercase text-center mb-12">Membership Tiers</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-6 border-b border-r border-white/10">
                        <h4 className="font-bold text-gray-500 uppercase tracking-widest text-sm mb-2">Standard</h4>
                        <p className="text-2xl font-bold">Free</p>
                    </div>
                    <div className="text-center p-6 border-b border-white/10 bg-purple-500/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-2 py-1">MOST POPULAR</div>
                        <h4 className="font-bold text-purple-400 uppercase tracking-widest text-sm mb-2">Coalition VIP</h4>
                        <p className="text-2xl font-bold">$15<span className="text-sm text-gray-500 font-normal">/mo</span></p>
                    </div>

                    {/* Row 1 */}
                    <div className="p-4 text-center text-gray-400 border-r border-white/10 text-sm">Access to Products</div>
                    <div className="p-4 text-center font-bold text-white text-sm bg-purple-500/5">
                        <Check className="w-5 h-5 mx-auto text-green-400" />
                    </div>

                    {/* Row 2 */}
                    <div className="p-4 text-center text-gray-400 border-r border-white/10 text-sm">SGCoin Rewards</div>
                    <div className="p-4 text-center font-bold text-white text-sm bg-purple-500/5">
                        <Check className="w-5 h-5 mx-auto text-green-400" />
                    </div>

                    {/* Row 3 */}
                    <div className="p-4 text-center text-gray-400 border-r border-white/10 text-sm">Monthly Store Credit</div>
                    <div className="p-4 text-center font-bold text-white text-sm bg-purple-500/5">
                        <span className="text-green-400">$15.00</span>
                    </div>

                    {/* Row 4 */}
                    <div className="p-4 text-center text-gray-400 border-r border-white/10 text-sm">Ava / Credit Builder Friendly</div>
                    <div className="p-4 text-center font-bold text-white text-sm bg-purple-500/5">
                        <Check className="w-5 h-5 mx-auto text-green-400" />
                    </div>

                    {/* Row 5 */}
                    <div className="p-4 text-center text-gray-400 border-r border-white/10 text-sm">Free Shipping</div>
                    <div className="p-4 text-center font-bold text-white text-sm bg-purple-500/5">
                        <Check className="w-5 h-5 mx-auto text-green-400" />
                    </div>
                </div>

                <div className="mt-12 text-center">
                    <button
                        onClick={handleSubscribe}
                        disabled={isLoading}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-12 py-4 text-sm font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-purple-900/40 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Processing...' : 'Upgrade to VIP'}
                    </button>
                    <p className="mt-4 text-xs text-gray-500">Cancel anytime. Secure payment via Stripe.</p>
                </div>
            </div>
        </div>
    );
};

export default Membership;
