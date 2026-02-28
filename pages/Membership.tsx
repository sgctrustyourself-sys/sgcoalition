import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, CreditCard, ShoppingBag, Check, Star, Zap, X, Loader, Sparkles as SparklesIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';

const Membership = () => {
    const { addToast } = useToast();
    const { user } = useApp();

    const [isLoading, setIsLoading] = React.useState(false);
    const [showPayment, setShowPayment] = React.useState(false);
    const [paymentError, setPaymentError] = React.useState<string | null>(null);

    const handleSubscribe = () => {
        setShowPayment(true);
    };

    const initializePayPal = async () => {
        if (!window.paypal) {
            setPaymentError('PayPal SDK not loaded. Please refresh.');
            return;
        }

        try {
            setIsLoading(true);
            const container = document.getElementById('paypal-button-container-membership');
            if (container) {
                container.innerHTML = '';
            }

            window.paypal.Buttons({
                createOrder: (data: any, actions: any) => {
                    return actions.order.create({
                        purchase_units: [{
                            amount: {
                                currency_code: 'USD',
                                value: '15.00',
                                breakdown: {
                                    item_total: { currency_code: 'USD', value: '15.00' }
                                }
                            },
                            description: 'Coalition VIP Membership (1 Month)',
                            items: [{
                                name: 'Coalition VIP Membership',
                                quantity: '1',
                                unit_amount: { currency_code: 'USD', value: '15.00' },
                                category: 'DIGITAL_GOODS'
                            }]
                        }]
                    });
                },
                onApprove: async (data: any, actions: any) => {
                    try {
                        const order = await actions.order.capture();
                        const transactionId = order.purchase_units[0].payments.captures[0].id;

                        // Notify admin and update user status
                        await fetch('/api/notify-membership', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                orderId: transactionId,
                                userId: user?.uid,
                                userEmail: user?.email,
                                amount: '15.00',
                                tier: 'VIP'
                            })
                        });

                        addToast('Welcome to the Elite Circle! Your VIP status is being activated.', 'success');
                        setShowPayment(false);
                    } catch (err: any) {
                        console.error('Membership activation error:', err);
                        setPaymentError('Payment succeeded but membership activation failed. Please contact support.');
                    }
                },
                onError: (err: any) => {
                    console.error('PayPal error:', err);
                    setPaymentError('Payment failed. Please try again.');
                }
            }).render('#paypal-button-container-membership');
            setIsLoading(false);
        } catch (err: any) {
            console.error('PayPal init error:', err);
            setPaymentError('Failed to initialize PayPal.');
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        if (showPayment) {
            initializePayPal();
        }
    }, [showPayment]);


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
                        <div className="bg-purple-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-purple-400">
                            <CreditCard className="w-8 h-8" />
                        </div>
                        <h3 className="font-display text-2xl font-bold uppercase mb-4">Build Credit</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Works with <span className="text-white font-bold">Ava</span> and other credit-builder cards. Since this is a subscription, it qualifies for recurring payment reporting to help boost your score.
                        </p>
                    </div>

                    {/* Benefit 2 */}
                    <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-blue-500/30 transition-colors group">
                        <div className="bg-blue-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-blue-400">
                            <ShoppingBag className="w-8 h-8" />
                        </div>
                        <h3 className="font-display text-2xl font-bold uppercase mb-4">$15 Monthly Credit</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Get <span className="text-white font-bold">$15 store credit</span> added to your account every month. Use it on any drop. The membership effectively costs you nothing.
                        </p>
                    </div>

                    {/* Benefit 3 */}
                    <div className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:border-green-500/30 transition-colors group">
                        <div className="bg-green-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-green-400">
                            <Zap className="w-8 h-8" />
                        </div>
                        <h3 className="font-display text-2xl font-bold uppercase mb-4">VIP Status</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Unlock the exclusive <span className="text-white font-bold">VIP Badge</span> on your profile. Get early access to limited drops and free shipping on all orders.
                        </p>
                    </div>
                </div>
            </div>

            {/* SGCoin Section */}
            <div className="py-24 px-4 bg-black relative">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
                            <Star className="w-4 h-4 text-amber-500 fill-current" />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500">The Coalition Economy</span>
                        </div>
                        <h2 className="font-display text-4xl md:text-5xl font-bold uppercase mb-6">
                            Understanding <span className="text-amber-500">SGCoin V2</span>
                        </h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                            The next generation of the Coalition economy. SGCoin V2 is a scarce, high-value asset designed to power our elite ecosystem.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 mb-16">
                        {/* What is SGCoin */}
                        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Star className="w-32 h-32" />
                            </div>
                            <div className="flex items-start gap-4 mb-6">
                                <div className="bg-amber-500/20 p-3 rounded-lg">
                                    <Star className="w-6 h-6 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold uppercase mb-2">What is SGCoin V2?</h3>
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        SGCoin V2 is our upgraded digital token on the Polygon blockchain. With a strictly limited supply of only 10 million tokens, it is designed for stability and long-term utility within the Coalition.
                                    </p>
                                </div>
                            </div>
                            <ul className="space-y-3">
                                {[
                                    'Blockchain-verified ownership',
                                    'Trade or hold your tokens',
                                    'Growing utility across Coalition'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                        <Check className="w-4 h-4 text-green-500" />
                                        {item}
                                    </li>
                                ))}
                                <li className="flex items-center gap-3 text-sm text-amber-400 font-bold mt-4 pt-4 border-t border-white/5">
                                    <Zap className="w-4 h-4" />
                                    Target Valuation: $1.00 USD / SGC
                                </li>
                            </ul>
                        </div>

                        {/* How to Earn */}
                        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 relative overflow-hidden group">
                            <div className="flex items-start gap-4 mb-8">
                                <div className="bg-purple-500/20 p-3 rounded-lg">
                                    <Zap className="w-6 h-6 text-purple-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold uppercase mb-2">How to Earn V2</h3>
                                    <p className="text-sm text-gray-400">Stack the new high-value asset and grow your stake in the Coalition transition.</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { title: 'Every Purchase', desc: 'Earn 1 SGCoin V2 for every $1 spent on all Coalition products.', note: 'Fair 1:1 reward rate calibrated for the new 10M supply' },
                                    { title: 'Migration Burn', desc: 'Convert your V1 tokens to V2 at a fair 1M:1 ratio.', note: 'Transparency and loyalty rewarded equally for all holders' },
                                    { title: 'Exclusive Drops', desc: 'Early access and bonus tokens for VIP Members.' },
                                    { title: 'Community Alpha', desc: 'Earn V2 through engagement and private discord events.' }
                                ].map((item, i) => (
                                    <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-xl">
                                        <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-wide">{item.title}</h4>
                                        <p className="text-xs text-gray-500">{item.desc}</p>
                                        {item.note && <p className="text-[10px] text-amber-500/70 mt-1 italic font-mono">⚠️ {item.note}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="text-center">
                        <h3 className="font-display text-2xl font-bold uppercase mb-8">How to Use SGCoin V2</h3>
                        <p className="text-gray-500 mb-12 text-sm uppercase tracking-widest">Turn your tokens into real value</p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                            {[
                                { title: 'Checkout Savings', desc: 'SGC V2 tokens carry significantly higher purchasing power per unit than V1.' },
                                { title: 'Exclusive Access', desc: 'V2 is the primary key for early drops and limited edition items.' },
                                { title: 'Liquidity & Trade', desc: 'Participate in the healthy, low-supply V2 economy on QuickSwap.' }
                            ].map((item, i) => (
                                <div key={i} className="p-6 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/5 transition-colors">
                                    <h4 className="font-bold text-white mb-2 uppercase tracking-wide text-sm">{item.title}</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>

                        <div className="max-w-3xl mx-auto mb-12 p-6 bg-blue-500/5 border border-blue-500/20 rounded-xl text-left">
                            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Shield className="w-3 h-3" />
                                Migration Transparency
                            </h4>
                            <p className="text-[11px] text-gray-400 leading-relaxed">
                                The transition from V1 to V2 is a strategic upgrade designed to stabilize the Coalition economy. By reducing the total supply from 10 Trillion to 10 Million, we are able to peg the target valuation of each V2 token to $1.00 USD. This ensures a more intuitive and valuable experience for all members. Long-time V1 holders are encouraged to use the SafeMigration portal to burn their V1 tokens for V2 at the fair 1,000,000:1 ratio.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button className="px-8 py-3 bg-amber-500 text-black font-bold uppercase tracking-widest text-xs hover:brightness-110 transition-all rounded-sm">
                                Start Earning Now
                            </button>
                            <Link to="/ecosystem" className="px-8 py-3 border border-white/20 text-white font-bold uppercase tracking-widest text-xs hover:bg-white/5 transition-all rounded-sm">
                                View Ecosystem
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparison Table */}
            <div className="max-w-4xl mx-auto px-4 py-24 border-t border-white/10">
                <h2 className="font-display text-4xl font-bold uppercase text-center mb-16 tracking-tight">Membership Tiers</h2>

                <div className="grid grid-cols-3 gap-0 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                    {/* Header Row */}
                    <div className="p-8 border-b border-r border-white/10 bg-white/[0.02]"></div>
                    <div className="p-8 border-b border-r border-white/10 bg-white/[0.02] text-center">
                        <h4 className="font-bold text-gray-400 uppercase tracking-widest text-[10px] mb-2">Standard</h4>
                        <p className="text-2xl font-bold">Free</p>
                    </div>
                    <div className="p-8 border-b border-white/10 bg-purple-500/10 text-center relative">
                        <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-tighter">Most Popular</div>
                        <h4 className="font-bold text-purple-400 uppercase tracking-widest text-[10px] mb-2">Coalition VIP</h4>
                        <p className="text-2xl font-bold">$15<span className="text-sm text-gray-500 font-normal">/mo</span></p>
                    </div>

                    {/* Features Rows */}
                    {[
                        { label: 'Access to Products', std: true, vip: true },
                        { label: 'SGCoin Rewards', std: true, vip: true },
                        { label: 'Monthly Store Credit', std: false, vip: '$15.00' },
                        { label: 'Ava / Credit Builder Friendly', std: false, vip: true },
                        { label: 'Free Shipping', std: false, vip: true }
                    ].map((row, i) => (
                        <React.Fragment key={i}>
                            <div className="p-6 border-b border-r border-white/10 text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center bg-white/[0.01]">
                                {row.label}
                            </div>
                            <div className="p-6 border-b border-r border-white/10 text-center flex items-center justify-center">
                                {typeof row.std === 'boolean' ? (
                                    row.std ? <Check className="w-5 h-5 text-green-500/50" /> : <X className="w-5 h-5 text-red-500/20" />
                                ) : <span className="text-xs font-mono">{row.std}</span>}
                            </div>
                            <div className="p-6 border-b border-white/10 text-center flex items-center justify-center bg-purple-500/[0.05]">
                                {typeof row.vip === 'boolean' ? (
                                    row.vip ? <Check className="w-6 h-6 text-green-400" /> : <X className="w-6 h-6 text-red-400" />
                                ) : <span className="text-sm font-bold text-green-400 font-mono">{row.vip}</span>}
                            </div>
                        </React.Fragment>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <button
                        onClick={handleSubscribe}
                        className="group relative inline-flex items-center justify-center"
                    >
                        <div className="absolute inset-0 bg-purple-600 blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                        <span className="relative bg-purple-600 text-white px-16 py-5 text-sm font-bold uppercase tracking-[0.2em] hover:bg-purple-500 transition-all rounded-sm shadow-2xl">
                            Upgrade to VIP
                        </span>
                    </button>
                    <p className="mt-6 text-[10px] text-gray-500 uppercase tracking-widest font-medium">Cancel anytime. Secure payment via PayPal.</p>
                </div>
            </div>

            {/* Payment Modal */}
            {showPayment && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setShowPayment(false)}></div>
                    <div className="relative bg-brand-dark border border-white/10 w-full max-w-md rounded-3xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-black uppercase">VIP Upgrade</h3>
                                <button onClick={() => setShowPayment(false)} className="text-gray-500 hover:text-white transition" title="Close Payment Portal">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-6 mb-8 text-center">
                                <span className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 block">Premium Membership</span>
                                <div className="text-4xl font-black text-white">$15.00</div>
                                <div className="text-xs text-gray-400 mt-2 uppercase">Per Month</div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex items-center gap-3 text-sm text-gray-300">
                                    <Check className="w-4 h-4 text-purple-400" />
                                    <span>$15 Monthly Store Credit</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-300">
                                    <Check className="w-4 h-4 text-purple-400" />
                                    <span>Exclusive Founders Badge</span>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-gray-300">
                                    <Check className="w-4 h-4 text-purple-400" />
                                    <span>Early Access to Drops</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {paymentError && (
                                    <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-red-400 text-xs text-center">
                                        {paymentError}
                                    </div>
                                )}

                                <div id="paypal-button-container-membership" className="min-h-[150px]">
                                    {isLoading && (
                                        <div className="flex flex-col items-center justify-center py-10">
                                            <Loader className="w-8 h-8 text-purple-500 animate-spin mb-4" />
                                            <span className="text-sm text-gray-400 font-bold uppercase tracking-widest">Initialising PayPal...</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="text-[10px] text-gray-500 text-center mt-8 uppercase tracking-widest leading-relaxed">
                                Processed via PayPal Secure Checkout.<br />
                                Cancel or manage subscription in your PayPal account.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Membership;
