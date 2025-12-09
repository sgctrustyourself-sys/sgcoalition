import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Package, Hexagon, Home, Loader } from 'lucide-react';
import { useApp } from '../context/AppContext';

const OrderSuccess = () => {
    const [searchParams] = useSearchParams();
    const { cart, cartTotal, calculateReward, clearCart, user, updateUser } = useApp();
    const [orderDetails, setOrderDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [shippingInfo, setShippingInfo] = useState<any>(null);
    const [isMembershipSuccess, setIsMembershipSuccess] = useState(false);

    const sessionId = searchParams.get('session_id');
    const type = searchParams.get('type');

    const paymentIntentId = searchParams.get('payment_intent');
    const paymentMethod = searchParams.get('payment_method');
    const txHash = searchParams.get('tx_hash');
    const shippingMethod = searchParams.get('shippingMethod') || 'standard';
    const shippingCost = parseFloat(searchParams.get('shippingCost') || '0');

    const total = cartTotal();
    const reward = calculateReward(total);

    useEffect(() => {
        const verifySubscription = async () => {
            if (sessionId && type === 'membership') {
                try {
                    const response = await fetch('/api/verify-subscription', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionId }),
                    });
                    if (response.ok) {
                        setIsMembershipSuccess(true);
                        setIsLoading(false);
                        // Redirect to profile after short delay
                        setTimeout(() => {
                            window.location.href = '/#/profile';
                        }, 3000);
                        return true;
                    }
                } catch (e) {
                    console.error('Subscription verification failed:', e);
                }
                return false;
            }
            return false;
        };

        const processOrder = async () => {
            // Check subscription first
            const isSub = await verifySubscription();
            if (isSub) return;

            const hasPaymentConfirmation = paymentIntentId || paymentMethod || txHash;

            if (!hasPaymentConfirmation) {
                // If we also failed subscription check, stop loading
                setIsLoading(false);
                return;
            }

            // Retrieve stored shipping info if any
            const storedShipping = sessionStorage.getItem('shippingInfo');
            let currentShippingInfo = shippingInfo;
            if (storedShipping) {
                currentShippingInfo = JSON.parse(storedShipping);
                setShippingInfo(currentShippingInfo);
                sessionStorage.removeItem('shippingInfo');
            }

            // If cart is empty, try to load pending order from sessionStorage
            if (cart.length === 0) {
                const pendingOrder = sessionStorage.getItem('pendingOrder');
                if (pendingOrder) {
                    const order = JSON.parse(pendingOrder);
                    setOrderDetails(order);
                    sessionStorage.removeItem('pendingOrder');
                }
                setIsLoading(false);
                return;
            }

            try {
                const order = {
                    id: `ORD-${Date.now()}`,
                    userId: user?.uid,
                    items: cart.map(item => ({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                        size: item.selectedSize,
                        image: item.images[0],
                    })),
                    total,
                    sgCoinReward: reward,
                    status: paymentMethod === 'crypto' ? 'pending_verification' : 'paid',
                    paymentMethod: paymentMethod || 'card',
                    paymentIntentId,
                    txHash,
                    // STRICT EMAIL POLICY: Use ONLY the email collected during checkout
                    customerEmail: currentShippingInfo?.email || '',
                    customerName: currentShippingInfo?.name || '',
                    shippingStatus: 'processing',
                    trackingNumber: null,
                    createdAt: new Date().toISOString(),
                    paidAt: new Date().toISOString(),
                    shippingInfo: currentShippingInfo || {},
                    shippingMethod,
                    shippingCost,
                };

                // Save order to localStorage
                const orders = JSON.parse(localStorage.getItem('orders') || '[]');
                orders.push(order);
                localStorage.setItem('orders', JSON.stringify(orders));

                // Award SGCoin reward
                if (user) {
                    updateUser({ sgCoinBalance: user.sgCoinBalance + reward });
                }

                // Send order confirmation email
                const emailToSend = order.customerEmail;
                if (emailToSend) {
                    try {
                        await fetch('/api/send-order-confirmation', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ order }),
                        });
                    } catch (err) {
                        console.error('Email send error:', err);
                    }
                } else {
                    console.warn('No customer email found, skipping confirmation email.');
                }

                setOrderDetails(order);
                clearCart();
            } catch (error) {
                console.error('Order processing error:', error);
            } finally {
                setIsLoading(false);
            }
        };

        processOrder();
    }, [paymentIntentId, paymentMethod, txHash, cart, user, reward, shippingMethod, shippingCost, sessionId, type]);

    if (isLoading) {
        return (
            <div className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center">
                <div className="text-center">
                    <Loader className="w-12 h-12 animate-spin mx-auto text-brand-accent mb-4" />
                    <p className="text-gray-600">Processing...</p>
                </div>
            </div>
        );
    }

    if (isMembershipSuccess) {
        return (
            <div className="min-h-screen pt-24 pb-16 px-4 bg-black text-white">
                <div className="max-w-2xl mx-auto text-center py-20">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-purple-600/20 rounded-full mb-6 border border-purple-500">
                        <CheckCircle className="w-12 h-12 text-purple-400" />
                    </div>
                    <h1 className="font-display text-4xl md:text-5xl font-bold uppercase mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-white">
                        Welcome to VIP
                    </h1>
                    <p className="text-xl text-gray-400 mb-8">
                        Your membership is active. Your $15 store credit has been applied.
                    </p>
                    <Link to="/profile" className="inline-flex items-center gap-2 bg-white text-black px-10 py-4 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-200 transition">
                        View Profile
                    </Link>
                </div>
            </div>
        );
    }

    if (!orderDetails) {
        return (
            <div className="min-h-screen pt-24 pb-16 px-4">
                <div className="max-w-2xl mx-auto text-center py-20">
                    <h1 className="font-display text-3xl font-bold mb-4">No Order Found</h1>
                    <p className="text-gray-600 mb-8">We couldn't find your order details.</p>
                    <Link to="/" className="inline-flex items-center gap-2 bg-black text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition">
                        <Home className="w-5 h-5" />
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 bg-gradient-to-b from-green-50 to-white">
            <div className="max-w-2xl mx-auto text-center">
                {/* Success Icon */}
                <div className="mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500 rounded-full mb-4">
                        <CheckCircle className="w-12 h-12 text-white" />
                    </div>
                    <h1 className="font-display text-4xl md:text-5xl font-bold uppercase mb-2">Order Confirmed!</h1>
                    <p className="text-xl text-gray-600">Thank you for your purchase</p>
                    {orderDetails.customerEmail && (
                        <p className="text-sm text-gray-500 mt-2">A confirmation email has been sent to <strong>{orderDetails.customerEmail}</strong></p>
                    )}
                </div>

                {/* Order Details */}
                <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="text-left">
                            <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Order Number</p>
                            <p className="font-mono text-sm font-bold">{orderDetails.id}</p>
                        </div>
                        <div className="text-left md:text-right">
                            <p className="text-sm text-gray-500 uppercase tracking-wide mb-1">Order Total</p>
                            <p className="text-2xl font-bold">${orderDetails.total.toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Shipping Info */}
                    {orderDetails.shippingInfo && (
                        <div className="mb-6 text-left bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-display text-lg font-bold mb-2">Shipping Information</h3>
                            <p className="text-sm text-gray-700"><strong>Name:</strong> {orderDetails.shippingInfo.name}</p>
                            <p className="text-sm text-gray-700"><strong>Email:</strong> {orderDetails.shippingInfo.email}</p>
                            <p className="text-sm text-gray-700"><strong>Address:</strong> {orderDetails.shippingInfo.address1}, {orderDetails.shippingInfo.city}, {orderDetails.shippingInfo.state} {orderDetails.shippingInfo.zip}, {orderDetails.shippingInfo.country}</p>
                            <p className="text-sm text-gray-700"><strong>Method:</strong> {orderDetails.shippingMethod === 'express' ? 'Express (+$10)' : 'Standard (Free)'} ({orderDetails.shippingCost > 0 ? `$${orderDetails.shippingCost}` : 'FREE'})</p>
                        </div>
                    )}

                    {/* Order Items */}
                    <div className="mb-6 pb-6 border-b border-gray-200">
                        <h3 className="font-display text-lg font-bold mb-3 text-left">Order Items</h3>
                        <div className="space-y-3">
                            {orderDetails.items.map((item: any, index: number) => (
                                <div key={index} className="flex items-center gap-3 text-left">
                                    <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded bg-gray-100" />
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">{item.name}</p>
                                        <p className="text-xs text-gray-500">Size: {item.size} • Qty: {item.quantity}</p>
                                    </div>
                                    <p className="font-bold">${item.price}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SGCoin Reward */}
                    {orderDetails.sgCoinReward > 0 && (
                        <div className="bg-gradient-to-r from-brand-accent/10 to-purple-100 rounded-lg p-6 mb-6">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <Hexagon className="w-8 h-8 text-brand-accent fill-current" />
                                <div className="text-left">
                                    <p className="text-sm text-gray-600">SGCoin Reward Earned</p>
                                    <p className="text-3xl font-bold text-brand-accent">+{orderDetails.sgCoinReward.toLocaleString()}</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">Rewards will be credited to your wallet shortly.</p>
                        </div>
                    )}

                    <div className="flex justify-center">
                        <Link to="/" className="inline-flex items-center gap-2 bg-black text-white px-8 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition">
                            <Home className="w-5 h-5" />
                            Return Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderSuccess;
