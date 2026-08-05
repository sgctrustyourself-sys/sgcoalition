import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Trash2, ArrowRight } from 'lucide-react';
import { COIN_REWARD_RATE } from '../constants';
import { getCartItemLineTotal, getCartItemUnitPrice, WALLET_KEYCHAIN_CLIP_LABEL } from '../utils/walletAddOns';
import { calculateAboveAsBelowSetBonusCents } from '../utils/aboveAsBelowSet';

// Named export keeps symbol-search by `Cart` working; default export lets
// App.tsx register the /cart route via React.lazy(() => import('./pages/Cart')).
// Both references resolve to the same component instance.
export const Cart: React.FC = () => {
    const navigate = useNavigate();
    const { cart, removeFromCart, clearCart, user } = useApp();

    const total = cart.reduce((sum, item) => sum + getCartItemLineTotal(item), 0);
    const potentialCoins = Math.floor(total * COIN_REWARD_RATE);
    // Same set-bonus logic that powers Checkout/CartDrawer — kept inline so the
    // standalone /cart page matches the rest of the storefront.
    const setBonusCents = useMemo(
        () => calculateAboveAsBelowSetBonusCents(cart.map(item => ({ productId: item.id, quantity: item.quantity }))),
        [cart],
    );
    const setBonusDollars = setBonusCents / 100;
    const displayTotal = Math.max(0, total - setBonusDollars);

    if (cart.length === 0) {
        return <div className="min-h-[60vh] flex items-center justify-center text-gray-500">Your cart is empty.</div>;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h1 className="text-4xl font-bold mb-12">Cart</h1>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <div className="lg:col-span-8 space-y-8">
                    {cart.map((item) => (
                        <div key={item.cartId} className="flex gap-6 py-6 border-b border-gray-100">
                            <div className="w-24 h-32 bg-gray-100 flex-shrink-0">
                                <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <h3 className="text-lg font-medium">{item.name}</h3>
                                    <p className="font-medium">${getCartItemLineTotal(item).toFixed(2)}</p>
                                </div>
                                <p className="text-gray-500 mt-1">Size: {item.selectedSize}</p>
                                {item.keychainClipOn && (
                                    <p className="text-gray-500">{WALLET_KEYCHAIN_CLIP_LABEL} (+$10)</p>
                                )}
                                <p className="text-gray-500">Qty: {item.quantity}</p>
                                <p className="text-gray-500 text-sm">Unit Price: ${getCartItemUnitPrice(item).toFixed(2)}</p>
                                <button
                                    onClick={() => removeFromCart(item.cartId)}
                                    className="text-sm text-red-500 mt-4 flex items-center hover:underline"
                                >
                                    <Trash2 size={14} className="mr-1" /> Remove
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="lg:col-span-4">
                    <div className="bg-gray-50 p-8 rounded-sm sticky top-24">
                        <h2 className="text-lg font-bold mb-6">Order Summary</h2>

                        <div className="flex justify-between mb-4 text-gray-600">
                            <span>Subtotal</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                        {/* Set bonus surfaced as a quiet archival fact, not a
                            green-celebration. Mirrors the CartDrawer treatment
                            so the standalone /cart page matches the rest of
                            the storefront. The -$30 is already in displayTotal. */}
                        {setBonusCents > 0 && (
                            <div className="flex items-start gap-3 p-3 mb-4 rounded-md border border-white/10 bg-white/[0.03] text-sm">
                                <div className="flex-1">
                                    <p className="font-bold text-gray-300 uppercase tracking-wide text-[10px]">
                                        Set bonus applied
                                    </p>
                                    <p className="mt-1 text-gray-400">
                                        ${setBonusDollars.toFixed(2)} off the pair — the tee and shorts were built as a set.
                                    </p>
                                </div>
                                <span className="font-bold whitespace-nowrap text-gray-300">
                                    -${setBonusDollars.toFixed(2)}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between mb-4 text-gray-600">
                            <span>Shipping</span>
                            <span>Calculated at checkout</span>
                        </div>

                        <div className="border-t border-gray-200 pt-4 flex justify-between text-xl font-bold mb-6">
                            <span>Total</span>
                            <span>${displayTotal.toFixed(2)}</span>
                        </div>

                        {/* SGCoin reward surfaced as a quiet factual line, not a
                            yellow celebration. The reward is already real value
                            (redeemable for store credit); framing it as "you
                            will earn!" is the gamified register the wedge
                            retired. Sentence-case, no color callout. */}
                        {user && (
                            <div className="border border-white/10 bg-white/[0.03] p-3 text-sm rounded mb-6 text-center text-gray-300 font-medium">
                                {potentialCoins.toLocaleString()} SGCoin on this order
                            </div>
                        )}

                        <Button onClick={() => navigate('/checkout')} className="w-full" size="lg">
                            Checkout <ArrowRight size={16} className="ml-2" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Cart;
