import React, { useState, useEffect, useMemo, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Loader, Wallet, Copy, Check, Sparkles, Heart, Info, ShieldCheck, Truck, RefreshCw, Mail, Headphones, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../services/supabase';
import { OrderStatus } from '../types';
import { useToast } from '../context/ToastContext';
import FloatingHelpButton from '../components/FloatingHelpButton';
import { isSGCoinDiscountEnabled, getDiscountPercentageText } from '../utils/pricing';
import { resolveCryptoDiscountCents } from '../utils/cryptoDiscount';
import { trackReferralEvent } from '../utils/referralAnalytics';
import { processReferralOnPurchase, clearReferralCode } from '../utils/referralSystem';
import { validateCouponCode, validateDiscountCoupon, applyCouponCode, getAppliedCouponCode } from '../utils/couponSystem';
import { getCartItemAddOnPrice, getCartItemLineTotal, getCartItemUnitPrice, WALLET_KEYCHAIN_CLIP_LABEL } from '../utils/walletAddOns';

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

type OrderSeed = {
    orderId: string;
    orderNumber: string;
};

const SUPPORT_EMAIL = 'sgctrustyourself@gmail.com';

// ---- Redirect-return state -------------------------------------------
// The Stripe 3DS/Klarna/Afterpay flow can bounce the browser out of
// /checkout and back with a full page reload. The cart survives via
// localStorage (useCart); the shipping form + order seed survive via this
// sessionStorage key so the returned page can resume the exact checkout.
const CHECKOUT_STATE_KEY = 'coalition_checkout_state';

interface SavedCheckoutState {
    shippingInfo?: typeof DEFAULT_SHIPPING_INFO;
    shippingMethod?: 'standard' | 'express';
    shippingCost?: number;
    paymentMethod?: 'crypto' | 'cashapp' | 'card';
    // Which Stripe method the 'card' path shows: card-only (primary) or
    // Klarna (secondary 'More payment options'). Persisted so a Klarna
    // redirect-return can restore the exact checkout in progress.
    stripeMethod?: 'card' | 'klarna';
    // Payment-agnostic order seed (orderId/orderNumber). Used by the
    // Stripe 3DS/Klarna/Afterpay redirect-return so the created order keeps
    // a stable identity.
    orderSeed?: OrderSeed | null;
    // Amount of store credit the Stripe intent actually applied (dollars).
    // Persisted so the 3DS/Klarna/Afterpay redirect-return can forward it to
    // /api/complete-order and the order's re-pricing matches the charged PI.
    storeCreditApplied?: number;
    // Discount coupon sent to the server pricing path (referral codes are
    // attribution-only and must NOT reach the coupon validation).
    couponCode?: string | null;
}

const DEFAULT_SHIPPING_INFO = {
    email: '', name: '', address1: '', city: '', state: '', zip: '', country: '',
};

const loadCheckoutState = (): SavedCheckoutState | null => {
    try {
        const raw = sessionStorage.getItem(CHECKOUT_STATE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
};

const saveCheckoutState = (state: SavedCheckoutState) => {
    try { sessionStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
};

const clearCheckoutState = () => {
    try { sessionStorage.removeItem(CHECKOUT_STATE_KEY); } catch (e) { /* ignore */ }
};

// ---- Stripe (card / Klarna / Afterpay) -------------------------------
// Stripe.js is loaded lazily only when the buyer picks the card/BNPL
// method — no third-party script on page load, no Cookiebot interplay.
// VITE_STRIPE_PUBLISHABLE_KEY is already documented in README/.env.example.
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
    if (!STRIPE_PUBLISHABLE_KEY) return null;
    if (!stripePromise) stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
    return stripePromise;
}

// The shipping form's country field is free text (and the ZIP autofill
// writes "United States"), but Stripe wants a 2-letter ISO-3166 code.
// Map the common full names; pass through anything already 2-letter.
const COUNTRY_CODE_OVERRIDES: Record<string, string> = {
    'united states': 'US', 'usa': 'US', 'u.s.': 'US', 'u.s.a': 'US', 'america': 'US',
    'canada': 'CA',
    'united kingdom': 'GB', 'uk': 'GB', 'gb': 'GB', 'great britain': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB', 'northern ireland': 'GB',
    'australia': 'AU',
    'new zealand': 'NZ', 'nz': 'NZ',
    'germany': 'DE', 'deutschland': 'DE',
    'france': 'FR',
    'netherlands': 'NL', 'holland': 'NL',
    'sweden': 'SE',
    'austria': 'AT',
    'belgium': 'BE',
    'denmark': 'DK',
    'finland': 'FI',
    'ireland': 'IE',
    'italy': 'IT',
    'norway': 'NO',
    'poland': 'PL',
    'portugal': 'PT',
    'spain': 'ES',
    'switzerland': 'CH',
    'greece': 'GR',
    'czechia': 'CZ', 'czech republic': 'CZ',
    'romania': 'RO',
};
function normalizeCountryCode(raw: string): string | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
    const lookup = trimmed.toLowerCase();
    return COUNTRY_CODE_OVERRIDES[lookup];
}

// Dark theme that matches the checkout surface (black / white / violet).
const STRIPE_APPEARANCE = {
    theme: 'night' as const,
    variables: {
        colorPrimary: '#a78bfa',
        colorBackground: '#0a0a0a',
        colorText: '#e5e5e5',
        colorTextSecondary: '#9ca3af',
        colorDanger: '#f87171',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '8px',
    },
};

interface StripePaymentSectionProps {
    email: string;
    total: number;
    onPaid: (paymentIntentId: string) => Promise<void>;
    onValidationRequired: () => boolean;
}

// Must live inside <Elements>: useStripe/useElements are only available
// below the provider. The Payment Element shows every method Stripe
// considers eligible for this buyer + order — card always, plus Klarna
// and Afterpay when they are enabled in the Stripe dashboard and the
// order/region qualifies (Afterpay is domestic-only; Klarna spans US/EU).
const StripePaymentSection: React.FC<StripePaymentSectionProps> = ({ email, total, onPaid, onValidationRequired }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [sectionError, setSectionError] = useState<string | null>(null);
    // The PaymentElement mounts asynchronously after the Elements provider
    // re-renders (e.g. after a shipping-edit triggers a fresh PaymentIntent
    // with a new clientSecret). Until onReady fires, `elements` has no mounted
    // element and stripe.confirmPayment({ elements }) throws
    // "elements should have a mounted Payment Element". Gate the Pay button
    // on onReady so a click in that window is impossible.
    const [elementReady, setElementReady] = useState(false);
    // If the element never mounts (bad clientSecret, network failure), the
    // onReady gate would otherwise leave Pay silently disabled forever —
    // surface the failure so the buyer isn't stranded.
    const [elementLoadFailed, setElementLoadFailed] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements || !elementReady) return;
        if (!onValidationRequired()) return;
        setProcessing(true);
        setSectionError(null);
        try {
            const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: 'if_required',
                confirmParams: {
                    return_url: `${window.location.origin}/#/order/success`,
                    ...(email ? { receipt_email: email } : {}),
                },
            });

            if (confirmError) {
                setSectionError(confirmError.message || 'Payment failed. Please try again.');
                return;
            }

            if (paymentIntent?.status === 'succeeded') {
                await onPaid(paymentIntent.id);
            } else {
                setSectionError('Payment is still processing. Check your email for confirmation or contact support.');
            }
        } catch (err: any) {
            console.error('Stripe confirm error:', err);
            setSectionError(err.message || 'Payment failed. Please try again.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement
                id="payment-element"
                options={{ layout: 'tabs' }}
                onReady={() => setElementReady(true)}
                onLoadError={() => { setElementLoadFailed(true); setSectionError('Payment options failed to load. Please refresh and try again.'); }}
            />
            {sectionError && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg text-red-400 text-sm">
                    {sectionError}
                </div>
            )}
            <button
                type="submit"
                disabled={!stripe || !elementReady || processing || elementLoadFailed}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:from-purple-700 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
            >
                {processing ? (
                    <div className="flex items-center justify-center gap-2">
                        <Loader className="w-5 h-5 animate-spin" />
                        Processing payment...
                    </div>
                ) : (
                    `Pay $${total.toFixed(2)}`
                )}
            </button>
        </form>
    );
};

const Checkout: React.FC = () => {
    const navigate = useNavigate();
    const { cart, cartTotal, calculateReward, clearCart, addOrder, generateOrderNumber, user, deductInventory } = useApp();
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Restore form state from sessionStorage when the Stripe 3DS/Klarna
    // redirect bounces the browser back through /checkout (full page
    // reload). Fall back to defaults for a fresh checkout.
    const [paymentMethod, setPaymentMethod] = useState<'crypto' | 'cashapp' | 'card'>(() =>
        // Card is the default; falls back to the first enabled option below.
        loadCheckoutState()?.paymentMethod || 'card');
    const [stripeMethod, setStripeMethod] = useState<'card' | 'klarna'>(() =>
        loadCheckoutState()?.stripeMethod || 'card');
    // Secondary 'More payment options' disclosure (Cash App, Crypto).
    const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

    // Owner-controlled payment option visibility (admin Command Center
    // toggles, PATCH /api/payment-settings). The checkout hides any option
    // the owner disabled. A failed/unreachable fetch defaults to everything
    // enabled so a settings outage never locks checkout.
    const [paymentSettings, setPaymentSettings] = useState({
        card: true, klarna: false, cashapp: true, crypto: true,
    });
    const [paymentSettingsLoaded, setPaymentSettingsLoaded] = useState(false);

    useEffect(() => {
        let mounted = true;
        fetch('/api/payment-settings', { method: 'GET' })
            .then(r => r.json().catch(() => ({})))
            .then((data: any) => {
                if (!mounted) return;
                if (data && typeof data === 'object' && data.card_enabled !== undefined) {
                    setPaymentSettings({
                        card: !!data.card_enabled,
                        klarna: !!data.klarna_enabled,
                        cashapp: !!data.cashapp_enabled,
                        crypto: !!data.crypto_enabled,
                    });
                }
                setPaymentSettingsLoaded(true);
            })
            .catch(() => { if (mounted) setPaymentSettingsLoaded(true); });
        return () => { mounted = false; };
    }, []);

    // If the owner just turned off the currently selected option, fall back
    // to the first still-enabled one (card -> cashapp -> crypto — the
    // working primary paths; klarna only when re-enabled).
    useEffect(() => {
        if (!paymentSettingsLoaded) return;
        const selectedEnabled = paymentMethod === 'card'
            ? (stripeMethod === 'klarna' ? paymentSettings.klarna : paymentSettings.card)
            : paymentMethod === 'cashapp' ? paymentSettings.cashapp
            : paymentSettings.crypto;
        if (selectedEnabled) return;
        if (paymentSettings.card) { setPaymentMethod('card'); setStripeMethod('card'); }
        else if (paymentSettings.cashapp) setPaymentMethod('cashapp');
        else if (paymentSettings.crypto) setPaymentMethod('crypto');
        else if (paymentSettings.klarna) { setPaymentMethod('card'); setStripeMethod('klarna'); }
    }, [paymentSettingsLoaded, paymentSettings, paymentMethod, stripeMethod]);

    const [copied, setCopied] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [clientSecret, setClientSecret] = useState<string>('');
    const [serverPricing, setServerPricing] = useState<{ totalCents: number; itemTotalCents: number; shippingCents: number; discountCents: number } | null>(null);

    // Server-authoritative pricing preview for the order summary.
    // Fetched from /api/pricing-preview whenever the cart, shipping, or
    // payment method changes. Shows the real set bonus, crypto discount,
    // and final total before the customer pays.
    const [pricingPreview, setPricingPreview] = useState<{
        itemTotalCents: number; shippingCents: number;
        setBonusCents: number; cryptoDiscountCents: number;
        couponDiscountCents: number; couponCode: string | null;
        discountCents: number; totalCents: number;
    } | null>(null);

    const stripePromise = useMemo(() => getStripePromise(), []);

    // The order seed that backs the current Stripe PaymentIntent — created
    // once per intent so the webhook's order_id metadata stays anchored.
    const stripeOrderSeedRef = useRef<OrderSeed | null>(null);

    // Coupon code state — a code can be either a referral (attribution, no
    // discount) or an admin-created discount coupon from the `coupons` table.
    // Only discount coupons are sent to the server as couponCode (the server
    // pricing authority would reject a referral code as an unknown coupon).
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
    const [couponReferrerName, setCouponReferrerName] = useState<string | null>(null);
    const [couponError, setCouponError] = useState<string | null>(null);
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
    const [isDiscountCoupon, setIsDiscountCoupon] = useState(false);
    const [couponDiscountLabel, setCouponDiscountLabel] = useState<string | null>(null);
    const [isValidatingZip, setIsValidatingZip] = useState(false);

    // Shipping information state - Lifted up. Lazy-initialized from
    // sessionStorage so a Stripe 3DS/Klarna redirect-return keeps the form.
    const [shippingInfo, setShippingInfo] = useState(() => {
        const saved = loadCheckoutState()?.shippingInfo;
        return saved ? { ...DEFAULT_SHIPPING_INFO, ...saved } : DEFAULT_SHIPPING_INFO;
    });

    const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>(() =>
        loadCheckoutState()?.shippingMethod || 'standard');

    // VIP / Product Free Shipping Logic
    const isVIP = user?.isVIP || false;
    // Direct (always) free shipping: any product flagged freeShipping.
    const hasDirectFreeShipping = cart.some(item => item.freeShipping);
    // Paired-with-any-other-item free shipping: a product flagged
    // freeShippingWhenPaired only ships $0 when the cart ALSO contains a
    // distinct other product (different productId). Used by the Coalition
    // 'Overwhelmingly Patient' Hoodie so the hoodie alone pays shipping,
    // hoodie + tee (or anything else) ships free.
    const hasPairedFreeShippingItem = cart.some(item => item.freeShippingWhenPaired);
    const distinctCartProductIds = new Set(cart.map(item => item.id));
    const isPairedFreeShippingEligible = hasPairedFreeShippingItem && distinctCartProductIds.size >= 2;
    // Composite flag consumed by the shipping math AND every display
    // reference below (JM keeps the original variable name so the JSX
    // references didn't have to be touched).
    const hasFreeShippingProduct = hasDirectFreeShipping || isPairedFreeShippingEligible;
    // Hint state for the 'Add another item to ship free' nudge: the hoodie
    // is in the cart, but no second distinct line item — so $5 shipping is
    // currently being charged and would zero out if the customer added
    // anything else.
    const showPairAnotherItemHint = hasPairedFreeShippingItem && distinctCartProductIds.size === 1;
    const baseShippingCost = shippingMethod === 'express' ? 10 : 0;
    const shippingCost = hasFreeShippingProduct || (isVIP && shippingMethod === 'standard') ? 0 : baseShippingCost;

    const total = cartTotal();
    const reward = calculateReward(total);

    // The checkout only advertises the crypto discount when the pricing
    // authority (services/orderIntake.ts → resolveCryptoDiscountCents)
    // confirms the server will honor it for this cart — otherwise the badge
    // would promise a discount the order total never shows. The estimate is
    // only meaningful pre-discount (before serverPricing), because the
    // server already includes the discount in its totals.
    const cryptoDiscountAdvertised = !serverPricing && total > 0
        ? resolveCryptoDiscountCents(cart.map(item => ({ productId: item.id, quantity: item.quantity, price: getCartItemUnitPrice(item) })), shippingCost) > 0
        : false;

    // Pricing authority lives in services/orderIntake.ts → resolvePricing().
    // The client passes raw items + shipping choice; the server computes the
    // real total including set bonuses, crypto discount, and add-on pricing.
    // Display values below are rough estimates only.

    // Store Credit Logic
    const [useStoreCredit, setUseStoreCredit] = useState(false);
    const availableCredit = user?.storeCredit || 0;
    const creditToApply = useStoreCredit ? Math.min(availableCredit, total + shippingCost) : 0;
    const [isZeroAmount, setIsZeroAmount] = useState(false);

    // Crypto discount is server-computed via resolvePricing(). Display only
    // whether the discount is active for the UI badge; the dollar amount is
    // not computed client-side.
    const discountEnabled = isSGCoinDiscountEnabled();

    // Final Total Calculation (raw estimate — server is authoritative).
    // Pre-discount ONLY: the crypto discount applies server-side, so this
    // raw estimate must stay discount-free — for card the intent re-prices
    // from DB.
    const finalTotal = Math.max(0, total + shippingCost - creditToApply);
    // The discount coupon the server prices with, derived once because three
    // requests must agree on it (pricing preview, PaymentIntent, order) and the
    // intent effect must re-run when it changes. A coupon moves the order total,
    // so leaving it out of that effect left Stripe holding the pre-coupon
    // intent: the page showed the discounted total while the Pay button still
    // charged the old amount, and complete-order's amount check then refused a
    // payment the shopper had already made. Referral codes stay out — they are
    // attribution only, never a price.
    const discountCouponCode = isDiscountCoupon && appliedCoupon ? appliedCoupon : undefined;
    // Server-authoritative total for display in the review card + trust copy.
    // Prefer the actual PaymentIntent pricing (includes coupon + store
    // credit), then the pricing preview, then the raw client estimate. This
    // keeps every total on the page consistent — previously the review card
    // showed the client estimate and ignored the applied coupon, disagreeing
    // with the order summary's server-computed total.
    const reviewTotal = serverPricing
        ? serverPricing.totalCents / 100
        : pricingPreview
            ? pricingPreview.totalCents / 100
            : finalTotal;
    // The amount a customer is asked to pay must be the server's price for the
    // method they selected. pricingPreview is fetched with that method AND the
    // applied coupon, so it is the authority for the manual paths; the stored
    // PaymentIntent price is a CARD intent (it has no crypto discount) and the
    // raw finalTotal estimate drops the coupon as well. Both were printed in
    // the Cash App and crypto panels, so a shopper with the crypto discount was
    // told to send the undiscounted amount and a voucher-comped order still
    // asked for full price.
    const serverTotalForMethod = paymentMethod !== 'card' && pricingPreview
        ? pricingPreview.totalCents / 100
        : reviewTotal;
    // "Nothing to pay" follows the same server price, so a $0 order shows the
    // completion panel for manual methods too instead of asking for money.
    const requiresNoExternalPayment = isZeroAmount || serverTotalForMethod <= 0;
    const paymentLabel = paymentMethod === 'crypto'
        ? 'USDC on Polygon'
        : paymentMethod === 'cashapp'
            ? 'Cash App'
            : stripeMethod === 'klarna'
                ? 'Klarna — Pay in 4'
                : 'Card';
    const shippingCostLabel = shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`;
    const shippingMethodLabel = shippingMethod === 'express' ? 'Express' : 'Standard';
    const fulfillmentExpectation = shippingMethod === 'express'
        ? 'Priority packing after payment verification. Tracking follows by email.'
        : 'Packed after payment verification. Tracking follows by email.';
    const contactEmailLabel = shippingInfo.email.trim() || 'your checkout email';
    const paymentAvailability = [
        ...(paymentSettings.card ? ['Secure card checkout — Visa, Mastercard, Amex'] : []),
        ...(paymentSettings.klarna ? ['Klarna — 4 interest-free payments'] : []),
        ...(paymentSettings.cashapp ? ['Cash App — send to $sgcoalition'] : []),
        ...(paymentSettings.crypto ? [(discountEnabled && cryptoDiscountAdvertised) ? `USDC on Polygon saves ${getDiscountPercentageText()}` : 'USDC on Polygon available'] : []),
    ];
    const checkoutTrustItems = [
        {
            icon: ShieldCheck,
            title: 'Secure checkout',
            detail: 'Card is processed by Stripe; Cash App and crypto are verified before fulfillment.'
        },
        {
            icon: Mail,
            title: 'Confirmation email',
            detail: `Order details are sent to ${contactEmailLabel}.`
        },
        {
            icon: Headphones,
            title: 'Support contact',
            detail: SUPPORT_EMAIL
        },
        {
            icon: RefreshCw,
            title: 'No surprise fees',
            detail: `Shipping is ${shippingCostLabel}; total is $${reviewTotal.toFixed(2)}.`
        }
    ];

    const WALLET_ADDRESS = '0x0F4A0466C2a1d3FA6Ed55a20994617F0533fbf74';

    // Stripe Payment Element (card / Klarna / Afterpay) intent lifecycle.
    // The intent is created lazily once the Stripe method is selected and
    // re-created (debounced) whenever the shipping form changes, because
    // Afterpay underwrites against the shipping address attached to the
    // PaymentIntent and Klarna reads the shipping country for eligibility.
    const shippingFingerprint = useMemo(
        () => [shippingInfo.name, shippingInfo.address1, shippingInfo.city, shippingInfo.state, shippingInfo.zip, shippingInfo.country]
            .join('|').trim().toLowerCase(),
        [shippingInfo.name, shippingInfo.address1, shippingInfo.city, shippingInfo.state, shippingInfo.zip, shippingInfo.country],
    );

    useEffect(() => {
        // If payment method is crypto or cashapp, we don't need payment intent
        if (paymentMethod === 'crypto' || paymentMethod === 'cashapp') {
            setClientSecret('');
            setIsZeroAmount(false);
            return;
        }
        if (paymentMethod !== 'card' || cart.length === 0) return;
        // Wait until the buyer starts the shipping form so we don't fire an
        // intent for an empty/placeholder address (BNPL would reject it).
        const hasAnyShipping = Object.values(shippingInfo).some(v => String(v).trim() !== '');
        if (!hasAnyShipping) return;
        // stripeMethod drives the intent's payment_method_types: the primary
        // card path requests a card-only intent, the 'More payment options'
        // Klarna path a Klarna-only one — so the PaymentElement only ever
        // shows the method the buyer chose.
        const timer = setTimeout(() => { void createPaymentIntent(); }, 600);
        return () => clearTimeout(timer);
    }, [cart, paymentMethod, stripeMethod, useStoreCredit, shippingMethod, shippingFingerprint, discountCouponCode]);

    // Fetch server-authoritative pricing preview for the order summary.
    // Debounced — fires when cart, shipping, or payment method change.
    // The preview is display-only; actual payment amounts are computed
    // separately by create-payment-intent / complete-order.
    useEffect(() => {
        if (cart.length === 0) return;
        const timer = setTimeout(() => {
            fetch('/api/pricing-preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart.map(item => ({
                        productId: item.id,
                        selectedSize: item.selectedSize || 'One Size',
                        quantity: item.quantity,
                        keychainClipOn: Boolean(item.keychainClipOn),
                    })),
                    shippingCost,
                    paymentMethod,
                    couponCode: discountCouponCode,
                }),
            })
            .then(r => r.json())
            .then(data => {
                if (data.error) { setPricingPreview(null); return; }
                setPricingPreview(data);
            })
            .catch(() => setPricingPreview(null));
        }, 400);
        return () => clearTimeout(timer);
    }, [cart, shippingCost, paymentMethod, appliedCoupon, isDiscountCoupon]);

    // Check for existing coupon on mount — classify it as a discount coupon
    // or a referral so the pricing preview can include the discount.
    useEffect(() => {
        const existingCoupon = getAppliedCouponCode();
        if (existingCoupon) {
            setAppliedCoupon(existingCoupon);
            setCouponCode(existingCoupon);
            void validateDiscountCoupon(existingCoupon).then((c) => {
                if (c.valid && c.coupon) {
                    setIsDiscountCoupon(true);
                    setCouponDiscountLabel(
                        c.coupon.discount_type === 'percent'
                            ? `${c.coupon.discount_value}% off`
                            : `$${c.coupon.discount_value.toFixed(2)} off`,
                    );
                }
            });
        }
    }, []);

    const handleApplyCoupon = async () => {
        setCouponError(null);
        setIsValidatingCoupon(true);
        try {
            // 1. Admin-created discount coupon (coupons table) — real discount,
            //    applied server-side at pricing time. Not stored as a referral.
            const couponCheck = await validateDiscountCoupon(couponCode);
            if (couponCheck.valid && couponCheck.coupon) {
                sessionStorage.removeItem('referralCode');
                setAppliedCoupon(couponCheck.coupon.code);
                setIsDiscountCoupon(true);
                setCouponDiscountLabel(
                    couponCheck.coupon.discount_type === 'percent'
                        ? `${couponCheck.coupon.discount_value}% off`
                        : `$${couponCheck.coupon.discount_value.toFixed(2)} off`,
                );
                setCouponReferrerName(null);
                addToast('Coupon applied!', 'success');
                return;
            }
            // The code IS in the coupons table but is unusable (inactive /
            // expired / used up) — surface that instead of falling through to
            // the referral lookup, which would give a misleading error.
            if (couponCheck.error) {
                setCouponError(couponCheck.error);
                addToast(couponCheck.error, 'error');
                return;
            }

            // 2. Referral code (referral_stats) — attribution, no discount.
            // Pass the signed-in user so the validator can reject self-referrals
            // at the coupon-input layer (server-side RPC enforces this too).
            const result = await validateCouponCode(couponCode, user?.uid);
            if (result.valid) {
                applyCouponCode(couponCode);
                setAppliedCoupon(couponCode.toUpperCase());
                setIsDiscountCoupon(false);
                setCouponDiscountLabel(null);
                setCouponReferrerName(result.referrerName || null);
                addToast('Coupon code applied successfully!', 'success');
            } else {
                setCouponError(result.error || 'Invalid code');
                addToast(result.error || 'Invalid coupon code', 'error');
            }
        } finally {
            setIsValidatingCoupon(false);
        }
    };

    const handleRemoveCoupon = () => {
        sessionStorage.removeItem('referralCode');
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponReferrerName(null);
        setCouponError(null);
        setIsDiscountCoupon(false);
        setCouponDiscountLabel(null);
        addToast('Coupon code removed', 'info');
    };

    const createPaymentIntent = async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fresh order seed per intent keeps the Stripe webhook's order_id
            // metadata anchored to a real order number. Amount excludes the
            // crypto-only discount; store credit is subtracted server-side.
            const seed = createOrderSeed();
            stripeOrderSeedRef.current = seed;

            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: cart.map(item => ({
                        productId: item.id,
                        selectedSize: item.selectedSize || 'One Size',
                        quantity: item.quantity,
                        keychainClipOn: Boolean(item.keychainClipOn),
                    })),
                    shippingCost,
                    userId: user?.uid,
                    useStoreCredit,
                    paymentMethodTypes: [stripeMethod],
                    orderId: seed.orderId,
                    couponCode: discountCouponCode,
                    email: shippingInfo.email,
                    // Country is normalized to ISO-3166 for Stripe; if it
                    // can't be mapped, shipping is omitted so card payments
                    // still work (BNPL methods just won't be offered).
                    shipping: (() => {
                        const country = normalizeCountryCode(shippingInfo.country);
                        if (!country) return undefined;
                        return {
                            name: shippingInfo.name,
                            address: {
                                line1: shippingInfo.address1,
                                city: shippingInfo.city,
                                state: shippingInfo.state,
                                postal_code: shippingInfo.zip,
                                country,
                            },
                        };
                    })(),
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: 'Network error' }));
                throw new Error(err.error || 'Failed to create payment intent');
            }
            const data = await response.json();

            // Cache the server-computed pricing so the Stripe Payment Section
            // can show the authoritative total (includes set bonus, excludes
            // crypto-only discount).
            if (data.pricing) setServerPricing(data.pricing);

            if (data.zeroAmount) {
                setIsZeroAmount(true);
                setClientSecret('');
                serverCreditAppliedRef.current = 0;
            } else {
                setIsZeroAmount(false);
                setClientSecret(data.clientSecret);
                serverCreditAppliedRef.current = typeof data.creditApplied === 'number' ? data.creditApplied : 0;
            }

            // Persist the applied credit for the 3DS/Klarna/Afterpay
            // redirect-return: the server re-prices the order through
            // acceptCheckout, which needs the same credit the intent applied
            // or verification fails with "Stripe amount mismatch".
            const saved = loadCheckoutState() || {};
            saveCheckoutState({ ...saved, storeCreditApplied: serverCreditAppliedRef.current });

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

    const createOrderSeed = (): OrderSeed => {
        const seed: OrderSeed = {
            orderId: `order_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            orderNumber: generateOrderNumber(),
        };
        // Persist so a Stripe 3DS/Klarna redirect-return reuses the same seed.
        const saved = loadCheckoutState() || {};
        saveCheckoutState({ ...saved, orderSeed: seed });
        return seed;
    };

    // Persist form state whenever it changes so the Stripe 3DS/Klarna/Afterpay
    // redirect-return page can restore the exact checkout in progress.
    useEffect(() => {
        const saved = loadCheckoutState() || {};
        saveCheckoutState({ ...saved, shippingInfo, shippingMethod, shippingCost, paymentMethod, stripeMethod });
    }, [shippingInfo, shippingMethod, shippingCost, paymentMethod, stripeMethod]);

    // Server-stated amount of store credit applied to the current Stripe
    // PaymentIntent (create-payment-intent response). Persisted to checkout
    // state and forwarded to complete-order so the order re-pricing matches
    // the charged amount exactly (otherwise verification fails with "Stripe
    // amount mismatch" and the buyer is charged with no order).
    const serverCreditAppliedRef = useRef(0);

    const createOrder = async (paymentMethodUsed: string, paymentReference?: string, orderSeed?: OrderSeed) => {
        try {
            const orderNumber = orderSeed?.orderNumber || generateOrderNumber();
            const isGuest = !user;

            // Pricing authority lives in services/orderIntake.ts → resolvePricing().
            // subtotal / discount are server-computed from DB; the client passes
            // only raw items + shipping choice. The total below is a raw,
            // pre-coupon estimate used to build the request; the order the server
            // RECORDS comes back from addOrder and replaces it for display and for
            // every derived number (a comped order's estimate is money nobody paid).
            const order = {
                id: orderSeed?.orderId || `order_${Date.now()}`,
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
                    price: getCartItemUnitPrice(item),    // display-only; server re-prices
                    total: getCartItemLineTotal(item),     // display-only; server re-prices
                    keychainClipOn: Boolean(item.keychainClipOn),
                    addOnLabel: item.keychainClipOn ? WALLET_KEYCHAIN_CLIP_LABEL : undefined,
                })),
                subtotal: 0,  // server-authoritative via resolvePricing()
                tax: 0,
                discount: 0,  // server-authoritative via resolvePricing()
                total: finalTotal,
                paymentMethod: paymentMethodUsed as any,
                paymentStatus: paymentMethodUsed === 'crypto' || paymentMethodUsed === 'cashapp' ? OrderStatus.PENDING : OrderStatus.PAID,
                couponCode: discountCouponCode,
                // Store credit already applied + charged upstream (Stripe
                // intent). The server re-verifies against the live balance
                // and debits the profile exactly once per order.
                storeCreditApplied: serverCreditAppliedRef.current,
                paymentReference,
                orderType: 'online' as const,
                createdAt: new Date().toISOString(),
                paidAt: paymentMethodUsed !== 'crypto' && paymentMethodUsed !== 'cashapp' ? new Date().toISOString() : undefined,
                sgCoinReward: reward,
                shippingAddress: {
                    address1: shippingInfo.address1,
                    city: shippingInfo.city,
                    state: shippingInfo.state,
                    zip: shippingInfo.zip,
                    country: shippingInfo.country,
                    shippingMethod,
                    shippingCost
                }
            };

            // Resolves to the row the server recorded, which is authoritative for
            // the total: the client's object is coupon-blind. Falls back to the
            // local object only if the provider handed nothing back.
            const recorded = (await addOrder(order)) || order;

            // Decrement client-side size_inventory so the storefront reflects the
            // latest availability without waiting for Supabase realtime to sync.
            void deductInventory(order.items);

            // Save the RECORDED order to sessionStorage so OrderSuccess displays
            // the totals the server wrote, not the client estimate. The cart is
            // cleared on redirect, so this object is what the page renders.
            sessionStorage.setItem('pendingOrder', JSON.stringify(recorded));

            // Track referral purchase if user came from a referral link.
            // This fires both the analytics event AND the commission pipeline:
            //   1. trackReferralEvent('purchase') — increments the analytics counters
            //   2. processReferralOnPurchase() — finds/creates the referral row,
            //      stamps the order_id + commission, and updates referral_stats.
            const referralCode = sessionStorage.getItem('referralCode');
            if (referralCode) {
                await trackReferralEvent(referralCode, 'purchase', user?.uid);
                // Fire-and-forget: commission processing should not block checkout.
                // The function is idempotent — re-runs skip if a completed referral exists.
                void processReferralOnPurchase(
                    referralCode,
                    user?.uid,
                    recorded.id,
                    recorded.total,
                ).then((result) => {
                    if (result.success && result.commissionEarned) {
                        console.log(`[Referral] Commission earned: $${result.commissionEarned.toFixed(2)}`);
                    }
                }).catch((err) => {
                    console.error('[Referral] Commission processing failed:', err);
                });
                // Clear the referral code so it doesn't double-attribute on a repeat visit.
                clearReferralCode();
            }

            clearCart();
            // Checkout state (form + seed) is consumed on success.
            clearCheckoutState();
            return recorded.orderNumber || orderNumber;
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
            // Store credit is debited only when the order actually spends it.
            // A $0 order also comes from a 100%-off coupon, where creditToApply
            // is 0 and there is often no signed-in user at all: asking the credit
            // handler in that case answered 400 "Missing required fields" and
            // left every voucher order uncompletable. The order itself is written
            // by createOrder below, which routes through the server's pricing.
            if (creditToApply > 0) {
                // Prove the caller owns the userId before any credit is debited.
                // The Supabase client already holds the session from login; getSession()
                // is the same pattern AIPortal / ResetPassword use to send a token to an API route.
                let authToken: string | null = null;
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    authToken = session?.access_token || null;
                } catch { /* leave authToken null — the server will 401 */ }

                const response = await fetch('/api/place-order-credits', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                    },
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

    // Cash App is a manual off-platform payment like crypto: the buyer sends
    // the total to $sgcoalition and notes the items bought in the payment,
    // then confirms here. The order is created as PENDING — the owner
    // verifies the Cash App payment before fulfillment.
    const handleCashAppConfirmation = async () => {
        if (!validateShipping()) return;
        try {
            const orderNumber = await createOrder('cashapp');
            sessionStorage.setItem('shippingInfo', JSON.stringify(shippingInfo));
            sessionStorage.setItem('orderNumber', orderNumber);
            console.log('✅ Cash App order created, redirecting...');
            window.location.href = '/order/success?payment_method=cashapp';
        } catch (error) {
            addToast('Failed to create order. Please try again.', 'error');
        }
    };

    // Called by StripePaymentSection after confirmPayment succeeds (card,
    // Klarna, or Afterpay all land here). Mirrors the manual-confirm paths:
    // write the order, stash session data, redirect to /order/success.
    const handleStripePaid = async (paymentIntentId: string) => {
        try {
            const seed = stripeOrderSeedRef.current || createOrderSeed();
            const orderNumber = await createOrder('stripe', paymentIntentId, seed);
            sessionStorage.setItem('orderNumber', orderNumber);
            sessionStorage.setItem('shippingInfo', JSON.stringify(shippingInfo));
            console.log('✅ Stripe payment confirmed, redirecting...');
            window.location.href = `/order/success?payment_method=stripe&shippingMethod=${shippingMethod}&shippingCost=${shippingCost}`;
        } catch (err: any) {
            console.error('Order creation error:', err);
            reportErrorToAdmin(err.message || 'Stripe success but API failure', 'Stripe onPaid Process', {
                customerEmail: shippingInfo.email,
                total: finalTotal
            });
            setError('Payment succeeded but order creation failed. Please contact support.');
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
                                            <span className={(isVIP || hasFreeShippingProduct) ? "line-through text-gray-400 text-xs mr-2" : ""}>{(isVIP || hasFreeShippingProduct) ? "$5.00" : "Free"}</span>
                                            {hasFreeShippingProduct && <span className="text-brand-accent font-bold">ITEM FREE</span>}
                                            {!hasFreeShippingProduct && isVIP && <span className="text-brand-accent font-bold">VIP FREE</span>}
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
                                        <div className="text-right">
                                            {hasFreeShippingProduct ? (
                                                <>
                                                    <span className="line-through text-gray-400 text-xs mr-2">$10.00</span>
                                                    <span className="text-brand-accent font-bold">FREE</span>
                                                </>
                                            ) : (
                                                <span>$10.00</span>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Coupon Code */}
                            <div>
                                <h3 className="font-bold mb-2 text-white uppercase text-sm tracking-wide">Referral / Coupon Code</h3>
                                {appliedCoupon ? (
                                    <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-300 font-bold text-sm">Code Applied: {appliedCoupon}</span>
                                            </div>
                                            <button
                                                onClick={handleRemoveCoupon}
                                                className="text-xs text-gray-400 hover:text-white transition"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        {couponDiscountLabel && (
                                            <p className="text-xs text-emerald-400 font-bold">
                                                {couponDiscountLabel} discount applied
                                            </p>
                                        )}
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
                                            Have a referral or discount code? Enter it here!
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
                                    <span className="text-gray-300 font-bold">
                                        -${Math.min(availableCredit, total + shippingCost).toFixed(2)}
                                    </span>
                                </label>
                            </div>
                        )}

                        {/* Payment Method Selection */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                            <h3 className="font-bold mb-4 text-white uppercase text-sm tracking-wide">Payment Method</h3>
                            <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {paymentAvailability.map((label) => (
                                    <div key={label} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-gray-300">
                                        <Check className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>

                            {requiresNoExternalPayment ? (
                                <div className="text-center py-6">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/5 rounded-full mb-4">
                                        <Check className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <h4 className="text-white font-bold text-lg mb-2">{creditToApply > 0 ? 'Paid with Store Credit' : 'No payment required'}</h4>
                                    <p className="text-gray-400 text-sm mb-6">{creditToApply > 0 ? 'No additional payment required.' : 'Your discount covers this order — nothing to pay.'}</p>
                                    <button
                                        onClick={handleCompleteFreeOrder}
                                        disabled={isLoading}
                                        className="w-full bg-brand-accent text-black py-4 rounded font-bold uppercase tracking-widest hover:bg-white transition disabled:opacity-50"
                                    >
                                        {isLoading ? 'Processing...' : 'Complete Order'}
                                    </button>
                                </div>
                            ) : paymentSettingsLoaded && !paymentSettings.card && !paymentSettings.klarna && !paymentSettings.crypto ? (
                                <div className="text-center py-6">
                                    <p className="text-sm text-gray-400">
                                        Payment options are currently unavailable. Please contact support.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-3 mb-6">
                                        {/* Card - PRIMARY. A card-only intent is requested
                                            (paymentMethodTypes: ['card']) so customers who just
                                            want to pay by card never see Klarna tabs or any other
                                            extra service — those live under 'More payment options'.
                                            Hidden entirely when the owner turns cards off. */}
                                        {paymentSettings.card && (
                                        <label className={`flex items-center justify-between p-5 rounded-xl border-2 cursor-pointer transition group relative overflow-hidden ${paymentMethod === 'card' && stripeMethod === 'card' ? 'bg-gradient-to-r from-violet-600/15 to-blue-600/15 border-violet-500/70 shadow-lg shadow-violet-500/10' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30'}`}>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    checked={paymentMethod === 'card' && stripeMethod === 'card'}
                                                    onChange={() => { setPaymentMethod('card'); setStripeMethod('card'); }}
                                                    className="w-5 h-5 border-gray-500 text-violet-600 focus:ring-violet-500"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="font-black text-base text-white">Pay by Card</span>
                                                    <span className="text-xs text-gray-400">Visa, Mastercard, Amex — no account or extra steps needed</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 border border-white/15 rounded px-1.5 py-0.5">Visa</span>
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 border border-white/15 rounded px-1.5 py-0.5">Mastercard</span>
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 border border-white/15 rounded px-1.5 py-0.5">Amex</span>
                                            </div>
                                        </label>
                                        )}

                                        {/* Everything else - SECONDARY, behind a disclosure.
                                            Cash App is a manual payment to $sgcoalition; Crypto is
                                            the USDC path; Klarna/Pay in 4 appear only if the owner
                                            re-enables them. Rendered only when at least one
                                            secondary option is enabled. */}
                                        {(paymentSettings.klarna || paymentSettings.cashapp || paymentSettings.crypto) && (
                                        <div className="rounded-xl border border-white/10 bg-black/20">
                                            <button
                                                type="button"
                                                onClick={() => setMoreOptionsOpen(o => !o)}
                                                aria-expanded={moreOptionsOpen}
                                                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-gray-300 hover:text-white transition"
                                            >
                                                <span className="flex items-center gap-2">
                                                    More payment options
                                                    {(paymentMethod === 'crypto' || paymentMethod === 'cashapp' || stripeMethod === 'klarna') && (
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 border border-white/15 rounded px-1.5 py-0.5">
                                                            {paymentMethod === 'crypto' ? 'Crypto' : paymentMethod === 'cashapp' ? 'Cash App' : 'Klarna'} selected
                                                        </span>
                                                    )}
                                                </span>
                                                <ChevronDown className={`w-4 h-4 transition-transform ${moreOptionsOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {moreOptionsOpen && (
                                                <div className="px-3 pb-3 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                    {paymentSettings.klarna && (
                                                    <label className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition group ${paymentMethod === 'card' && stripeMethod === 'klarna' ? 'bg-violet-600/10 border-violet-500/60 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 text-gray-400'}`}>
                                                        <div className="flex items-center gap-4">
                                                            <input
                                                                type="radio"
                                                                name="paymentMethod"
                                                                checked={paymentMethod === 'card' && stripeMethod === 'klarna'}
                                                                onChange={() => { setPaymentMethod('card'); setStripeMethod('klarna'); setMoreOptionsOpen(true); }}
                                                                className="w-4 h-4 border-gray-500 text-violet-500 focus:ring-violet-500"
                                                            />
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-sm text-white">Klarna — Pay in 4</span>
                                                                <span className="text-xs text-gray-400">Split into four interest-free payments where eligible</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 border border-white/15 rounded px-1.5 py-0.5">Klarna</span>
                                                    </label>
                                                    )}

                                                    {paymentSettings.cashapp && (
                                                    <label className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition group ${paymentMethod === 'cashapp' ? 'bg-green-600/10 border-green-500 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 text-gray-400'}`}>
                                                        <div className="flex items-center gap-4">
                                                            <input
                                                                type="radio"
                                                                name="paymentMethod"
                                                                checked={paymentMethod === 'cashapp'}
                                                                onChange={() => { setPaymentMethod('cashapp'); setMoreOptionsOpen(true); }}
                                                                className="w-4 h-4 border-gray-500 text-green-500 focus:ring-green-500"
                                                            />
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-sm text-white">Cash App</span>
                                                                    <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold tracking-wider">$sgcoalition</span>
                                                                </div>
                                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                                    Send the total to $sgcoalition and note the items you bought
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Wallet className={`w-5 h-5 ${paymentMethod === 'cashapp' ? 'text-green-400' : 'text-gray-500'}`} />
                                                    </label>
                                                    )}

                                                    {paymentSettings.crypto && (
                                                    <label className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition group ${paymentMethod === 'crypto' ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30 text-gray-400'}`}>
                                                        <div className="flex items-center gap-4">
                                                            <input
                                                                type="radio"
                                                                name="paymentMethod"
                                                                checked={paymentMethod === 'crypto'}
                                                                onChange={() => { setPaymentMethod('crypto'); setMoreOptionsOpen(true); }}
                                                                className="w-4 h-4 border-gray-500 text-blue-500 focus:ring-blue-500"
                                                            />
                                                            <div className="flex flex-col">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-sm text-white">Pay with Crypto</span>
                                                                    <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold tracking-wider">{cryptoDiscountAdvertised ? `SAVE ${getDiscountPercentageText()}` : 'USDC'}</span>
                                                                </div>
                                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                            USDC on Polygon Network. {cryptoDiscountAdvertised ? `${getDiscountPercentageText()} off the order total.` : ''} <Info className="w-3 h-3" />
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Wallet className={`w-5 h-5 ${paymentMethod === 'crypto' ? 'text-blue-400' : 'text-gray-500'}`} />
                                                    </label>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        )}
                                    </div>

                                    <div className="mb-6 rounded-xl border border-white/10 bg-black/30 p-4">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">Review Before Payment</p>
                                                <p className="mt-1 text-sm text-gray-300">These details are shown before the final payment step.</p>
                                            </div>
                                            <ShieldCheck className="h-5 w-5 flex-shrink-0 text-gray-400" />
                                        </div>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Payment</p>
                                                <p className="mt-1 text-sm font-bold text-white">{paymentLabel}</p>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Shipping</p>
                                                <p className="mt-1 text-sm font-bold text-white">{shippingCostLabel} - {shippingMethodLabel}</p>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Total</p>
                                                <p className="mt-1 text-sm font-bold text-white">${serverTotalForMethod.toFixed(2)}</p>
                                            </div>
                                            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Fulfillment</p>
                                                <p className="mt-1 text-sm font-bold leading-relaxed text-white">{fulfillmentExpectation}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stripe Payment Element: Card, Klarna, Afterpay */}
                                    {paymentMethod === 'card' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-white/[0.03] border border-white/10 p-4 rounded-lg">
                                        <div className="flex items-start gap-3">
                                            <div>
                                                <h4 className="font-bold text-gray-300 text-sm uppercase tracking-wide mb-1">{stripeMethod === 'klarna' ? 'Klarna — Pay in 4' : 'Pay by Card'}</h4>
                                                <p className="text-sm text-gray-300">
                                                    {stripeMethod === 'klarna'
                                                        ? 'Split your order into four interest-free payments. Klarna is offered when your order and region qualify.'
                                                        : 'Pay by credit or debit card. Visa, Mastercard, Amex, and more — no account or extra steps needed.'}
                                                </p>
                                            </div>
                                        </div>
                                            </div>

                                            {stripePromise && clientSecret ? (
                                                // key={clientSecret}: when the debounced intent effect
                                                // issues a new PaymentIntent (shipping edit, card<->Klarna
                                                // switch), the provider + PaymentElement remount cleanly
                                                // instead of React reusing the old Elements instance whose
                                                // PaymentElement is mid-teardown. Without the key,
                                                // confirmPayment can be handed a stale `elements` object
                                                // whose element was unmounted -> "elements should have a
                                                // mounted Payment Element" crash.
                                                <Elements
                                                    key={clientSecret}
                                                    stripe={stripePromise}
                                                    options={{ clientSecret, appearance: STRIPE_APPEARANCE }}
                                                >
                                                    <StripePaymentSection
                                                        email={shippingInfo.email}
                                                        total={serverPricing ? serverPricing.totalCents / 100 : finalTotal}
                                                        onPaid={handleStripePaid}
                                                        onValidationRequired={validateShipping}
                                                    />
                                                </Elements>
                                            ) : (
                                                <div className="rounded-xl border border-white/10 bg-black/30 p-6 text-center">
                                                    {!stripePromise ? (
                                                        <p className="text-sm text-gray-400">
                                                            Card is unavailable right now. Please use Cash App, crypto, or contact support.
                                                        </p>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                                                            <Loader className="w-4 h-4 animate-spin" />
                                                            Preparing payment options...
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Rendered in BOTH branches so a post-payment
                                                order-creation failure (set by handleStripePaid)
                                                is never invisible to the buyer. */}
                                            {error && (
                                                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg text-red-400 text-sm">
                                                    {error}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Cash App Payment — manual off-platform payment.
                                        Buyer sends the total to $sgcoalition and notes the
                                        items bought in the Cash App payment note, then
                                        confirms below. Order lands PENDING until the owner
                                        verifies the Cash App transfer. */}
                                    {paymentMethod === 'cashapp' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-white/[0.03] border border-white/10 p-4 rounded-lg">
                                                <div className="flex items-start gap-3">
                                                    <div>
                                                        <h4 className="font-bold text-gray-300 text-sm uppercase tracking-wide mb-1">Pay with Cash App</h4>
                                                        <p className="text-sm text-gray-300">
                                                            Send ${serverTotalForMethod.toFixed(2)} to <span className="text-green-400 font-bold">$sgcoalition</span> on Cash App.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-black/50 p-4 rounded-lg border border-green-500/30">
                                                <p className="text-sm text-gray-400 mb-2">Send <span className="text-white font-bold">${serverTotalForMethod.toFixed(2)}</span> to:</p>
                                                <div className="flex items-center justify-between bg-white/5 p-3 rounded border border-white/10">
                                                    <code className="text-xs sm:text-sm font-mono text-green-300 truncate mr-2">$sgcoalition</code>
                                                    <button onClick={copyAddress} className="text-gray-400 hover:text-white transition">
                                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">Cash App handle — open the app, send to this tag</p>
                                            </div>

                                            {/* Important: note the items */}
                                            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                                <div className="flex items-start gap-3">
                                                    <Info className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-[11px] text-green-300 font-bold mb-1">Note what you're buying</p>
                                                        <p className="text-[10px] text-green-200/70 leading-relaxed">
                                                            In the Cash App payment note, list the items you ordered
                                                            (e.g. "Puffer Jacket — Large") so I can match the payment to
                                                            your order. Your order number is shown on the confirmation
                                                            screen after you tap below.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Email instructions */}
                                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                                                <div className="flex items-start gap-3">
                                                    <Mail className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-[11px] text-orange-300 font-bold mb-1">After sending, email me your details</p>
                                                        <p className="text-[10px] text-orange-200/70 leading-relaxed">
                                                            Send your Cash App receipt (or confirmation), your shipping name
                                                            & address, and the item ordered to{' '}
                                                            <a href="mailto:sgctrustyourself@gmail.com" className="text-orange-300 underline decoration-orange-400/30 hover:decoration-orange-300 transition-all font-mono">
                                                                sgctrustyourself@gmail.com
                                                            </a>
                                                            . I'll confirm and ship within 24 hours.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleCashAppConfirmation}
                                                className="w-full bg-green-600 text-white py-3 rounded font-bold uppercase tracking-widest hover:bg-green-500 transition shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                                            >
                                                I Have Sent the Payment
                                            </button>
                                        </div>
                                    )}

                                    {/* Crypto Payment */}
                                    {paymentMethod === 'crypto' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-white/[0.03] border border-white/10 p-4 rounded-lg">
                                                <div className="flex items-start gap-3">
                                                    <div>
                                                        <h4 className="font-bold text-gray-300 text-sm uppercase tracking-wide mb-1">                                                            Pay with Crypto
                                                        </h4>
                                                        <p className="text-sm text-gray-300">
                                                            USDC on Polygon network.{cryptoDiscountAdvertised ? ` ${getDiscountPercentageText()} off the order total.` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-black/50 p-4 rounded-lg border border-white/10">
                                                <p className="text-sm text-gray-400 mb-2">Send <span className="text-white font-bold">{serverTotalForMethod.toFixed(2)} USDC</span> to:</p>
                                                <div className="flex items-center justify-between bg-white/5 p-3 rounded border border-white/10">
                                                    <code className="text-xs sm:text-sm font-mono text-gray-300 truncate mr-2">{WALLET_ADDRESS}</code>
                                                    <button onClick={copyAddress} className="text-gray-400 hover:text-white transition">
                                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2">Network: Polygon (MATIC)</p>
                                            </div>

                                            {/* Email instructions */}
                                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                                                <div className="flex items-start gap-3">
                                                    <Mail className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-[11px] text-orange-300 font-bold mb-1">After sending, email me your details</p>
                                                        <p className="text-[10px] text-orange-200/70 leading-relaxed">
                                                            Send your payment receipt, transaction hash, your shipping name & address, and the item ordered to{' '}
                                                            <a href="mailto:sgctrustyourself@gmail.com" className="text-orange-300 underline decoration-orange-400/30 hover:decoration-orange-300 transition-all font-mono">
                                                                sgctrustyourself@gmail.com
                                                            </a>
                                                            . I'll confirm and ship within 24 hours.
                                                        </p>
                                                    </div>
                                                </div>
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
                                    <div key={item.cartId} className="flex gap-4">
                                        <div className="w-16 h-20 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                                            <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-sm text-white truncate">{item.name}</h4>
                                            <p className="text-xs text-gray-400">Size: {item.selectedSize}</p>
                                            {item.keychainClipOn && (
                                                <p className="text-xs text-gray-400">{WALLET_KEYCHAIN_CLIP_LABEL} (+$10)</p>
                                            )}
                                            <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                                        </div>
                                        <div className="text-sm font-medium text-white">
                                            ${getCartItemLineTotal(item).toFixed(2)}
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
                                    <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
                                </div>
                                {pricingPreview && pricingPreview.setBonusCents > 0 && (
                                    <div className="flex justify-between text-gray-400">
                                        <span>Above as Below set bonus</span>
                                        <span>-${(pricingPreview.setBonusCents / 100).toFixed(2)}</span>
                                    </div>
                                )}
                                {pricingPreview && pricingPreview.cryptoDiscountCents > 0 && (
                                    <div className="flex justify-between text-blue-400">
                                        <span>Crypto Discount ({getDiscountPercentageText()})</span>
                                        <span>-${(pricingPreview.cryptoDiscountCents / 100).toFixed(2)}</span>
                                    </div>
                                )}
                                {pricingPreview && pricingPreview.couponDiscountCents > 0 && (
                                    <div className="flex justify-between text-emerald-400">
                                        <span>Coupon ({appliedCoupon})</span>
                                        <span>-${(pricingPreview.couponDiscountCents / 100).toFixed(2)}</span>
                                    </div>
                                )}
                                {showPairAnotherItemHint && (
                                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                                            Paired shipping
                                        </p>
                                        <p className="mt-1 text-xs text-gray-300 leading-relaxed">
                                            This piece ships $0 when paired with a second distinct item. Add a tee, shorts, or anything else to remove shipping.
                                        </p>
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
                                    <span>${pricingPreview ? (pricingPreview.totalCents / 100).toFixed(2) : finalTotal.toFixed(2)}</span>
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

                                <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white">Checkout Trust</p>
                                        <ShieldCheck className="h-4 w-4 text-gray-400" />
                                    </div>
                                    <div className="space-y-3">
                                        {checkoutTrustItems.map((item) => {
                                            const Icon = item.icon;
                                            return (
                                                <div key={item.title} className="flex gap-3">
                                                    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-accent" />
                                                    <div>
                                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white">{item.title}</p>
                                                        {item.detail === SUPPORT_EMAIL ? (
                                                            <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-1 block text-xs text-gray-400 underline decoration-white/20 underline-offset-4 transition hover:text-white">
                                                                {item.detail}
                                                            </a>
                                                        ) : (
                                                            <p className="mt-1 text-xs leading-relaxed text-gray-400">{item.detail}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
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
