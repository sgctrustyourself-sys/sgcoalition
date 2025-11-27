import React from 'react';
import { X, ShoppingBag, Trash2, Hexagon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import NoRefundsBanner from './NoRefundsBanner';
import FreeShippingBar from './ui/FreeShippingBar';
import CartUpsells from './CartUpsells';
import { SALES_FINAL_ENABLED } from '../constants';

const CartDrawer = () => {
    const { isCartOpen, setCartOpen, cart, removeFromCart, cartTotal, calculateReward } = useApp();

    if (!isCartOpen) return null;

    const total = cartTotal();
    const reward = calculateReward(total);

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
                                        <p className="font-bold text-sm text-white">${item.price}</p>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Size: {item.selectedSize}</p>
                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-xs text-gray-400">Qty: {item.quantity}</span>
                                        <button onClick={() => removeFromCart(item.cartId)} className="text-red-400 hover:text-red-300" aria-label="Remove item">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Free Shipping Progress */}
                    {cart.length > 0 && (
                        <FreeShippingBar cartTotal={total} className="mt-6" />
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
                                <span>Est. SGCoin Reward</span>
                                <span className="flex items-center text-brand-accent font-bold">
                                    <Hexagon className="w-3 h-3 mr-1 fill-current" /> +{reward.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between text-xl font-display font-bold text-white">
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
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
                                window.location.hash = '/checkout';
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
