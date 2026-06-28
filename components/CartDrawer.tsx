import React, { useMemo } from 'react';
import { X, ShoppingBag, Trash2, Hexagon, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import NoRefundsBanner from './NoRefundsBanner';
import FreeShippingBar from './ui/FreeShippingBar';
import CartUpsells from './CartUpsells';
import CompleteTheFitCart from './CompleteTheFitCart';
import { SALES_FINAL_ENABLED } from '../constants';
import { getCartItemLineTotal, getCartItemUnitPrice, WALLET_KEYCHAIN_CLIP_LABEL } from '../utils/walletAddOns';
import { calculateAboveAsBelowSetBonusCents } from '../utils/aboveAsBelowSet';

const CartDrawer = () => {
    const navigate = useNavigate();
    const { isCartOpen, setCartOpen, cart, removeFromCart, cartTotal, calculateReward } = useApp();

    // Rules of Hooks: ALL hooks must be called unconditionally on every render
    // in the same order, regardless of whether the drawer is open. Earlier
    // versions returned early (`if (!isCartOpen) return null`) BEFORE calling
    // useMemo, which caused React to detect a hook-count mismatch the moment
    // the open flag flipped — that fired a fatal error in the global drawer
    // mount and blanked out the entire SPA. Always call hooks first.
    const total = cartTotal();
    const reward = calculateReward(total);
    // Above-as-Below tee + shorts bundle auto-bonus. Shown in the drawer so it
    // sticks in the shopper's head before they reach Checkout.
    const setBonusCents = useMemo(
        () => calculateAboveAsBelowSetBonusCents(cart.map(item => ({ productId: item.id, quantity: item.quantity }))),
        [cart],
    );
    const setBonusDollars = setBonusCents / 100;
    const displayTotal = Math.max(0, total - setBonusDollars);
    // setCount removed: bonus is one-shot $30, no quantity multiplier.

    if (!isCartOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => setCartOpen(false)} />

            {/* Drawer */}
            <div className="relative w-full max-w-md bg-black h-full shadow-2xl flex flex-col animate-slide-in border-l border-white/10">
                <div className="p-4 flex items-center justify-between border-b border-white/10">
                    <h2 className="font-display text-xl font-bold uppercase text-white">Your Cart</h2>
                    <button onClick={() => setCartOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white" aria-label="Close cart">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {cart.length === 0 ? (
                        <div className="text-center py-20 text-gray-500">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Your bag is empty.</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.cartId} className="flex gap-4">
                                <img src={item.images[0]} alt={item.name} className="w-20 h-24 object-cover rounded-sm bg-white/5" />
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <h3 className="font-medium text-sm text-white">{item.name}</h3>
                                        <p className="font-bold text-sm text-white">${getCartItemLineTotal(item).toFixed(2)}</p>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Size: {item.selectedSize}</p>
                                    {item.keychainClipOn && (
                                        <p className="text-xs text-gray-400 mt-1">{WALLET_KEYCHAIN_CLIP_LABEL} (+$10)</p>
                                    )}
                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-xs text-gray-400">Qty: {item.quantity} • ${getCartItemUnitPrice(item).toFixed(2)} each</span>
                                        <button onClick={() => removeFromCart(item.cartId)} className="text-red-400 hover:text-red-300" aria-label="Remove item">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Above-as-Below complete-the-outfit upsell. Renders when exactly */}
                    {/* one of (tee, shorts) is in cart; stays silent when both are */}
                    {/* present so the existing set-bonus card isn't doubled up. */}
                    <CompleteTheFitCart variant="drawer" />

                    {/* Above-as-Below Set Bonus Announcement */}
                    {setBonusCents > 0 && (
                        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                            <Sparkles className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-green-300 uppercase tracking-wide">
                                    Save ${setBonusDollars.toFixed(2)} with the set!
                                </p>
                                <p className="mt-1 text-xs text-green-200/80 leading-relaxed">
                                    Above-as-Below tee + shorts matched — $30 set bonus auto-applied.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Free Shipping Progress */}
                    {cart.length > 0 && (
                        <FreeShippingBar
                            cartTotal={total}
                            // hasFreeShippingItems mirrors how CompleteTheFitCart
                            // already reassures the shopper that the present
                            // line ships free — without it, the bar would
                            // still plead "add $X more for free shipping" on
                            // every cart that contains a wallet, tee, shorts,
                            // or hoodie (all flagged freeShipping: true).
                            hasFreeShippingItems={cart.some((item) => item.freeShipping)}
                            className="mt-6"
                        />
                    )}

                    {/* Cart Upsells */}
                    {cart.length > 0 && (
                        <CartUpsells cartItems={cart} cartTotal={total} className="mt-6" />
                    )}
                </div>

                {cart.length > 0 && (
                    <div className="border-t border-white/10 p-4 bg-white/5">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>Subtotal</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                            {setBonusCents > 0 && (
                                <div className="flex justify-between text-xs text-green-400">
                                    <span>Above as Below set bonus</span>
                                    <span>-${setBonusDollars.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>Est. SGCoin Reward</span>
                                <span className="flex items-center text-brand-accent font-bold">
                                    <Hexagon className="w-3 h-3 mr-1 fill-current" /> +{reward.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between text-xl font-display font-bold text-white pt-2 border-t border-white/10">
                                <span>Total</span>
                                <span>${displayTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* No Refunds Policy Banner */}
                        {SALES_FINAL_ENABLED && (
                            <div className="mb-4">
                                <NoRefundsBanner variant="warning" />
                            </div>
                        )}

                        <button
                            onClick={() => {
                                setCartOpen(false);
                                navigate('/checkout');
                            }}
                            className="w-full bg-white text-black py-4 font-bold uppercase tracking-widest hover:bg-gray-200 transition shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                        >
                            Checkout
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CartDrawer;
