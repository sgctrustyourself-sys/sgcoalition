import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../types';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Plus, Sparkles, ShoppingBag, Check } from 'lucide-react';
import {
    ABOVE_AS_BELOW_TEE_ID,
    ABOVE_AS_BELOW_SHORTS_ID,
    ABOVE_AS_BELOW_SET_BONUS_CENTS,
} from '../utils/aboveAsBelowSet';
import { resolveLocalImageUrl } from '../utils/localImageAssets';
import { getProductImage, getProductImageSrcSet, PRODUCT_IMAGE_SIZES } from '../utils/productImage';

interface CompleteTheFitProps {
    currentProduct: Product;
    selectedSize: string;
    isUnavailable: boolean;
}

const setBonusDollars = ABOVE_AS_BELOW_SET_BONUS_CENTS / 100;

const CompleteTheFit: React.FC<CompleteTheFitProps> = ({
    currentProduct,
    selectedSize,
    isUnavailable,
}) => {
    const { products, cart, addToCart } = useApp();
    const { addToast } = useToast();

    const isTee = currentProduct.id === ABOVE_AS_BELOW_TEE_ID;
    const isShorts = currentProduct.id === ABOVE_AS_BELOW_SHORTS_ID;

    if (!isTee && !isShorts) return null;
    if (isUnavailable) return null;

    const matchId = isTee ? ABOVE_AS_BELOW_SHORTS_ID : ABOVE_AS_BELOW_TEE_ID;
    const match = products.find(p => p.id === matchId);
    if (!match) return null;

    const matchArchived = !!match.archived;
    const matchTotalStock = Object.values(match.sizeInventory || {}).reduce(
        (sum, count) => sum + Number(count || 0),
        0
    );
    const matchSoldOut = !matchArchived && matchTotalStock === 0;
    const matchUnavailable = matchArchived || matchSoldOut;
    if (matchUnavailable) return null;

    const matchSize = (() => {
        if (match.sizes && match.sizes.length === 1) return match.sizes[0];
        if (selectedSize && match.sizes?.includes(selectedSize)) return selectedSize;
        return match.sizes?.[0] || 'One Size';
    })();

    const existingCartItem = cart.find(item => item.id === match.id);
    const matchAlreadyInCart = !!existingCartItem;
    const matchAtSameSizeInCart =
        matchAlreadyInCart && (existingCartItem?.selectedSize === matchSize);

    const soloTotal = currentProduct.price + match.price;
    const setPrice = Math.max(0, soloTotal - setBonusDollars);

    const matchImage = resolveLocalImageUrl(match.images?.[0] || '');
    const matchHref = `/product/${match.id}`;
    const matchShortLabel = isTee ? 'Shorts' : 'Tee';

    const handleAddMatch = () => {
        // Re-check at click time: cart state may have advanced since the
        // last render (rapid double-click, real-time sync, etc.). Same-size
        // duplicates get folded into a quantity bump by addToCart, so a
        // simple toast is the right response. Different-size duplicates
        // intentionally add a second cart line — they keep the explicit
        // "Add another pair" copy honest.
        if (matchAtSameSizeInCart) {
            addToast(
                `${match.name} (size ${matchSize}) already in cart. Set bonus locked in.`,
                'success'
            );
            return;
        }
        addToCart(match, matchSize);
        addToast(
            `Added ${match.name} (size ${matchSize}) — $30 set bonus will lock in at checkout.`,
            'success'
        );
    };

    return (
        <div className="pt-8 border-t border-white/10 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-accent" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                        Complete the Fit · Save ${setBonusDollars.toFixed(0)}
                    </h3>
                </div>
                <span className="border border-brand-accent/40 bg-brand-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                    Set Bonus
                </span>
            </div>

            <div className="border border-brand-accent/30 bg-gradient-to-br from-brand-accent/[0.08] via-transparent to-transparent p-4 transition-all hover:border-brand-accent/60">
                <div className="flex items-center gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden border border-white/10 bg-white">
                        <img
                            src={getProductImage(matchImage, 'thumb')}
                            srcSet={getProductImageSrcSet(matchImage)}
                            sizes={PRODUCT_IMAGE_SIZES.thumb}
                            alt={match.name}
                            width={120}
                            height={150}
                            loading="lazy"
                            fetchPriority="auto"
                            decoding="async"
                            onError={(event) => {
                                const img = event.currentTarget;
                                if (img.getAttribute('data-fallback-applied') === '1') return;
                                img.setAttribute('data-fallback-applied', '1');
                                img.src = matchImage;
                                img.removeAttribute('srcset');
                            }}
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Pair With
                        </p>
                        <Link
                            to={matchHref}
                            className="block text-sm font-bold uppercase tracking-widest text-white transition-colors hover:text-brand-accent"
                        >
                            {match.name}
                        </Link>
                        <p className="text-xs text-gray-400">
                            ${match.price.toFixed(2)} individually
                        </p>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                            Solo Total
                        </p>
                        <p
                            className="mt-1 text-sm font-bold uppercase tracking-widest text-gray-500 line-through"
                            aria-label={`Original solo total $${soloTotal.toFixed(2)}`}
                        >
                            ${soloTotal.toFixed(2)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                            Set Price (-${setBonusDollars.toFixed(0)})
                        </p>
                        <p className="mt-1 text-sm font-bold uppercase tracking-widest text-white">
                            ${setPrice.toFixed(2)}
                        </p>
                    </div>
                </div>

                {matchAtSameSizeInCart ? (
                    <div className="mt-4 flex items-center justify-center gap-2 border border-green-500/40 bg-green-500/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-green-300">
                        <Check className="h-4 w-4" />
                        {matchShortLabel} (size {matchSize}) in cart · set bonus locked in
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={handleAddMatch}
                        className="group mt-4 flex w-full items-center justify-center gap-3 bg-brand-accent py-3.5 px-6 text-xs font-bold uppercase tracking-[0.2em] text-white transition-all hover:bg-white hover:text-black"
                        aria-label={
                            matchAlreadyInCart
                                ? `Add another ${match.name} at size ${matchSize} to your cart`
                                : `Add ${match.name} to complete the fit and save $${setBonusDollars.toFixed(0)}`
                        }
                    >
                        {matchAlreadyInCart ? (
                            <>
                                <Plus className="h-4 w-4" />
                                Add Another {matchShortLabel} (size {matchSize})
                            </>
                        ) : (
                            <>
                                <ShoppingBag className="h-4 w-4" />
                                Add {matchShortLabel} · ${setPrice.toFixed(2)} for the Set (-${setBonusDollars.toFixed(0)})
                            </>
                        )}
                    </button>
                )}
                <Link
                    to={matchHref}
                    className="mt-3 block text-center text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 transition-colors hover:text-white"
                >
                    View {matchShortLabel} details →
                </Link>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                $30 savings auto-applied at checkout when both pieces are in cart.
            </p>
        </div>
    );
};

export default CompleteTheFit;
