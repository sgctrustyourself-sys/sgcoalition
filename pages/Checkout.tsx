import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Loader, Wallet, Copy, Check, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import FloatingHelpButton from '../components/FloatingHelpButton';
import { calculateCartDiscount, isSGCoinDiscountEnabled, getDiscountPercentageText } from '../utils/pricing';

// Load Stripe with publishable key
const stripePromise = loadStripe(
    (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY || ''
);

// Payment Form Component (Inner)
interface PaymentFormProps {
    total: number;
    shippingInfo: any;
    shippingMethod: string;
    shippingCost: number;
    validateShipping: () => boolean;
    onSuccess: () => Promise<string>;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ total, shippingInfo, shippingMethod, shippingCost, validateShipping, onSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateShipping()) {
            return; // Validation error handled by parent or we can trigger shake here
        }

        if (!stripe || !elements) return;

        setIsProcessing(true);
        setError(null);

        // Store shipping info temporarily for the success page
        sessionStorage.setItem('shippingInfo', JSON.stringify(shippingInfo));

        const { error: submitError } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/#/order/success?shippingMethod=${shippingMethod}&shippingCost=${shippingCost}`,
                payment_method_data: {
                    billing_details: {
                        email: shippingInfo.email,
                        name: shippingInfo.name,
                        address: {
                            line1: shippingInfo.address1,
                            city: shippingInfo.city,
                            state: shippingInfo.state,
                            postal_code: shippingInfo.zip,
                            country: shippingInfo.country,
                        },
                    },
                },
            },
            redirect: 'if_required',
        });

        if (submitError) {
            setError(submitError.message || 'Payment failed');
            setIsProcessing(false);
        } else {
            // Payment successful - create order
            try {
                const orderNumber = await onSuccess();
                sessionStorage.setItem('orderNumber', orderNumber);
                window.location.href = `${window.location.origin}/#/order/success?payment_method=card&shippingMethod=${shippingMethod}&shippingCost=${shippingCost}`;
            } catch (error) {
                setError('Payment succeeded but order creation failed. Please contact support.');
                setIsProcessing(false);
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 mt-6 border-t pt-6">
            <h3 className="font-bold mb-4">Payment Details</h3>
            <PaymentElement />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
                disabled={isProcessing || !stripe}
                className="w-full bg-black text-white py-3 rounded font-bold uppercase tracking-widest hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isProcessing ? 'Processing...' : `Pay $${(total + shippingCost).toFixed(2)}`}
            </button>
        </form>
    );
};

const Checkout: React.FC = () => {
    const navigate = useNavigate();
    const { cart, cartTotal, calculateReward, clearCart, addOrder, generateOrderNumber, user } = useApp();
    const { addToast } = useToast();
    const [clientSecret, setClientSecret] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'crypto'>('card');
    const [copied, setCopied] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

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
    const shippingCost = shippingMethod === 'express' ? 10 : 0;
    const total = cartTotal();
    const reward = calculateReward(total);

    // Calculate SGCoin discount if crypto payment is selected
    const discountEnabled = isSGCoinDiscountEnabled();
    const discount = (paymentMethod === 'crypto' && discountEnabled) ? calculateCartDiscount(total) : 0;
    const finalTotal = total - discount + shippingCost;

    const WALLET_ADDRESS = '0x0F4A0466C2a1d3FA6Ed55a20994617F0533fbf74';

    useEffect(() => {
        if (cart.length > 0 && paymentMethod === 'card') {
            createPaymentIntent();
        }
    }, [cart, paymentMethod]);

    const createPaymentIntent = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: total }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Network error' }));
                throw new Error(err.error || 'Failed to create payment intent');
            }
            const { clientSecret } = await response.json();
            setClientSecret(clientSecret);
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
            const tax = 0; // Add tax calculation if needed
            const discount = 0; // Add discount calculation if needed
            const isGuest = !user; // User is guest if not logged in

            const order = {
                id: `order_${Date.now()}`,
                orderNumber,
                userId: user?.uid, // Optional for guest orders
                isGuest, // Mark as guest order
                guestEmail: isGuest ? shippingInfo.email : undefined, // Store email for guest orders
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
                discount,
                total: subtotal + tax - discount + shippingCost,
                paymentMethod: paymentMethodUsed as any,
                paymentStatus: paymentMethodUsed === 'crypto' ? 'pending' as const : 'paid' as const,
                orderType: 'online' as const,
                createdAt: new Date().toISOString(),
                paidAt: paymentMethodUsed !== 'crypto' ? new Date().toISOString() : undefined,
                shippingAddress: {
                    address1: shippingInfo.address1,
                    city: shippingInfo.city,
                    state: shippingInfo.state,
                    zip: shippingInfo.zip,
                    country: shippingInfo.country
                }
            };

            await addOrder(order);
            clearCart();
            return orderNumber;
        } catch (error) {
            console.error('Error creating order:', error);
            throw error;
        }
    };

    const handleCryptoConfirmation = async () => {
        if (!validateShipping()) return;
        try {
            const orderNumber = await createOrder('crypto');
            sessionStorage.setItem('shippingInfo', JSON.stringify(shippingInfo));
            sessionStorage.setItem('orderNumber', orderNumber);
            navigate('/order/success?payment_method=crypto');
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

                        {/* Contact & Shipping Form - ALWAYS VISIBLE */}
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
                                    <input
                                        name="zip"
                                        type="text"
                                        placeholder="ZIP / Postal Code"
                                        value={shippingInfo.zip}
                                        onChange={handleInputChange}
                                        className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition"
                                        required
                                    />
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
                                        <span>Free</span>
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
                        </div>

                        {/* Payment Method Selection */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                            <h3 className="font-bold mb-4 text-white uppercase text-sm tracking-wide">Payment Method</h3>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <button
                                    onClick={() => setPaymentMethod('card')}
                                    className={`flex flex-col items-center justify-center p-4 rounded-lg border transition ${paymentMethod === 'card' ? 'bg-white text-black border-white' : 'border-white/20 hover:border-white text-gray-400 hover:text-white'}`}
                                >
                                    <CreditCard className="w-6 h-6 mb-2" />
                                    <span className="font-bold text-sm">Credit Card</span>
                                </button>
                                <button
                                    onClick={() => setPaymentMethod('crypto')}
                                    className={`flex flex-col items-center justify-center p-4 rounded-lg border transition ${paymentMethod === 'crypto' ? 'bg-white text-black border-white' : 'border-white/20 hover:border-white text-gray-400 hover:text-white'}`}
                                >
                                    <Wallet className="w-6 h-6 mb-2" />
                                    <span className="font-bold text-sm">Crypto (USDC)</span>
                                </button>
                            </div>

                            {/* Card Payment */}
                            {paymentMethod === 'card' && clientSecret && (
                                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night', labels: 'floating' } }}>
                                    <PaymentForm
                                        total={finalTotal}
                                        shippingInfo={shippingInfo}
                                        shippingMethod={shippingMethod}
                                        shippingCost={shippingCost}
                                        validateShipping={validateShipping}
                                        onSuccess={() => createOrder('card')}
                                    />
                                </Elements>
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
                                <div className="flex justify-between text-white font-bold text-lg pt-3 border-t border-white/10">
                                    <span>Total</span>
                                    <span>${finalTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-brand-accent text-xs pt-2">
                                    <span>Estimated Rewards</span>
                                    <span>+{reward} SGCoin</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <FloatingHelpButton />
        </div>
    );
};

export default Checkout;
