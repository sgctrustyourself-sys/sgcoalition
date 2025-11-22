import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Loader, Wallet, Copy, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

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
    const { cart, cartTotal, calculateReward, clearCart, addOrder, generateOrderNumber } = useApp();
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

            const order = {
                id: `order_${Date.now()}`,
                orderNumber,
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
                status: 'pending' as any,
                stripeSessionId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
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
            alert('Failed to create order. Please try again.');
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
                                    <input name="name" placeholder="Full Name" value={shippingInfo.name} onChange={handleInputChange} className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition" required />
                                    <input name="address1" placeholder="Address Line 1" value={shippingInfo.address1} onChange={handleInputChange} className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition" required />
                                    <input name="city" placeholder="City" value={shippingInfo.city} onChange={handleInputChange} className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition" required />
                                    <input name="state" placeholder="State/Province" value={shippingInfo.state} onChange={handleInputChange} className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition" required />
                                    <input name="zip" placeholder="ZIP / Postal Code" value={shippingInfo.zip} onChange={handleInputChange} className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition" required />
                                    <input name="country" placeholder="Country" value={shippingInfo.country} onChange={handleInputChange} className="bg-black/30 border border-white/10 p-3 rounded-lg w-full text-white placeholder-gray-500 focus:border-white/30 focus:outline-none transition" required />
                                </div>
                            </div>

                            {/* Shipping Method */}
                            <div>
                                <h3 className="font-bold mb-2 text-white uppercase text-sm tracking-wide">Shipping Method</h3>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <label className="flex items-center cursor-pointer p-3 rounded-lg border border-white/10 hover:bg-white/5 transition flex-1">
                                        <input type="radio" name="shipping" value="standard" checked={shippingMethod === 'standard'} onChange={() => setShippingMethod('standard')} className="mr-3 accent-white" />
                                        <span className="text-white text-sm">Standard (Free, 4‑7 days)</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer p-3 rounded-lg border border-white/10 hover:bg-white/5 transition flex-1">
                                        <input type="radio" name="shipping" value="express" checked={shippingMethod === 'express'} onChange={() => setShippingMethod('express')} className="mr-3 accent-white" />
                                        <span className="text-white text-sm">Express (+$10, 1‑3 days)</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Payment Method Selection */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                            <h2 className="font-display text-xl font-bold uppercase mb-4 text-white">Payment Method</h2>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <button onClick={() => setPaymentMethod('card')} className={`p-4 border-2 rounded-lg transition ${paymentMethod === 'card' ? 'border-white bg-white/10 text-white' : 'border-white/20 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                                    <CreditCard className="w-6 h-6 mx-auto mb-2" />
                                    <p className="font-bold text-sm">Credit/Debit Card</p>
                                </button>
                                <button onClick={() => setPaymentMethod('crypto')} className={`p-4 border-2 rounded-lg transition ${paymentMethod === 'crypto' ? 'border-white bg-white/10 text-white' : 'border-white/20 text-gray-400 hover:border-white/30 hover:text-white'}`}>
                                    <Wallet className="w-6 h-6 mx-auto mb-2" />
                                    <p className="font-bold text-sm">Crypto Payment</p>
                                </button>
                            </div>

                            {/* Card Payment Section */}
                            {paymentMethod === 'card' && (
                                <>
                                    {clientSecret ? (
                                        <Elements stripe={stripePromise} options={{ clientSecret }}>
                                            <PaymentForm
                                                total={total}
                                                shippingInfo={shippingInfo}
                                                shippingMethod={shippingMethod}
                                                shippingCost={shippingCost}
                                                validateShipping={validateShipping}
                                                onSuccess={() => createOrder('stripe', clientSecret)}
                                            />
                                        </Elements>
                                    ) : (
                                        <div className="text-center py-8 border-t border-white/10 mt-4">
                                            {isLoading ? (
                                                <>
                                                    <Loader className="w-8 h-8 animate-spin mx-auto text-white" />
                                                    <p className="text-sm text-gray-400 mt-2">Initializing secure payment...</p>
                                                </>
                                            ) : (
                                                <div className="text-red-400">
                                                    <p className="mb-2">Unable to load payment system.</p>
                                                    {error && <p className="text-xs text-gray-400 mb-4">{error}</p>}
                                                    <button onClick={createPaymentIntent} className="text-sm underline hover:text-white">Retry</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Crypto Payment Section */}
                            {paymentMethod === 'crypto' && (
                                <div className="space-y-4">
                                    <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border-2 border-purple-500/30 rounded-lg p-6 backdrop-blur-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
                                                <Wallet className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-purple-300">Decentralized Payment</h3>
                                                <p className="text-sm text-purple-400">Send crypto directly to our wallet</p>
                                            </div>
                                        </div>
                                        <div className="bg-black/30 border border-white/10 rounded-lg p-4 mb-4">
                                            <p className="text-xs text-gray-400 mb-2 uppercase font-bold">Wallet Address</p>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 text-sm font-mono bg-black/50 p-2 rounded border border-white/10 break-all text-gray-300">{WALLET_ADDRESS}</code>
                                                <button onClick={copyAddress} className="p-2 hover:bg-white/10 rounded transition" title="Copy address">
                                                    {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-400" />}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="bg-purple-500/20 border border-purple-500/30 rounded-lg p-4 mb-4">
                                            <p className="text-sm text-purple-300 font-bold mb-2">Amount to Send:</p>
                                            <p className="text-2xl font-bold text-purple-200">${total.toFixed(2)} USD</p>
                                            <p className="text-xs text-purple-400 mt-1">(Equivalent in ETH, MATIC, or other supported crypto)</p>
                                        </div>
                                        <div className="text-sm text-purple-300 space-y-2">
                                            <p className="font-bold">Instructions:</p>
                                            <ol className="list-decimal list-inside space-y-1 text-purple-400">
                                                <li>Copy the wallet address above</li>
                                                <li>Send ${total.toFixed(2)} USD equivalent in crypto</li>
                                                <li>Click "I've Sent Payment" below</li>
                                                <li>We'll verify and process your order</li>
                                            </ol>
                                        </div>
                                    </div>
                                    <button onClick={handleCryptoConfirmation} className="w-full bg-purple-600 text-white py-4 rounded-lg font-bold uppercase tracking-widest hover:bg-purple-700 transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
                                        <Check className="w-5 h-5" /> I've Sent Payment
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right side: Order Total */}
                    <div className="lg:col-span-1">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 sticky top-24 backdrop-blur-sm">
                            <h2 className="font-display text-xl font-bold uppercase mb-4 text-white">Total</h2>
                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Subtotal</span>
                                    <span className="font-medium text-white">${total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Shipping</span>
                                    <span className="font-medium text-green-400">{shippingMethod === 'express' ? '+$10' : 'FREE'}</span>
                                </div>
                                <div className="flex justify-between text-sm pt-3 border-t border-white/10">
                                    <span className="text-gray-400">SGCoin Reward</span>
                                    <span className="font-bold text-brand-accent">+{reward.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-3 border-t border-white/10">
                                    <span className="text-white">Total</span>
                                    <span className="text-white">${(total + shippingCost).toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 text-center pt-4 border-t border-white/10">
                                <p>🔒 Secure Payment</p>
                                <p className="mt-1">Powered by Stripe</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
