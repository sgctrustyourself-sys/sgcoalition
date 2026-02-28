import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Wallet, Mail, DollarSign, CheckCircle, Zap, ArrowUpRight, Sparkles, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { sendAdminNotification } from '../services/emailService';

// Declare PayPal SDK types
declare global {
    interface Window {
        paypal: any;
    }
}

const BuySGCoin = () => {
    const navigate = useNavigate();
    const { user } = useApp();

    const [formData, setFormData] = useState({
        email: user?.email || '',
        walletAddress: '',
        usdAmount: ''
    });

    const [sgcoinAmount, setSgcoinAmount] = useState(0);
    const [bonusAmount, setBonusAmount] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Preset amounts
    const presetAmounts = [50, 100, 250, 500];

    // Real-time price calculation (example: $0.001 per SGCOIN)
    const PRICE_PER_SGCOIN = 0.001;
    const BONUS_PERCENTAGE = 0.10;

    useEffect(() => {
        const usd = parseFloat(formData.usdAmount) || 0;
        const base = usd / PRICE_PER_SGCOIN;
        const bonus = base * BONUS_PERCENTAGE;
        const total = base + bonus;

        setSgcoinAmount(base);
        setBonusAmount(bonus);
        setTotalAmount(total);
    }, [formData.usdAmount]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(null);
    };

    const handlePresetAmount = (amount: number) => {
        setFormData({ ...formData, usdAmount: amount.toString() });
    };

    const validateForm = (): boolean => {
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            setError('Please enter a valid email address');
            return false;
        }

        if (!formData.walletAddress || formData.walletAddress.length < 10) {
            setError('Please enter a valid wallet address');
            return false;
        }

        const amount = parseFloat(formData.usdAmount);
        if (!amount || amount < 10) {
            setError('Minimum purchase amount is $10');
            return false;
        }

        return true;
    };

    const handlePayPalCheckout = async () => {
        if (!validateForm()) return;

        setIsProcessing(true);
        setError(null);

        try {
            // Check if PayPal SDK is loaded
            if (typeof window.paypal === 'undefined') {
                throw new Error('PayPal SDK not loaded. Please refresh the page.');
            }

            // Create PayPal order
            const paypalButtonContainer = document.getElementById('paypal-button-container');
            if (!paypalButtonContainer) return;

            // Clear any existing buttons
            paypalButtonContainer.innerHTML = '';

            window.paypal.Buttons({
                createOrder: (data: any, actions: any) => {
                    return actions.order.create({
                        purchase_units: [{
                            description: `SGCOIN V2 Purchase - ${totalAmount.toLocaleString()} SGCOIN (includes 10% bonus)`,
                            amount: {
                                currency_code: 'USD',
                                value: formData.usdAmount
                            },
                            custom_id: `${formData.walletAddress}_${Date.now()}`
                        }]
                    });
                },
                onApprove: async (data: any, actions: any) => {
                    try {
                        const order = await actions.order.capture();

                        // Send admin notification with PayPal transaction details
                        const transactionId = order.purchase_units[0].payments.captures[0].id;
                        const notificationMessage = `
🎉 New SGCOIN Purchase!

💰 Amount Paid: $${formData.usdAmount} USD
🪙 SGCOIN Total: ${totalAmount.toLocaleString()} SGCOIN
   - Base: ${sgcoinAmount.toLocaleString()}
   - 10% Bonus: ${bonusAmount.toLocaleString()}

👤 Customer Email: ${formData.email}
💼 Wallet Address: ${formData.walletAddress}

📋 PayPal Details:
   - Order ID: ${order.id}
   - Transaction ID: ${transactionId}
   - Status: ${order.status}

⏰ Please send SGCOIN within 24 hours.
                        `.trim();

                        await sendAdminNotification(
                            formData.email,
                            'SGCOIN Purchase Notification',
                            notificationMessage
                        );

                        setSuccess(true);
                        setIsProcessing(false);
                    } catch (err: any) {
                        console.error('Payment capture error:', err);
                        setError('Payment was approved but failed to process. Please contact support.');
                        setIsProcessing(false);
                    }
                },
                onError: (err: any) => {
                    console.error('PayPal error:', err);
                    setError('Payment failed. Please try again or contact support.');
                    setIsProcessing(false);
                },
                onCancel: () => {
                    setError('Payment was cancelled.');
                    setIsProcessing(false);
                }
            }).render('#paypal-button-container');

        } catch (err: any) {
            console.error('Payment error:', err);
            setError(err.message || 'Payment failed. Please try again.');
            setIsProcessing(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-[#050505] text-white pt-24 pb-16 px-4">
                <div className="max-w-2xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gradient-to-br from-green-900/20 to-green-800/20 border border-green-500/30 rounded-3xl p-12 text-center backdrop-blur-xl"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                        >
                            <CheckCircle className="w-24 h-24 text-green-500 mx-auto mb-6" />
                        </motion.div>
                        <h1 className="font-display text-5xl font-black uppercase mb-4">Payment Received!</h1>
                        <p className="text-gray-300 text-lg mb-8">
                            Your SGCOIN purchase has been confirmed
                        </p>

                        <div className="bg-black/50 rounded-2xl p-8 mb-8 text-left space-y-4">
                            <div className="flex justify-between items-center pb-4 border-b border-white/10">
                                <span className="text-gray-400">USD Paid</span>
                                <span className="text-2xl font-black">${formData.usdAmount}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-white/10">
                                <span className="text-gray-400">SGCOIN (Base)</span>
                                <span className="text-xl font-bold">{sgcoinAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-green-500/20">
                                <span className="text-green-400 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    10% Bonus
                                </span>
                                <span className="text-xl font-bold text-green-400">+{bonusAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-white font-bold text-lg">Total SGCOIN</span>
                                <span className="text-3xl font-black bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                                    {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6 mb-8">
                            <h3 className="font-bold text-white mb-3 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-400" />
                                What happens next?
                            </h3>
                            <ul className="space-y-2 text-gray-300 text-sm text-left">
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    <span>SGCOIN will be sent to your wallet within 24 hours</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    <span>You'll receive a confirmation email</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-green-500 mt-0.5">✓</span>
                                    <span>Track your request in your profile</span>
                                </li>
                            </ul>
                        </div>

                        <div className="flex gap-4 justify-center">
                            <Link
                                to="/profile"
                                className="bg-white text-black px-8 py-3 rounded-full font-black uppercase tracking-widest hover:bg-gray-200 transition text-sm"
                            >
                                View Profile
                            </Link>
                            <Link
                                to="/ecosystem"
                                className="border-2 border-white/30 text-white px-8 py-3 rounded-full font-black uppercase tracking-widest hover:bg-white/10 transition text-sm"
                            >
                                Explore Ecosystem
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white pt-24 pb-16 px-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-600/10 blur-[150px] rounded-full" />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="max-w-4xl mx-auto relative z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center text-sm text-gray-400 hover:text-white mb-8 transition group"
                >
                    <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Back
                </button>

                {/* Hero Section */}
                <div className="text-center mb-12">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-green-500/20 bg-green-500/10 text-green-400 text-[10px] mb-6 uppercase tracking-[0.3em] font-bold"
                    >
                        <Sparkles className="w-3 h-3" /> +10% Bonus on Direct Purchases
                    </motion.div>
                    <h1 className="font-display text-6xl md:text-7xl font-black uppercase mb-4">
                        Buy <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-blue-400 to-purple-500">SGCOIN V2</span>
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                        Purchase SGCOIN directly and receive <span className="text-green-400 font-bold">10% more coins</span> than swapping. Delivered to your wallet within 24 hours.
                    </p>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-center"
                    >
                        {error}
                    </motion.div>
                )}

                <div className="grid md:grid-cols-2 gap-8 mb-8">
                    {/* Purchase Form */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl space-y-6">
                        <h2 className="text-2xl font-black uppercase tracking-tight mb-6">Purchase Details</h2>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email Address
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="your@email.com"
                                className="w-full bg-black/30 border border-white/10 p-3 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none transition"
                                required
                            />
                        </div>

                        {/* Wallet Address */}
                        <div>
                            <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Wallet className="w-4 h-4" />
                                Polygon Wallet Address
                            </label>
                            <input
                                type="text"
                                name="walletAddress"
                                value={formData.walletAddress}
                                onChange={handleInputChange}
                                placeholder="0x..."
                                className="w-full bg-black/30 border border-white/10 p-3 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none transition font-mono text-sm"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                SGCOIN will be sent to this address on Polygon network
                            </p>
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                Purchase Amount (USD)
                            </label>
                            <div className="grid grid-cols-4 gap-2 mb-3">
                                {presetAmounts.map(amount => (
                                    <button
                                        key={amount}
                                        type="button"
                                        onClick={() => handlePresetAmount(amount)}
                                        className={`py-2 rounded-lg font-bold text-sm transition ${formData.usdAmount === amount.toString()
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                            }`}
                                    >
                                        ${amount}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="number"
                                name="usdAmount"
                                value={formData.usdAmount}
                                onChange={handleInputChange}
                                placeholder="Enter custom amount"
                                step="0.01"
                                min="10"
                                className="w-full bg-black/30 border border-white/10 p-3 rounded-xl text-white placeholder-gray-500 focus:border-purple-500/50 focus:outline-none transition"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Minimum: $10 USD
                            </p>
                        </div>
                    </div>

                    {/* Price Calculator */}
                    <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl">
                        <h2 className="text-2xl font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                            <Zap className="w-6 h-6 text-purple-400" />
                            You'll Receive
                        </h2>

                        <div className="space-y-4 mb-6">
                            <div className="flex justify-between items-center pb-4 border-b border-white/10">
                                <span className="text-gray-400 text-sm">Base Amount</span>
                                <span className="text-2xl font-bold">{sgcoinAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center pb-4 border-b border-green-500/20">
                                <span className="text-green-400 text-sm flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    10% Bonus
                                </span>
                                <span className="text-2xl font-bold text-green-400">+{bonusAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-white font-bold">Total SGCOIN</span>
                                <span className="text-4xl font-black bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent">
                                    {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div className="bg-black/30 rounded-2xl p-4 mb-6">
                            <p className="text-xs text-gray-400 text-center">
                                Price: ${PRICE_PER_SGCOIN.toFixed(4)} per SGCOIN
                            </p>
                        </div>

                        {/* Payment Buttons */}
                        <div className="space-y-3">
                            {/* PayPal Button Container */}
                            <div id="paypal-button-container" className="min-h-[50px]"></div>

                            <button
                                onClick={handlePayPalCheckout}
                                disabled={isProcessing || !formData.usdAmount || parseFloat(formData.usdAmount) < 10}
                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm shadow-lg shadow-purple-500/20"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Loading PayPal...
                                    </>
                                ) : (
                                    <>
                                        <DollarSign className="w-5 h-5" />
                                        Pay with PayPal
                                    </>
                                )}
                            </button>

                            <a
                                href="https://dapp.quickswap.exchange/swap/best/ETH/0xd53e417107D0e01bBE74a704BB90fe7A6916eE1e"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-xl font-bold uppercase tracking-widest hover:bg-white/10 transition flex items-center justify-center gap-2 text-sm"
                            >
                                Or Swap on QuickSwap
                                <ArrowUpRight className="w-4 h-4" />
                            </a>

                            <div className="text-center pt-2">
                                <Link to="/tutorial" className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors border-b border-transparent hover:border-white">
                                    New to crypto? Start Here
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Support Section */}
                <div className="mt-12 bg-gradient-to-br from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full -mr-20 -mt-20 group-hover:bg-blue-500/10 transition-colors" />

                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] mb-4 uppercase tracking-widest font-black">
                                    Micro-Funding
                                </div>
                                <h3 className="text-3xl font-black uppercase mb-2">Support the Build</h3>
                                <p className="text-gray-400 max-w-lg">
                                    "Watch me build in real time. Support if you believe."
                                    <br />
                                    <span className="text-white/60 italic mt-2 block font-medium">No utility yet. No pressure. Just trust.</span>
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 min-w-[280px]">
                                {[
                                    { label: 'SOL/ETH Address', value: '0x39451d0ee9Fc5dd861C985d2a3e227F6Ac7387f4', type: 'crypto' },
                                    { label: 'Cash App', value: '$SGCoalition', type: 'cash' }
                                ].map((method, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-black/40 border border-white/5 rounded-xl p-4 flex items-center justify-between group/item hover:border-white/20 transition-all cursor-pointer"
                                        onClick={() => {
                                            navigator.clipboard.writeText(method.value);
                                            // Optional: Add toast notification here if you have a toast system
                                        }}
                                    >
                                        <div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">{method.label}</p>
                                            <p className="text-white font-mono text-xs">{method.value.substring(0, 10)}...{method.value.substring(method.value.length - 4)}</p>
                                        </div>
                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover/item:bg-white/10 transition-colors">
                                            <TrendingUp className="w-4 h-4 text-gray-400 group-hover/item:text-white transition-colors" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BuySGCoin;
