import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Package, Hexagon, Home, Loader, Copy, Check, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getCartItemUnitPrice, getCartItemLineTotal, WALLET_KEYCHAIN_CLIP_LABEL } from '../utils/walletAddOns';
import { getReferralStats, generateReferralLink, type ReferralStats } from '../utils/referralSystem';
import { trackReferralShare } from '../utils/referralAnalytics';

// ---- Stripe redirect-return recovery ----------------------------------
// Stripe redirect methods (3D Secure card auth, Klarna, Afterpay) bounce the
// browser to /order/success?payment_intent=pi_... BEFORE Checkout's
// handleStripePaid can run, so the order must be completed HERE against the
// shared Order intake module (verify PI -> persist -> emails). The cart
// (localStorage, useCart) and the checkout form (sessionStorage,
// coalition_checkout_state) are restored so the module gets the full picture.
const CHECKOUT_STATE_KEY = 'coalition_checkout_state';

interface ReturnedCheckoutState {
    shippingInfo?: Record<string, string>;
    shippingMethod?: 'standard' | 'express';
    shippingCost?: number;
    orderSeed?: { orderId?: string; orderNumber?: string } | null;
}

const loadReturnedCheckoutState = (): ReturnedCheckoutState | null => {
    try {
        const raw = sessionStorage.getItem(CHECKOUT_STATE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
};

const OrderSuccess = () => {
    const [searchParams] = useSearchParams();
    const { cart, cartTotal, calculateReward, clearCart, user, updateUser } = useApp();
    const [orderDetails, setOrderDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [shippingInfo, setShippingInfo] = useState<any>(null);
    const [isMembershipSuccess, setIsMembershipSuccess] = useState(false);
    const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
    const [referralCopied, setReferralCopied] = useState(false);

    // Guard: complete the Stripe redirect-return order at most once per mount
    // even if the effect re-runs (e.g. `user` hydrates mid-flight).
    const stripeCompletionRef = useRef(false);

    const sessionId = searchParams.get('session_id');
    const type = searchParams.get('type');

    const paymentIntentId = searchParams.get('payment_intent');
    const paymentMethod = searchParams.get('payment_method');
    const txHash = searchParams.get('tx_hash');
    const shippingMethod = searchParams.get('shippingMethod') || 'standard';
    const shippingCost = parseFloat(searchParams.get('shippingCost') || '0');

    // True when the browser landed here directly from a Stripe redirect
    // (3DS / Klarna / Afterpay) — Checkout's onPaid handler never ran.
    const isStripeRedirectReturn = Boolean(paymentIntentId) && !paymentMethod && !txHash;

    const total = cartTotal();
    const reward = calculateReward(total);

    console.log('🎯 OrderSuccess: Search Params:', {
        paymentMethod,
        paymentIntentId,
        txHash,
        shippingMethod,
        shippingCost,
        sessionId,
        type
    });

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
                            window.location.href = '/profile';
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
            // Claim the redirect-return before the first await. React StrictMode
            // can run this effect twice while verifySubscription yields; setting
            // the guard only inside the later completion branch would allow two
            // /api/complete-order requests to race.
            if (isStripeRedirectReturn) {
                if (stripeCompletionRef.current) return;
                stripeCompletionRef.current = true;
            }

            // Check subscription first
            const isSub = await verifySubscription();
            if (isSub) return;

            const hasPaymentConfirmation = paymentIntentId || paymentMethod || txHash;

            if (!hasPaymentConfirmation) {
                // If we also failed subscription check, stop loading
                setIsLoading(false);
                return;
            }

            // Retrieve stored shipping info: legacy `shippingInfo` key (written
            // by Checkout's in-page flows) or the shared checkout state
            // (Stripe 3DS / Klarna / Afterpay redirect-returns land here with
            // only ?payment_intent= — the in-page handler never ran).
            const storedShipping = sessionStorage.getItem('shippingInfo');
            const returnedState = loadReturnedCheckoutState();
            let currentShippingInfo = shippingInfo;
            if (storedShipping) {
                currentShippingInfo = JSON.parse(storedShipping);
                setShippingInfo(currentShippingInfo);
                sessionStorage.removeItem('shippingInfo');
            } else if (returnedState?.shippingInfo) {
                currentShippingInfo = { ...shippingInfo, ...returnedState.shippingInfo };
                setShippingInfo(currentShippingInfo);
            }
            // Redirect-returns carry no shippingMethod/shippingCost in the URL,
            // so prefer the values Checkout persisted.
            const effectiveShippingMethod = returnedState?.shippingMethod || shippingMethod;
            const effectiveShippingCost =
                typeof returnedState?.shippingCost === 'number' ? returnedState.shippingCost : shippingCost;

            // Stripe redirect-return (3DS / Klarna / Afterpay): Checkout's
            // onPaid handler never ran, so complete the order server-side via
            // the shared Order intake module — it verifies the PaymentIntent,
            // persists the row (idempotent), and sends the confirmation emails.
            if (isStripeRedirectReturn) {
                const seed = returnedState?.orderSeed || null;
                try {
                    const orderPayload = {
                        id: seed?.orderId || `order_${Date.now()}`,
                        orderNumber: seed?.orderNumber || undefined,
                        userId: user?.uid,
                        isGuest: !user,
                        guestEmail: !user ? currentShippingInfo.email : undefined,
                        customerName: currentShippingInfo.name,
                        customerEmail: currentShippingInfo.email,
                        customerPhone: '',
                        items: cart.map(item => ({
                            productId: item.id,
                            productName: item.name,
                            productImage: item.images[0],
                            selectedSize: item.selectedSize || 'One Size',
                            quantity: item.quantity,
                            price: getCartItemUnitPrice(item),
                            total: getCartItemLineTotal(item),
                            keychainClipOn: Boolean(item.keychainClipOn),
                            addOnLabel: item.keychainClipOn ? WALLET_KEYCHAIN_CLIP_LABEL : undefined,
                        })),
                        subtotal: 0,
                        tax: 0,
                        discount: 0,
                        total,
                        paymentMethod: 'stripe',
                        paymentStatus: 'paid',
                        paymentReference: paymentIntentId,
                        orderType: 'online',
                        createdAt: new Date().toISOString(),
                        paidAt: new Date().toISOString(),
                        sgCoinReward: reward,
                        shippingAddress: {
                            address1: currentShippingInfo.address1,
                            city: currentShippingInfo.city,
                            state: currentShippingInfo.state,
                            zip: currentShippingInfo.zip,
                            country: currentShippingInfo.country,
                            shippingMethod: effectiveShippingMethod,
                            shippingCost: effectiveShippingCost,
                        },
                    };

                    // Klarna/Afterpay are async methods: the first redirect-
                    // return can be redirect_status=processing while the PI is
                    // still settling. verifyPayment (server-side) rejects a
                    // non-succeeded PI, so retry briefly before falling back.
                    let response: Response | null = null;
                    for (let attempt = 0; attempt < 5; attempt++) {
                        const r = await fetch('/api/complete-order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ order: orderPayload }),
                        });
                        if (r.ok || r.status === 409) { response = r; break; }
                        // 402 = payment not completed yet (processing) — wait
                        // and retry; anything else gives up immediately.
                        if (r.status !== 402) { response = r; break; }
                        await new Promise(res => setTimeout(res, 2000 * (attempt + 1)));
                    }

                    if (response && response.ok) {
                        const savedOrder = await response.json();
                        const displayOrder = {
                            id: savedOrder.order_number || savedOrder.id,
                            userId: savedOrder.user_id,
                            items: (savedOrder.items || []).map((i: any) => ({
                                id: i.productId,
                                name: i.productName || i.name,
                                price: i.price,
                                quantity: i.quantity,
                                size: i.selectedSize || i.size,
                                addOnLabel: i.addOnLabel,
                                image: i.productImage || i.image || '',
                            })),
                            total: Number(savedOrder.total || 0),
                            sgCoinReward: Number(savedOrder.sg_coin_reward || 0),
                            status: savedOrder.payment_status === 'pending' ? 'pending_verification' : 'paid',
                            paymentMethod: 'stripe',
                            paymentIntentId,
                            customerEmail: savedOrder.customer_email,
                            customerName: savedOrder.customer_name,
                            shippingStatus: 'processing',
                            trackingNumber: null,
                            createdAt: savedOrder.created_at,
                            paidAt: savedOrder.paid_at,
                            shippingInfo: savedOrder.shipping_address || currentShippingInfo,
                            shippingMethod: savedOrder.shipping_address?.shippingMethod || effectiveShippingMethod,
                            shippingCost: Number(savedOrder.shipping_address?.shippingCost || effectiveShippingCost),
                        };

                        setOrderDetails(displayOrder);
                        clearCart();
                        // Consume the persisted checkout state (Checkout's
                        // createOrder usually clears it, but the redirect-return
                        // never reaches that path).
                        try { sessionStorage.removeItem(CHECKOUT_STATE_KEY); } catch (e) { /* ignore */ }
                        // Award SGCoin reward (parity with the in-page flow).
                        if (user) {
                            await updateUser({
                                sgCoinBalance: (user.sgCoinBalance || 0) + Number(savedOrder.sg_coin_reward || 0),
                            });
                        }
                        // Referral CTA stats for the post-purchase share prompt.
                        if (user) {
                            getReferralStats(user.uid).then(stats => {
                                if (stats) setReferralStats(stats);
                            });
                        }
                        setIsLoading(false);
                        return;
                    }
                    // API declined (e.g. duplicate) — fall through to the local
                    // display build below.
                } catch (err) {
                    console.error('Stripe redirect-return order completion failed:', err);
                    // Fall through to the local display build below.
                }
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
                        price: getCartItemUnitPrice(item),
                        quantity: item.quantity,
                        size: item.selectedSize,
                        addOnLabel: item.keychainClipOn ? WALLET_KEYCHAIN_CLIP_LABEL : undefined,
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
                    trackingNumber: null as string | null,
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
                    await updateUser({ sgCoinBalance: (user.sgCoinBalance || 0) + reward });
                    console.log(`✅ Awarded ${reward} SGCoin to user ${user.uid}`);
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

                // Load referral stats for the post-purchase CTA (fire-and-forget)
                if (user) {
                    getReferralStats(user.uid).then(stats => {
                        if (stats) setReferralStats(stats);
                    });
                }

                setOrderDetails(order);
                clearCart();
                // Consume persisted checkout state on the fallback path too
                // (the Stripe redirect-return branch may have fallen through).
                try { sessionStorage.removeItem(CHECKOUT_STATE_KEY); } catch (e) { /* ignore */ }
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
                                    <img src={item.image || item.productImage} alt={item.name || item.productName} className="w-16 h-16 object-cover rounded bg-gray-100" />
                                    <div className="flex-1">
                                        <p className="font-medium text-sm">{item.name || item.productName}</p>
                                        <p className="text-xs text-gray-500">
                                            Size: {item.size || item.selectedSize}
                                            {item.addOnLabel ? ` • ${item.addOnLabel}` : ''}
                                            {' • '}Qty: {item.quantity}
                                        </p>
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

                    {/* Referral CTA — post-purchase is the highest-converting window */}
                    {referralStats ? (
                        <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-xl p-6 mb-6 text-left">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-purple-300" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white uppercase tracking-wide text-sm">Share the Coalition</h3>
                                    <p className="text-xs text-gray-400">Earn commission on every referral sale</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                                <code className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm tracking-wider">
                                    {referralStats.referral_code}
                                </code>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(
                                            generateReferralLink(referralStats.referral_code)
                                        );
                                        void trackReferralShare(referralStats.referral_code, 'order_success');
                                        setReferralCopied(true);
                                        setTimeout(() => setReferralCopied(false), 2000);
                                    }}
                                    className="px-4 py-3 bg-purple-500/20 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition text-purple-200"
                                    title="Copy referral link"
                                >
                                    {referralCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400">
                                Share your code or link — friends enter it at checkout and you earn a commission.
                            </p>
                        </div>
                    ) : !user ? (
                        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-6 mb-6 text-left">
                            <div className="flex items-center gap-3 mb-2">
                                <Users className="w-5 h-5 text-gray-400" />
                                <h3 className="font-bold text-gray-300 uppercase tracking-wide text-sm">Earn commissions</h3>
                            </div>
                            <p className="text-sm text-gray-400 mb-4">
                                Refer a friend and earn up to 40% on every sale. Create an account to get your referral code.
                            </p>
                            <Link
                                to="/signup"
                                className="inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition"
                            >
                                Create Account
                            </Link>
                        </div>
                    ) : null}

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
