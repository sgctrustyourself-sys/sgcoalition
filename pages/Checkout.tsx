import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Loader, Wallet, Copy, Check, Sparkles, Heart, Info, ShieldCheck, Truck, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { OrderStatus } from '../types';
import { useToast } from '../context/ToastContext';
import FloatingHelpButton from '../components/FloatingHelpButton';
import { calculateCartDiscount, isSGCoinDiscountEnabled, getDiscountPercentageText } from '../utils/pricing';
import { trackReferralEvent } from '../utils/referralAnalytics';
import { validateCouponCode, applyCouponCode, getAppliedCouponCode } from '../utils/couponSystem';

const reportErrorToAdmin = async (error: string, context: string, metadata: any = {}) => {
    try {
        console.log(`⚠️ Reporting ${context} error to admin...`);
        fetch('/api/report-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error, context, metadata })
        });
    } catch (err) {
        console.error('Failed to trigger error report:', err);
    }
};

const Checkout: React.FC = () => {
    const navigate = useNavigate();
    const { cart, cartTotal, calculateReward, clearCart, addOrder, generateOrderNumber, user } = useApp();
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'crypto' | 'card'>('paypal');
    const [copied, setCopied] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [clientSecret, setClientSecret] = useState<string>('');

    // Coupon code state
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
    const [couponReferrerName, setCouponReferrerName] = useState<string | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
    const [isValidatingZip, setIsValidatingZip] = useState(false);

    // Shipping information state - Lifted up
    const [shippingInfo, setShippingInfo] = useState({
        email: '',
        name: '',
        address1: '',
        city: '',
        state: '',
        zip: '',
        country: '',
    });

    const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');

    // VIP Free Shipping Logic
    const isVIP = user?.isVIP || false;
    const baseShippingCost = shippingMethod === 'express' ? 10 : 0;
    const shippingCost = (isVIP && shippingMethod === 'standard') ? 0 : baseShippingCost;

    const total = cartTotal();
    const reward = calculateReward(total);

    // Store Credit Logic
    const [useStoreCredit, setUseStoreCredit] = useState(false);
    const availableCredit = user?.storeCredit || 0;
    const creditToApply = useStoreCredit ? Math.min(availableCredit, total + shippingCost) : 0;
    const [isZeroAmount, setIsZeroAmount] = useState(false);

    // Calculate SGCoin discount if crypto payment is selected
    const discountEnabled = isSGCoinDiscountEnabled();
    const discount = (paymentMethod === 'crypto' && discountEnabled) ? calculateCartDiscount(total) : 0;

    // Final Total Calculation
    const finalTotal = Math.max(0, total - discount + shippingCost - creditToApply);

    const WALLET_ADDRESS = '0x0F4A0466C2a1d3FA6Ed55a20994617F0533fbf74';

    useEffect(() => {
        if (cart.length > 0 && paymentMethod === 'card') {
            createPaymentIntent();
        }
        // If payment method is crypto, we don't need payment intent
        if (paymentMethod === 'crypto') {
            setClientSecret('');
            setIsZeroAmount(false);
        }
    }, [cart, paymentMethod, useStoreCredit, shippingMethod]);

    // Check for existing coupon on mount
    useEffect(() => {
        const existingCoupon = getAppliedCouponCode();
        if (existingCoupon) {
            setAppliedCoupon(existingCoupon);
            setCouponCode(existingCoupon);
        }
    }, []);

    const handleApplyCoupon = async () => {
        setCouponError(null);
        setIsValidatingCoupon(true);

        const result = await validateCouponCode(couponCode);

        if (result.valid) {
            applyCouponCode(couponCode);
            setAppliedCoupon(couponCode.toUpperCase());
            setCouponReferrerName(result.referrerName || null);
            addToast('Coupon code applied successfully!', 'success');
        } else {
            setCouponError(result.error || 'Invalid code');
            addToast(result.error || 'Invalid coupon code', 'error');
        }

        setIsValidatingCoupon(false);
    };

    const handleRemoveCoupon = () => {
        sessionStorage.removeItem('referralCode');
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponReferrerName(null);
        setCouponError(null);
        addToast('Coupon code removed', 'info');
    };

    const createPaymentIntent = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: total + shippingCost,
                    userId: user?.uid,
                    useStoreCredit
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Network error' }));
                throw new Error(err.error || 'Failed to create payment intent');
            }
            const data = await response.json();

            if (data.zeroAmount) {
                setIsZeroAmount(true);
                setClientSecret('');
            } else {
                setIsZeroAmount(false);
                setClientSecret(data.clientSecret);
            }

        } catch (err: any) {
            console.error('Payment intent error:', err);
            setError(err.message || 'Failed to initialize payment. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setShippingInfo(prev => ({ ...prev, [name]: value }));
        if (validationError) setValidationError(null); // Clear error on edit
    };

    const handleZipBlur = async () => {
        const zip = shippingInfo.zip.replace(/\D/g, ''); // Remove non-digits
        if (zip.length !== 5) return;

        setIsValidatingZip(true);
        try {
            const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
            if (response.ok) {
                const data = await response.json();
                const place = data.places[0];
                setShippingInfo(prev => ({
                    ...prev,
                    city: place['place name'],
                    state: place['state abbreviation'],
                    country: 'United States' // Default to US since API is US-specific
                }));
            }
        } catch (error) {
            console.error('Error fetching zip data:', error);
        } finally {
            setIsValidatingZip(false);
        }
    };

    const validateShipping = (): boolean => {
        const missingFields = Object.entries(shippingInfo).filter(([_, value]) => (value as string).trim() === '');
        if (missingFields.length > 0) {
            setValidationError('Please fill in all shipping fields, including email.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(shippingInfo.email)) {
            setValidationError('Please enter a valid email address.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return false;
        }
        return true;
    };

    const copyAddress = () => {
        navigator.clipboard.writeText(WALLET_ADDRESS);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const createOrder = async (paymentMethodUsed: string, stripeSessionId?: string) => {
        try {
            const orderNumber = generateOrderNumber();
            const subtotal = total;
            const tax = 0;
            const isGuest = !user;

            const order = {
                id: `order_${Date.now()}`,
                orderNumber,
                userId: user?.uid,
                isGuest,
                guestEmail: isGuest ? shippingInfo.email : undefined,
                customerName: shippingInfo.name,
                customerEmail: shippingInfo.email,
                customerPhone: '',
                items: cart.map(item => ({
                    productId: item.id,
                    productName: item.name,
                    productImage: item.images[0],
                    selectedSize: item.selectedSize || 'One Size',
                    quantity: item.quantity,
                    price: item.price,
                    total: item.price * item.quantity
                })),
                subtotal,
                tax,
                discount: discount + creditToApply,
                total: finalTotal,
                paymentMethod: paymentMethodUsed as any,
                paymentStatus: paymentMethodUsed === 'crypto' ? OrderStatus.PENDING : OrderStatus.PAID,
                orderType: 'online' as const,
                createdAt: new Date().toISOString(),
                paidAt: paymentMethodUsed !== 'crypto' ? new Date().toISOString() : undefined,
                sgCoinReward: reward,
                shippingAddress: {
                    address1: shippingInfo.address1,
                    city: shippingInfo.city,
                    state: shippingInfo.state,
                    zip: shippingInfo.zip,
                    country: shippingInfo.country
                }
            };

            await addOrder(order);

            // Save order to sessionStorage so OrderSuccess can display it even if cart is cleared
            sessionStorage.setItem('pendingOrder', JSON.stringify(order));

            // Track referral purchase if user came from a referral link
            const referralCode = sessionStorage.getItem('referralCode');
            if (referralCode && user) {
                await trackReferralEvent(referralCode, 'purchase', user.uid);
            }

            clearCart();
            return orderNumber;
        } catch (error) {
            console.error('Error creating order:', error);
            reportErrorToAdmin(error instanceof Error ? error.message : String(error), 'Local Order Creation', {
                orderNumber: 'PRE-CAPTURE',
                customerEmail: shippingInfo.email,
                total: finalTotal
            });
            throw error;
        }
    };

    const handleCompleteFreeOrder = async () => {
        if (!validateShipping()) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/place-order-credits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.uid,
                    total: creditToApply,
                    items: cart
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Failed to process store credit');
            }

            sessionStorage.setItem('shippingInfo', JSON.stringify(shippingInfo));

            const orderNumber = await createOrder('store_credit');
            sessionStorage.setItem('orderNumber', orderNumber);
            console.log('✅ Store credit order created, redirecting...');

            window.location.href = `/order/success?payment_method=store_credit&shippingMethod=${shippingMethod}&shippingCost=${shippingCost}`;

        } catch (e: any) {
            console.error(e);
            addToast(e.message || 'Order failed', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCryptoConfirmation = async () => {
        if (!validateShipping()) return;
        try {
            const orderNumber = await createOrder('crypto');
            sessionStorage.setItem('shippingInfo', JSON.stringify(shippingInfo));
            sessionStorage.setItem('orderNumber', orderNumber);
            console.log('✅ Crypto order created, redirecting...');
            window.location.href = '/order/success?payment_method=crypto';
        } catch (error) {
            addToast('Failed to create order. Please try again.', 'error');
        }
    };

    if (cart.length === 0) {
        return (
            <div className="min-h-screen pt-24 pb-16 px-4 bg-black">
                <div className="max-w-2xl mx-auto text-center py-20">
                    <h1 className="font-display text-3xl font-bold mb-4 text-white">Your cart is empty</h1>
                    <p className="text-gray-400 mb-8">Add some items to your cart before checking out.</p>
                    <button onClick={() => navigate('/shop')} className="bg-white text-black px-8 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                        Continue Shopping
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 bg-black">
            <div className="max-w-4xl mx-auto">
                <button onClick={() => navigate(-1)} className="flex items-center text-sm text-gray-400 hover:text-white mb-8 transition">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>
                <h1 className="font-display text-4xl font-bold uppercase mb-8 text-white">Checkout</h1>

                {validationError && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg">
                        {validationError}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left side: Form & Payment */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Contact & Shipping Form */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6 backdrop-blur-sm">
                            {/* Contact Info */}
                            <div>
                                <h3 className="font-bold mb-2 text-white uppercase text-sm tracking-wide">Contact Information</h3>
                                <input
                                    name="email"
                                    type="email"
                                    placeholder="Email Address"
                                    value={shippingInfo.email}
                                    onChange={handleInputChange}
                                    className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition"
                                    required
                                />
                            </div>

                            {/* Shipping Info */}
                            <div>
                                <h3 className="font-bold mb-2 text-white uppercase text-sm tracking-wide">Shipping Address</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <input
                                            name="name"
                                            type="text"
                                            placeholder="Full Name"
                                            value={shippingInfo.name}
                                            onChange={handleInputChange}
                                            className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition"
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <input
                                            name="address1"
                                            type="text"
                                            placeholder="Address"
                                            value={shippingInfo.address1}
                                            onChange={handleInputChange}
                                            className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition"
                                            required
                                        />
                                    </div>
                                    <input
                                        name="city"
                                        type="text"
                                        placeholder="City"
                                        value={shippingInfo.city}
                                        onChange={handleInputChange}
                                        className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition"
                                        required
                                    />
                                    <input
                                        name="state"
                                        type="text"
                                        placeholder="State / Province"
                                        value={shippingInfo.state}
                                        onChange={handleInputChange}
                                        className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition"
                                        required
                                    />
                                    <div className="relative">
                                        <input
                                            name="zip"
                                            type="text"
                                            placeholder="ZIP / Postal Code"
                                            value={shippingInfo.zip}
                                            onChange={handleInputChange}
                                            onBlur={handleZipBlur}
                                            className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition"
                                            required
                                        />
                                        {isValidatingZip && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <Loader className="w-4 h-4 text-white animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                    <input
                                        name="country"
                                        type="text"
                                        placeholder="Country"
                                        value={shippingInfo.country}
                                        onChange={handleInputChange}
                                        className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Shipping Method */}
                            <div>
                                <h3 className="font-bold mb-2 text-white uppercase text-sm tracking-wide">Shipping Method</h3>
                                <div className="space-y-2">
                                    <label className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition ${shippingMethod === 'standard' ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/30'}`}>
                                        <div className="flex items-center">
                                            <input
                                                type="radio"
                                                name="shippingMethod"
                                                value="standard"
                                                checked={shippingMethod === 'standard'}
                                                onChange={() => setShippingMethod('standard')}
                                                className="mr-3"
                                            />
                                            <span>Standard Shipping</span>
                                        </div>
                                        <div className="text-right">
                                            <span className={isVIP ? "line-through text-gray-400 text-xs mr-2" : ""}>{isVIP ? "$5.00" : "Free"}</span>
                                            {isVIP && <span className="text-brand-accent font-bold">VIP FREE</span>}
                                        </div>
                                    </label>
                                    <label className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition ${shippingMethod === 'express' ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/30'}`}>
                                        <div className="flex items-center">
                                            <input
                                                type="radio"
                                                name="shippingMethod"
                                                value="express"
                                                checked={shippingMethod === 'express'}
                                                onChange={() => setShippingMethod('express')}
                                                className="mr-3"
                                            />
                                            <span>Express Shipping</span>
                                        </div>
                                        <span>$10.00</span>
                                    </label>
                                </div>
                            </div>

                            {/* Coupon Code */}
                            <div>
                                <h3 className="font-bold mb-2 text-white uppercase text-sm tracking-wide">Referral / Coupon Code</h3>
                                {appliedCoupon ? (
                                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-green-400" />
                                                <span className="text-green-400 font-bold text-sm">Code Applied: {appliedCoupon}</span>
                                            </div>
                                            <button
                                                onClick={handleRemoveCoupon}
                                                className="text-xs text-gray-400 hover:text-white transition"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        {couponReferrerName && (
                                            <p className="text-xs text-gray-300">
                                                Supporting {couponReferrerName}'s referral
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Enter referral code"
                                                value={couponCode}
                                                onChange={(e) => {
                                                    setCouponCode(e.target.value.toUpperCase());
                                                    setCouponError(null);
                                                }}
                                                className="flex-1 bg-black/30 border border-white/10 p-3 rounded-lg text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition uppercase"
                                            />
                                            <button
                                                onClick={handleApplyCoupon}
                                                disabled={!couponCode.trim() || isValidatingCoupon}
                                                className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isValidatingCoupon ? 'Validating...' : 'Apply'}
                                            </button>
                                        </div>
                                        {couponError && (
                                            <p className="text-red-400 text-xs">{couponError}</p>
                                        )}
                                        <p className="text-xs text-gray-500">
                                            Have a referral code from a friend? Enter it here!
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Store Credit Section */}
                        {availableCredit > 0 && (
                            <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4">
                                <h3 className="font-bold mb-4 text-white uppercase text-sm tracking-wide flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-brand-accent" />
                                    Store Credit
                                </h3>
                                <label className="flex items-center justify-between p-4 rounded-lg border border-white/20 bg-black/20 cursor-pointer hover:border-white/40 transition">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={useStoreCredit}
                                            onChange={(e) => setUseStoreCredit(e.target.checked)}
                                            className="w-5 h-5 rounded border-gray-500 text-brand-accent focus:ring-brand-accent"
                                        />
                                        <div>
                                            <p className="font-bold text-white">Apply Store Credit</p>
                                            <p className="text-sm text-gray-400">Available balance: ${availableCredit.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    <span className="text-green-400 font-bold">
                                        -${Math.min(availableCredit, total + shippingCost).toFixed(2)}
                                    </span>
                                </label>
                            </div>
                        )}

                        {/* Payment Method Selection */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                            <h3 className="font-bold mb-4 text-white uppercase text-sm tracking-wide">Payment Method</h3>

                            {isZeroAmount ? (
                                <div className="text-center py-6">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                                        <Check className="w-8 h-8 text-green-400" />
                                    </div>
                                    <h4 className="text-white font-bold text-lg mb-2">Paid with Store Credit</h4>
                                    <p className="text-gray-400 text-sm mb-6">No additional payment required.</p>
                                    <button
                                        onClick={handleCompleteFreeOrder}
                                        disabled={isLoading}
                                        className="w-full bg-brand-accent text-black py-4 rounded font-bold uppercase tracking-widest hover:bg-white transition disabled:opacity-50"
                                    >
                                        {isLoading ? 'Processing...' : 'Complete Order'}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3 mb-6">
                                        {/* PayPal / Card / Apple Pay Option - PRIMARY */}
                                        <label className={`flex items-center justify-between p-5 rounded-xl border-2 cursor-pointer transition group relative overflow-hidden ${paymentMethod === 'paypal' ? 'bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30'}`}>
                                            {paymentMethod === 'paypal' && (
                                                <div className="absolute top-2 right-2">
                                                    <span className="text-[9px] bg-green-500 text-white px-2 py-0.5 rounded-full font-black tracking-wider">RECOMMENDED</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    checked={paymentMethod === 'paypal'}
                                                    onChange={() => setPaymentMethod('paypal')}
                                                    className="w-5 h-5 border-gray-500 text-purple-600 focus:ring-purple-500"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-black text-base text-white">PayPal, Cards & Apple Pay</span>
                                                    <span className="text-xs text-gray-400">Pay securely with PayPal, Credit/Debit Card, or Apple Pay</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-80">
                                                <svg className="h-6" viewBox="0 0 100 32" fill="currentColor">
                                                    <path d="M12 4.917v.583c0 1.78-1.4 3.5-3.5 3.5h-2C5.67 9 5 9.67 5 10.5v.583c0 .83.67 1.5 1.5 1.5h2c3.59 0 6.5-2.91 6.5-6.5V4.917c0-.83-.67-1.5-1.5-1.5h-2c-.83 0-1.5.67-1.5 1.5z" fill="#003087" />
                                                    <path d="M35 4h-5c-.55 0-1 .45-1 1v14c0 .55.45 1 1 1h5c2.76 0 5-2.24 5-5v-6c0-2.76-2.24-5-5-5zm2 11c0 1.1-.9 2-2 2h-2V7h2c1.1 0 2 .9 2 2v6z" fill="#0070BA" />
                                                </svg>
                                                <CreditCard className="w-5 h-5 text-white" />
                                            </div>
                                        </label>

                                        {/* Crypto Option - SECONDARY */}
                                        <label className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition group ${paymentMethod === 'crypto' ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 text-gray-400'}`}>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    checked={paymentMethod === 'crypto'}
                                                    onChange={() => setPaymentMethod('crypto')}
                                                    className="w-5 h-5 border-gray-500 text-blue-500 focus:ring-blue-500"
                                                />
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-sm text-white">Pay with Crypto</span>
                                                        <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold tracking-wider">SAVE {getDiscountPercentageText()}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                                        USDC on Polygon Network <Info className="w-3 h-3" />
                                                    </span>
                                                </div>
                                            </div>
                                            <Wallet className={`w-5 h-5 ${paymentMethod === 'crypto' ? 'text-blue-400' : 'text-gray-500'}`} />
                                        </label>
                                    </div>

                                    {/* PayPal Payment */}
                                    {paymentMethod === 'paypal' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 p-4 rounded-lg">
                                                <div className="flex items-start gap-3">
                                                    <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="font-bold text-purple-400 text-sm uppercase tracking-wide mb-1">Fast & Secure Checkout</h4>
                                                        <p className="text-sm text-gray-300">
                                                            Pay with <span className="text-white font-bold">PayPal, Apple Pay, or Card</span>. All payments accepted via PayPal secure checkout. Buyer protection included.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* PayPal Button Container */}
                                            <div id="paypal-button-container-checkout" className="min-h-[50px]"></div>

                                            <button
                                                onClick={async () => {
                                                    if (!validateShipping()) return;

                                                    setIsLoading(true);
                                                    setError(null);

                                                    try {
                                                        if (typeof window.paypal === 'undefined') {
                                                            throw new Error('PayPal SDK not loaded. Please refresh the page.');
                                                        }

                                                        const paypalButtonContainer = document.getElementById('paypal-button-container-checkout');
                                                        if (!paypalButtonContainer) return;

                                                        paypalButtonContainer.innerHTML = '';

                                                        window.paypal.Buttons({
                                                            createOrder: (data: any, actions: any) => {
                                                                return actions.order.create({
                                                                    purchase_units: [{
                                                                        description: `Coalition Order - ${cart.length} item(s)`,
                                                                        amount: {
                                                                            currency_code: 'USD',
                                                                            value: finalTotal.toFixed(2),
                                                                            breakdown: {
                                                                                item_total: { currency_code: 'USD', value: total.toFixed(2) },
                                                                                shipping: { currency_code: 'USD', value: shippingCost.toFixed(2) },
                                                                                discount: { currency_code: 'USD', value: (discount + creditToApply).toFixed(2) }
                                                                            }
                                                                        },
                                                                        items: cart.map(item => ({
                                                                            name: item.name,
                                                                            quantity: item.quantity.toString(),
                                                                            unit_amount: {
                                                                                currency_code: 'USD',
                                                                                value: item.price.toFixed(2)
                                                                            }
                                                                        }))
                                                                    }]
                                                                });
                                                            },
                                                            onApprove: async (data: any, actions: any) => {
                                                                try {
                                                                    const order = await actions.order.capture();
                                                                    const transactionId = order.purchase_units[0].payments.captures[0].id;

                                                                    // Create order in database
                                                                    const orderNumber = await createOrder('paypal', transactionId);

                                                                    // Store for success page
                                                                    sessionStorage.setItem('orderNumber', orderNumber);
                                                                    sessionStorage.setItem('shippingInfo', JSON.stringify(shippingInfo));

                                                                    // Redirect to success page
                                                                    console.log('✅ PayPal payment approved, redirecting...');
                                                                    window.location.href = `/order/success?payment_method=paypal&shippingMethod=${shippingMethod}&shippingCost=${shippingCost}`;
                                                                } catch (err: any) {
                                                                    console.error('Order creation error:', err);
                                                                    reportErrorToAdmin(err.message || 'Capture Success but API Failure', 'PayPal onApprove Process', {
                                                                        customerEmail: shippingInfo.email,
                                                                        total: finalTotal
                                                                    });
                                                                    setError('Payment succeeded but order creation failed. Please contact support.');
                                                                    setIsLoading(false);
                                                                }
                                                            },
                                                            onError: (err: any) => {
                                                                console.error('PayPal error:', err);
                                                                reportErrorToAdmin(err?.message || 'Unknown PayPal SDK Error', 'PayPal onError', {
                                                                    customerEmail: shippingInfo.email,
                                                                    total: finalTotal
                                                                });
                                                                setError('Payment failed. Please try again or contact support.');
                                                                setIsLoading(false);
                                                            },
                                                            onCancel: () => {
                                                                reportErrorToAdmin('User cancelled PayPal checkout', 'PayPal onCancel', {
                                                                    customerEmail: shippingInfo.email,
                                                                    total: finalTotal
                                                                });
                                                                setError('Payment was cancelled.');
                                                                setIsLoading(false);
                                                            }
                                                        }).render('#paypal-button-container-checkout');

                                                    } catch (err: any) {
                                                        console.error('PayPal initialization error:', err);
                                                        setError(err.message || 'Failed to initialize PayPal. Please try again.');
                                                        setIsLoading(false);
                                                    }
                                                }}
                                                disabled={isLoading}
                                                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                                            >
                                                {isLoading ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader className="w-5 h-5 animate-spin" />
                                                        Loading PayPal...
                                                    </div>
                                                ) : (
                                                    'Continue to PayPal'
                                                )}
                                            </button>

                                            {error && (
                                                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg text-red-400 text-sm">
                                                    {error}
                                                </div>
                                            )}
                                        </div>
                                    )}



                                    {/* Crypto Payment */}
                                    {paymentMethod === 'crypto' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg">
                                                <div className="flex items-start gap-3">
                                                    <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="font-bold text-blue-400 text-sm uppercase tracking-wide mb-1">Pay with Crypto & Save</h4>
                                                        <p className="text-sm text-gray-300">
                                                            Pay with USDC on Polygon network and get <span className="text-white font-bold">{getDiscountPercentageText()} off</span> your order!
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-black/50 p-4 rounded-lg border border-white/10">
                                                <p className="text-sm text-gray-400 mb-2">Send <span className="text-white font-bold">{finalTotal.toFixed(2)} USDC</span> to:</p>
                                                <div className="flex items-center justify-between bg-white/5 p-3 rounded border border-white/10">
                                                    <code className="text-xs sm:text-sm font-mono text-gray-300 truncate mr-2">{WALLET_ADDRESS}</code>
                                                    <button onClick={copyAddress} className="text-gray-400 hover:text-white transition">
                                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">Network: Polygon (MATIC)</p>
                                            </div>

                                            <button
                                                onClick={handleCryptoConfirmation}
                                                className="w-full bg-blue-600 text-white py-3 rounded font-bold uppercase tracking-widest hover:bg-blue-500 transition shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                                            >
                                                I Have Sent the Payment
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right side: Order Summary */}
                    <div className="lg:col-span-1">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 sticky top-24 backdrop-blur-sm">
                            <h3 className="font-bold mb-6 text-white uppercase text-sm tracking-wide">Order Summary</h3>
                            <div className="space-y-4 mb-6">
                                {cart.map((item) => (
                                    <div key={`${item.id}-${item.selectedSize}`} className="flex gap-4">
                                        <div className="w-16 h-20 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                                            <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm text-white truncate">{item.name}</h4>
                                            <p className="text-xs text-gray-400">Size: {item.selectedSize}</p>
                                            <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                                        </div>
                                        <div className="text-sm font-medium text-white">
                                            ${(item.price * item.quantity).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3 pt-6 border-t border-white/10 text-sm">
                                <div className="flex justify-between text-gray-400">
                                    <span>Subtotal</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-gray-400">
                                    <span>Shipping</span>
                                    <span>${shippingCost.toFixed(2)}</span>
                                </div>
                                {discount > 0 && (
                                    <div className="flex justify-between text-green-400">
                                        <span>Crypto Discount</span>
                                        <span>-${discount.toFixed(2)}</span>
                                    </div>
                                )}
                                {useStoreCredit && creditToApply > 0 && (
                                    <div className="flex justify-between text-brand-accent">
                                        <span>Store Credit</span>
                                        <span>-${creditToApply.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-white font-bold text-lg pt-3 border-t border-white/10">
                                    <span>Total</span>
                                    <span>${finalTotal.toFixed(2)}</span>
                                </div>

                                {/* Estimated Rewards - Priority 5 */}
                                <div className="group relative flex justify-between items-center text-xs pt-2 cursor-help select-none">
                                    <div className="flex items-center gap-1 text-brand-accent/80 hover:text-brand-accent transition border-b border-dashed border-brand-accent/30 hover:border-brand-accent">
                                        <span>Estimated Rewards</span>
                                        <Info className="w-3 h-3" />
                                    </div>
                                    <span className="font-mono text-brand-accent">+{reward} SGCoin</span>

                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 border border-white/10 text-white text-xs p-3 rounded shadow-xl opacity-0 group-hover:opacity-100 transition pointer-events-none z-10 backdrop-blur-md">
                                        Rewards are credited to your wallet after order fulfillment.
                                    </div>
                                </div>

                                {/* Donation Impact - Priority 1 */}
                                <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                                    <Heart className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-xs text-purple-200 leading-relaxed font-medium">
                                        This order contributes one clothing item to a local shelter this month.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <FloatingHelpButton />
        </div >
    );
};

export default Checkout;
