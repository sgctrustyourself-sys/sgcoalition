import React from 'react';
import { Info, ShieldCheck, Heart } from 'lucide-react';
import type { CartItem } from '../../types';
import { getDiscountPercentageText } from '../../utils/pricing';
import { getCartItemLineTotal, WALLET_KEYCHAIN_CLIP_LABEL } from '../../utils/walletAddOns';

export type CheckoutTrustItem = {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    detail: string;
};

export type CheckoutPricingPreview = {
    setBonusCents: number;
    cryptoDiscountCents: number;
    memberDiscountCents: number;
    couponDiscountCents: number;
} | null;

export interface CheckoutOrderSummaryProps {
    cart: CartItem[];
    total: number;
    shippingCost: number;
    pricingPreview: CheckoutPricingPreview;
    appliedCoupon: string | null;
    showPairAnotherItemHint: boolean;
    serverAppliedCredit: number;
    serverTotalForMethod: number;
    reward: number;
    checkoutTrustItems: CheckoutTrustItem[];
    supportEmail: string;
}

const CheckoutOrderSummary: React.FC<CheckoutOrderSummaryProps> = ({
    cart,
    total,
    shippingCost,
    pricingPreview,
    appliedCoupon,
    showPairAnotherItemHint,
    serverAppliedCredit,
    serverTotalForMethod,
    reward,
    checkoutTrustItems,
    supportEmail,
}) => (
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
                {pricingPreview && pricingPreview.memberDiscountCents > 0 && (
                    <div className="flex justify-between text-emerald-400">
                        <span>Member discount (30% off)</span>
                        <span>-${(pricingPreview.memberDiscountCents / 100).toFixed(2)}</span>
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
                {serverAppliedCredit > 0 && (
                    <div className="flex justify-between text-brand-accent">
                        <span>Store Credit</span>
                        <span>-${serverAppliedCredit.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between text-white font-bold text-lg pt-3 border-t border-white/10">
                    <span>Total</span>
                    <span>${serverTotalForMethod.toFixed(2)}</span>
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
                                        {item.detail === supportEmail ? (
                                            <a href={`mailto:${supportEmail}`} className="mt-1 block text-xs text-gray-400 underline decoration-white/20 underline-offset-4 transition hover:text-white">
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
);

export default CheckoutOrderSummary;
