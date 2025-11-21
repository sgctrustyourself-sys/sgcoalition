import React from 'react';
import { X, ShoppingBag, Trash2, Hexagon } from 'lucide-react';
import { useApp } from '../context/AppContext';

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
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in">
                <div className="p-4 flex items-center justify-between border-b border-gray-100">
                    <h2 className="font-display text-xl font-bold uppercase">Your Cart</h2>
                    <button onClick={() => setCartOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {cart.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-20" />
                            <p>Your bag is empty.</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.cartId} className="flex gap-4">
                                <img src={item.images[0]} alt={item.name} className="w-20 h-24 object-cover rounded-sm bg-gray-100" />
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <h3 className="font-medium text-sm">{item.name}</h3>
                                        <p className="font-bold text-sm">${item.price}</p>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Size: {item.selectedSize}</p>
                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-xs text-gray-400">Qty: {item.quantity}</span>
                                        <button onClick={() => removeFromCart(item.cartId)} className="text-red-500 hover:text-red-600">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {cart.length > 0 && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Est. SGCoin Reward</span>
                                <span className="flex items-center text-brand-accent font-bold">
                                    <Hexagon className="w-3 h-3 mr-1 fill-current" /> +{reward.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between text-xl font-display font-bold">
                                <span>Total</span>
                                <span>${total.toFixed(2)}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setCartOpen(false);
                                window.location.hash = '/checkout';
                            }}
                            className="w-full bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-gray-800 transition"
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
