import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import PriceDisplay from './PriceDisplay';
import UrgencyBadge from './ui/UrgencyBadge';
import { getStockUrgency, getStockCount, generateViewCount, getMintFraction } from '../utils/urgencyUtils';
import RequestSimilarModal from './RequestSimilarModal';
import { getProductImage, getProductImageSrcSet, getProductRoleImage, PRODUCT_IMAGE_SIZES } from '../utils/productImage';

interface ProductCardProps {
    product: Product;
    /**
     * Marks the LCP card. When true the browser fetches the primary image
     * eagerly with high fetchpriority and we drop decoding="async" so the
     * card paints without visual pop-in. Pass `true` only on the first card
     * of /shop, /home featured grid, the first search/wishlist/favorites card,
     * and the first "You may also like" recommendation.
     */
    priority?: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, priority = false }) => {
    const { addToCart, toggleFavorite, user } = useApp();
    const isFav = user?.favorites.includes(product.id);
    const isSold = product.archived && !!product.soldAt;
    const [showRequestModal, setShowRequestModal] = useState(false);
    // Role-aware reads: getProductRoleImage falls back to position-based
    // defaults when imageRoles isn't set, so products created before this
    // field still render correctly.
    const rolePrimary = getProductRoleImage(product, 'primary');
    const roleHover = getProductRoleImage(product, 'hover');
    const primaryImage = rolePrimary || (product.images && product.images.length > 0 ? product.images[0] : '/images/logo.png');
    const hoverImage = roleHover ?? primaryImage;
    const hasHoverImage = !!roleHover && hoverImage !== primaryImage;
    const shouldFitFullImage = product.id === 'prod_tee_above_as_below'
        || product.id === 'prod_shorts_above_as_below'
        || product.id === 'prod_hoodie_overwhelmingly_patient';
    const keepImageClear = product.id === 'Coalition_NF_Tee';
    const imageFrameClass = shouldFitFullImage ? 'bg-white' : 'bg-gray-900';
    const imageObjectClass = shouldFitFullImage ? 'object-contain' : 'object-cover';
    const hoverScaleClass = shouldFitFullImage ? 'group-hover:scale-[1.02]' : 'group-hover:scale-105';

    // Calculate urgency metrics
    const stockUrgency = getStockUrgency(product);
    const stockCount = getStockCount(product);
    const mintFraction = getMintFraction(product);
    const viewCount = generateViewCount(product);
    const showLowStock = stockUrgency !== 'normal' && !product.archived;

    const cardLink = `/product/${product.id}`;

    // Supabase image transforms (/storage/v1/render/image/...) are Pro-plan and
    // can 4xx if disabled. Each <img> gets its own inline onError so the
    // fallback swaps to THAT image's raw URL, not the card's primary image.
    // A dataset flag guards against an infinite loop if the raw URL itself 404s.
    const handlePrimaryError = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const img = event.currentTarget;
        if (img.dataset.fallbackApplied === '1') return;
        img.dataset.fallbackApplied = '1';
        img.src = primaryImage;
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
    };
    const handleHoverError = (event: React.SyntheticEvent<HTMLImageElement>) => {
        const img = event.currentTarget;
        if (img.dataset.fallbackApplied === '1') return;
        img.dataset.fallbackApplied = '1';
        img.src = hoverImage;
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
    };

    return (
        <>
            <div className={`group relative bg-transparent ${isSold ? 'opacity-60' : ''}`}>
                <div className={`aspect-[4/5] overflow-hidden ${imageFrameClass} relative border border-white/5`}>
                    <img
                        src={getProductImage(primaryImage, 'card')}
                        srcSet={getProductImageSrcSet(primaryImage)}
                        sizes={PRODUCT_IMAGE_SIZES.card}
                        alt={product.name}
                        width={800}
                        height={1000}
                        loading={priority ? 'eager' : 'lazy'}
                        fetchPriority={priority ? 'high' : 'auto'}
                        decoding={priority ? 'sync' : 'async'}
                        onError={handlePrimaryError}
                        className={`absolute inset-0 h-full w-full ${imageObjectClass} object-center transition duration-700 ease-in-out ${
                            hasHoverImage ? 'opacity-100 group-hover:opacity-0' : `${hoverScaleClass} group-hover:grayscale`
                        }`}
                    />
                    {hasHoverImage && (
                        <img
                            src={getProductImage(hoverImage, 'gallery')}
                            srcSet={getProductImageSrcSet(hoverImage)}
                            sizes={PRODUCT_IMAGE_SIZES.card}
                            alt={`${product.name} alternate view`}
                            width={800}
                            height={1000}
                            loading="lazy"
                            fetchPriority="auto"
                            decoding="async"
                            onError={handleHoverError}
                            className={`absolute inset-0 h-full w-full ${imageObjectClass} object-center opacity-0 group-hover:opacity-100 ${hoverScaleClass} transition duration-700 ease-in-out`}
                        />
                    )}
                    {isSold && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                            <span className="bg-black border border-white/30 text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-widest">
                                SOLD
                            </span>
                        </div>
                    )}
                    {!keepImageClear && (product.nft || product.isLimitedEdition || product.editionSize || showLowStock) && (
                        <div className="absolute top-2 left-2 z-20 flex flex-col items-start gap-1.5">
                            {product.nft && !isSold && (
                                <div className="bg-black/80 backdrop-blur border border-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
                                    <span className="text-brand-accent">*</span>
                                    Digital Twin
                                </div>
                            )}
                            {/* Numbered-edition tier badge (X/44 minted). Pulls the edition
                                sold count from product.editionSoldCount when set, otherwise
                                renders the cap as a static 'X/N' badge so unhydrated listings
                                still carry the marker before the first paid order lands. */}
                            {!isSold && product.editionSize ? (
                                <div className="bg-black/80 backdrop-blur border border-yellow-500/40 text-yellow-300 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    {product.editionSoldCount != null
                                        ? `${Math.min(product.editionSoldCount, product.editionSize)}/${product.editionSize}`
                                        : `${product.editionSize}/${product.editionSize} EDITION`}
                                    {product.pricingTiers?.length ? (
                                        <span className="ml-2 text-yellow-400/80">
                                            ${product.pricingTiers[0]?.price ?? product.price}
                                        </span>
                                    ) : null}
                                </div>
                            ) : null}
                            {product.isLimitedEdition && mintFraction?.remaining !== 0 && (
                                <UrgencyBadge
                                    type="limited-edition"
                                    count={mintFraction?.remaining}
                                    cap={mintFraction?.cap}
                                />
                            )}
                            {showLowStock && (
                                <UrgencyBadge type="low-stock" count={stockCount} />
                            )}
                        </div>
                    )}

                    {user && (
                        <button
                            onClick={(e) => { e.preventDefault(); toggleFavorite(product.id); }}
                            className="absolute top-2 right-2 p-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-white hover:text-black transition-all border border-white/10"
                            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                        >
                            <Heart className={`w-4 h-4 ${isFav ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                        </button>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-4 z-10 translate-y-full group-hover:translate-y-0 transition duration-300 bg-gradient-to-t from-black via-black/80 to-transparent">
                        {isSold ? (
                            <div className="relative z-20 flex flex-col gap-1.5">
                                <Link
                                    to="/archive"
                                    onClick={(e) => e.stopPropagation()}
                                    className="block w-full bg-gray-700 text-gray-300 py-2 text-xs font-bold uppercase tracking-widest text-center hover:bg-gray-600 transition-colors"
                                >
                                    View in Archive
                                </Link>
                                <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowRequestModal(true); }}
                                    className="block w-full bg-white text-black py-2 text-xs font-bold uppercase tracking-widest text-center hover:bg-gray-200 transition-colors"
                                >
                                    Request Similar Style
                                </button>
                            </div>
                        ) : product.archived ? (
                            <div className="w-full bg-gray-700 text-gray-400 py-3 text-xs font-bold uppercase tracking-widest text-center cursor-not-allowed">
                                Archived
                            </div>
                        ) : (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    // Default size for quick add
                                    const size = product.sizes?.[0] || 'One Size';
                                    addToCart(product, size);
                                }}
                                className="w-full bg-white text-black py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors"
                            >
                                Quick Add
                            </button>
                        )}
                    </div>
                </div>
                <div className="mt-4 grid gap-3">
                    <div className="min-w-0">
                        <h3 className="text-sm text-white font-bold uppercase tracking-wide">
                            <Link to={cardLink}>
                                <span aria-hidden="true" className="absolute inset-0" />
                                {product.name}
                            </Link>
                        </h3>
                        <p className="mt-1 text-xs text-gray-500 uppercase tracking-widest">{product.category}</p>
                        {keepImageClear && (product.nft || product.isLimitedEdition || showLowStock) && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {product.nft && !isSold && (
                                    <span className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                                        <span className="text-brand-accent">*</span>
                                        Digital Twin
                                    </span>
                                )}
                                {product.isLimitedEdition && mintFraction?.remaining !== 0 && (
                                    <UrgencyBadge
                                        type="limited-edition"
                                        count={mintFraction?.remaining}
                                        cap={mintFraction?.cap}
                                    />
                                )}
                                {showLowStock && (
                                    <UrgencyBadge type="low-stock" count={stockCount} />
                                )}
                            </div>
                        )}
                        {product.freeShipping && (
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-brand-accent">Free Shipping</p>
                        )}
                    </div>
                    <PriceDisplay basePrice={product.price} size="small" showDiscount={true} className="w-full max-w-full" />
                </div>
            </div>
            {
                showRequestModal && (
                    <RequestSimilarModal product={product} onClose={() => setShowRequestModal(false)} />
                )
            }
        </>
    );
};

export default React.memo(ProductCard);
