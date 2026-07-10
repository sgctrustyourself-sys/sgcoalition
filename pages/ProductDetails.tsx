import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Shield, Plus, Trash2, X, Upload, ExternalLink, Smartphone, Scan, Heart, MessageSquare, ChevronLeft, ChevronRight, GripVertical, Star, CheckCircle2, Clock3, Ruler, Truck, Instagram } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { Product, AuthProvider } from '../types';
import ImpactMessage from '../components/ImpactMessage';
import RequestSimilarModal from '../components/RequestSimilarModal';
import ImageCropperModal from '../components/ui/ImageCropperModal';
import PageLoader from '../components/ui/PageLoader';
import Seo from '../components/Seo';
import { ethers } from 'ethers';
import { checkNftOwnership, switchToPolygon } from '../services/web3Service';
import { uploadProductImage } from '../services/productUpload';
import { moveArrayItem, remapIndexAfterMove } from '../utils/arrayMove';
import { getProductEditableSizes, normalizeProductSizeData } from '../utils/productSizes';
import { getReferralStats, generateProductReferralLink } from '../utils/referralSystem';
import { isWalletProduct, WALLET_KEYCHAIN_CLIP_LABEL, WALLET_KEYCHAIN_CLIP_PRICE } from '../utils/walletAddOns';
import { buildProductJsonLd, getProductSeo } from '../utils/seo';
import { isNumberedEdition, getActiveTierPrice } from '../types';
import { formatTierCalloutCopy } from '../services/numberedPieces';
import { Lock, Unlock, Loader } from 'lucide-react';

const formatProductDate = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { products, addToCart, isAdminMode, updateProduct, deleteProduct, user, toggleFavorite, loginUser, isLoading } = useApp();
    const { addToast } = useToast();

    // Derive the resolved product directly from context on every render.
    // No local copy = no risk of drift between context.products and a stale
    // local snapshot, and no `if (!product) return null` while products=[] on
    // the cold-load tick before AppContext finishes fetching.
    const product = React.useMemo(() => products.find(p => p.id === id), [products, id]);
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [includeKeychainClipOn, setIncludeKeychainClipOn] = useState(false);

    // Admin Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Product>>({});
    const [newImageUrl, setNewImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
    const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
    const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // NFT Unlock State
    const [isCheckingNft, setIsCheckingNft] = useState(false);
    const [nftOwned, setNftOwned] = useState(false);
    const [unlockMessage, setUnlockMessage] = useState('');

    const [showRequestModal, setShowRequestModal] = useState(false);
    const [referralCode, setReferralCode] = useState<string | null>(null);

    const handleUnlockPerks = async () => {
        if (!product?.nft) return;

        setIsCheckingNft(true);
        setUnlockMessage('');

        try {
            // 1. Ensure Wallet Connected
            let currentAddress = user?.walletAddress;
            if (!currentAddress) {
                // Trigger login if not connected
                await loginUser(AuthProvider.METAMASK);
                // We need to wait a bit or check if login was successful. 
                // For simplicity, we'll ask them to click again if not connected immediately.
                if (!window.ethereum?.selectedAddress) {
                    setUnlockMessage('Please connect your wallet to verify ownership.');
                    setIsCheckingNft(false);
                    return;
                }
                currentAddress = window.ethereum.selectedAddress;
            }

            // 2. Ensure Polygon Network
            const switched = await switchToPolygon();
            if (!switched) {
                setUnlockMessage('Please switch to Polygon network to verify.');
                setIsCheckingNft(false);
                return;
            }

            // 3. Check Ownership
            const provider = new ethers.BrowserProvider(window.ethereum);
            const isOwner = await checkNftOwnership(
                product.nft.contractAddress,
                product.nft.tokenId,
                currentAddress!,
                provider
            );

            if (isOwner) {
                setNftOwned(true);
                setUnlockMessage('≡ƒÄë Verified! You own this item.');
            } else {
                setNftOwned(false);
                setUnlockMessage('Γ¥î You do not own this NFT yet. Buy the shirt to claim it!');
            }

        } catch (error) {
            console.error('Unlock error:', error);
            setUnlockMessage('Error verifying ownership. Please try again.');
        } finally {
            setIsCheckingNft(false);
        }
    };

    // Reset transient browse state only when the resolved product id
    // changes. Keying on product?.id (rather than the full reference)
    // preserves the user's selected size / clip / drag indices across
    // realtime product refreshes emitted by AppContext.fetchProducts,
    // because those calls mint a new Product object reference for the
    // same id.
    useLayoutEffect(() => {
        if (!product) return;
        setSelectedSize(product.sizes?.[0] || '');
        setIncludeKeychainClipOn(false);
        setDraggedImageIndex(null);
        setDragOverImageIndex(null);
    }, [product?.id]);

    // Mirror the resolved product into the admin edit form whenever the
    // product reference changes. Kept separate from the browse-state
    // reset above so a realtime refresh only re-syncs the edit form and
    // does not stomp the shopper's in-progress selection.
    useLayoutEffect(() => {
        if (!product) return;
        setEditForm(product);
    }, [product]);

    // Redirect to /shop ONLY after initial loading finishes with no match.
    // Gating on `isLoading` keeps the cold-load race (products=[] while
    // AppContext still fetching) from bouncing the user off the page.
    useEffect(() => {
        if (isLoading) return;
        if (product) return;
        navigate('/shop', { replace: true });
    }, [isLoading, product, navigate]);

    useEffect(() => {
        let active = true;

        const loadReferralCode = async () => {
            if (!user?.uid) {
                if (active) {
                    setReferralCode(null);
                }
                return;
            }

            const stats = await getReferralStats(user.uid);
            if (!active) return;

            setReferralCode(stats?.referral_code ?? null);
        };

        loadReferralCode();

        return () => {
            active = false;
        };
    }, [user?.uid]);

    if (!product) return isLoading ? <PageLoader /> : null;

    const isFav = user?.favorites.includes(product.id);
    const walletProduct = isWalletProduct(product);
    const resolvedSize = selectedSize || (product.sizes?.length === 1 ? product.sizes[0] : '');
    // Numbered-edition tier pricing (supabase/migrations/20261101): compute
    // the live tier price from products.pricing_tiers crossed with
    // editionSoldCount (enriched by AppContext.fetchProducts via
    // get_product_paid_count). Server re-verifies at order-paid time in
    // api/complete-order.ts so a tampered client price can't bypass the gate.
    const isNumbered = isNumberedEdition(product);
    const soldCount = product.editionSoldCount ?? 0;
    const tierActivePrice = isNumbered ? getActiveTierPrice(product, soldCount) : null;
    const basePrice = tierActivePrice ?? product.price;
    const displayPrice = basePrice + (walletProduct && includeKeychainClipOn ? WALLET_KEYCHAIN_CLIP_PRICE : 0);
    const tierInfo = isNumbered ? formatTierCalloutCopy(product, soldCount) : null;
    const editableSizes = getProductEditableSizes(editForm.sizes, editForm.sizeInventory);
    const galleryImages = isEditing && editForm.images ? editForm.images : product.images;
    const shouldFitFullImage = product.id === 'prod_tee_above_as_below'
        || product.id === 'prod_shorts_above_as_below'
        || product.id === 'Coalition_Grey_Wave_Wallet_1_2'
        || product.id === 'Coalition_Grey_Wave_Wallet_2_2';
    const imageFrameClass = shouldFitFullImage ? 'bg-white' : 'bg-dark';
    const imageObjectClass = shouldFitFullImage ? 'object-contain' : 'object-cover';
    const totalStock = Object.values(product.sizeInventory || {}).reduce((sum, count) => sum + Number(count || 0), 0);
    const isArchived = Boolean(product.archived);
    const isSold = isArchived && !!product.soldAt;
    const isSoldOut = !isSold && totalStock === 0;
    const isUnavailable = isArchived || isSoldOut;
    const selectedSizeStock = resolvedSize ? product.sizeInventory?.[resolvedSize] ?? totalStock : totalStock;
    const soldDate = formatProductDate(product.soldAt);
    const availabilityLabel = isSold
        ? 'Sold'
        : isArchived
            ? 'Archived'
            : isSoldOut
            ? 'Sold Out'
            : product.isLimitedEdition
                ? 'Limited Run Available'
                : 'Available Now';
    const availabilityDetail = isSold
        ? soldDate ? `Sold ${soldDate}` : 'Archived piece'
        : isArchived
            ? 'Archived piece'
            : isSoldOut
            ? 'Request a similar custom'
            : totalStock <= 3
                ? `${totalStock} left total`
                : `${totalStock} available`;
    const selectedSizeDetail = isUnavailable
        ? product.sizes?.join(', ') || 'One Size'
        : `${selectedSize || resolvedSize || 'Select size'}${resolvedSize ? ` - ${selectedSizeStock} left` : ''}`;
    const shippingDetail = isArchived
        ? 'This exact piece is archived'
        : product.freeShipping
            ? 'Free shipping on this item'
            : displayPrice >= 200
                ? 'Free shipping unlocked'
                : 'Ships in 1-2 business days';
    const makingVideoUrl = product.makingVideoUrl?.trim();
    const productSeo = getProductSeo(product);
    const productJsonLd = buildProductJsonLd(product);

    const handleSave = () => {
        if (editForm.id) {
            const normalizedSizes = normalizeProductSizeData(editForm.sizes, editForm.sizeInventory);
            updateProduct({
                ...(editForm as Product),
                sizes: normalizedSizes.sizes,
                sizeInventory: normalizedSizes.sizeInventory,
            });
            setIsEditing(false);
        }
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setPendingCropFile(null);
        setUploadError('');
        setDraggedImageIndex(null);
        setDragOverImageIndex(null);
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            deleteProduct(product.id);
            navigate('/shop');
        }
    };

    const addImage = () => {
        if (newImageUrl) {
            setEditForm({ ...editForm, images: [...(editForm.images || []), newImageUrl] });
            setNewImageUrl('');
        }
    };

    const updateEditImages = (updater: (images: string[]) => string[]) => {
        setEditForm(prev => {
            const currentImages = prev.images || [];
            return {
                ...prev,
                images: updater(currentImages),
            };
        });
    };

    const reorderEditImages = (fromIndex: number, toIndex: number) => {
        updateEditImages(images => moveArrayItem(images, fromIndex, toIndex));
        setActiveImageIndex(prev => remapIndexAfterMove(prev, fromIndex, toIndex));
    };

    const moveImage = (index: number, direction: -1 | 1) => {
        const targetIndex = index + direction;
        const images = editForm.images || [];
        if (targetIndex < 0 || targetIndex >= images.length) return;
        reorderEditImages(index, targetIndex);
    };

    const promoteImage = (index: number) => {
        reorderEditImages(index, 0);
    };

    const handleImageDragStart = (index: number) => {
        setDraggedImageIndex(index);
    };

    const handleImageDragOver = (event: React.DragEvent<HTMLDivElement>, index: number) => {
        if (draggedImageIndex === null || draggedImageIndex === index) return;
        event.preventDefault();
        setDragOverImageIndex(index);
    };

    const handleImageDrop = (index: number) => {
        if (draggedImageIndex === null || draggedImageIndex === index) {
            setDraggedImageIndex(null);
            setDragOverImageIndex(null);
            return;
        }

        reorderEditImages(draggedImageIndex, index);
        setDraggedImageIndex(null);
        setDragOverImageIndex(null);
    };

    const handleImageDragEnd = () => {
        setDraggedImageIndex(null);
        setDragOverImageIndex(null);
    };

    const removeImage = (index: number) => {
        if (editForm.images) {
            const newImages = editForm.images.filter((_, i) => i !== index);
            setEditForm({ ...editForm, images: newImages });
            setActiveImageIndex(prev => {
                if (newImages.length === 0) return 0;
                if (prev === index) return Math.max(0, Math.min(index, newImages.length - 1));
                if (prev > index) return prev - 1;
                return Math.min(prev, newImages.length - 1);
            });
            if (draggedImageIndex !== null && draggedImageIndex === index) {
                setDraggedImageIndex(null);
            }
            setDragOverImageIndex(null);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setUploadError('Please select an image file (JPG, PNG, GIF, WebP)');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        setUploadError('');
        setPendingCropFile(file);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleCroppedImageUpload = async (croppedFile: File) => {
        setIsUploading(true);
        setUploadError('');

        try {
            const uploadedUrl = await uploadProductImage(croppedFile, editForm.name || product.name || 'product');
            setEditForm(prev => ({
                ...prev,
                images: [...(prev.images || []), uploadedUrl]
            }));
            setPendingCropFile(null);
        } catch (error) {
            console.error('Cropped upload failed:', error);
            setUploadError(error instanceof Error ? error.message : 'Failed to upload the cropped image.');
            throw error;
        } finally {
            setIsUploading(false);
        }
    };

    const cancelCrop = () => {
        setPendingCropFile(null);
        setUploadError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleShare = async () => {
        if (!product) return;
        const url = referralCode
            ? generateProductReferralLink(referralCode, product.id)
            : window.location.href;
        const shareText = referralCode
            ? `Check out ${product.name} on SG Coalition. This link includes my Coalition referral code if you decide to pick it up.`
            : `Check out ${product.name} on SG Coalition!`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `SG Coalition - ${product.name}`,
                    text: shareText,
                    url: url
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                addToast(referralCode ? 'Referral product link copied!' : 'Product link copied!', 'success');
            } catch (error) {
                console.error('Error copying to clipboard:', error);
                addToast('Unable to copy the product link right now.', 'error');
            }
        }
    };

    return (
        <>
            <Seo
                title={productSeo.title}
                description={productSeo.description}
                image={productSeo.image}
                type="product"
                canonicalPath={productSeo.path}
                jsonLd={productJsonLd}
            />
            <div className="pt-24 pb-16 min-h-screen bg-black text-chrome">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <button onClick={() => navigate(-1)} className="flex items-center text-sm text-gray-500 hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Image Gallery */}
                    <div className="space-y-4">
                        <div className={`aspect-[4/5] ${imageFrameClass} overflow-hidden rounded-sm relative border border-white/5 box-glow`}>
                            <img
                                src={galleryImages[activeImageIndex]}
                                alt={product.name}
                                className={`w-full h-full ${imageObjectClass} opacity-90 hover:opacity-100 transition-opacity`}
                            />
                            <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
                                <span className={`border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] backdrop-blur-md ${
                                    isUnavailable
                                        ? 'border-red-500/40 bg-red-500/20 text-red-200'
                                        : 'border-green-500/30 bg-green-500/15 text-green-300'
                                }`}>
                                    {availabilityLabel}
                                </span>
                                {product.isLimitedEdition && (
                                    <span className="border border-brand-accent/40 bg-brand-accent/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent backdrop-blur-md">
                                        Limited
                                    </span>
                                )}
                            </div>
                            <div className="absolute bottom-4 left-4 border border-white/10 bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md">
                                Image {activeImageIndex + 1} / {galleryImages.length}
                            </div>
                            {user && (
                                <button
                                    onClick={() => toggleFavorite(product.id)}
                                    className="absolute top-4 right-4 p-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-full hover:bg-white hover:text-black transition-all shadow-lg"
                                    title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                                >
                                    <Heart className={`w-5 h-5 ${isFav ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                                </button>
                            )}
                        </div>
                        {/* Thumbnails */}
                        <div className="flex space-x-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-800">
                            {galleryImages.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveImageIndex(idx)}
                                    className={`relative w-24 h-28 flex-shrink-0 overflow-hidden rounded-sm border-2 transition-all ${shouldFitFullImage ? 'bg-white' : ''} ${activeImageIndex === idx ? 'border-brand-accent' : 'border-white/10 opacity-50 hover:opacity-100'}`}
                                >
                                    <img src={img} alt={`View ${idx + 1}`} className={`w-full h-full ${imageObjectClass}`} />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Info */}
                    <div className="space-y-8">
                        {isAdminMode && isEditing ? (
                            <div className="bg-brand-dark p-6 rounded-lg space-y-4 border border-white/10 antigravity-card">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold uppercase flex items-center text-white"><Shield className="w-4 h-4 mr-2 text-brand-accent" /> Edit Product</h3>
                                    <button onClick={cancelEditing} className="text-xs text-brand-accent underline">Cancel</button>
                                </div>

                                <div>
                                    <label htmlFor="product-name" className="block text-xs font-bold uppercase text-gray-500 mb-1">Name</label>
                                    <input
                                        id="product-name"
                                        className="w-full p-3 bg-black border border-white/10 rounded-sm text-white focus:border-brand-accent outline-none"
                                        value={editForm.name || ''}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        placeholder="Product Name"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="product-price" className="block text-xs font-bold uppercase text-gray-500 mb-1">Price</label>
                                        <input
                                            id="product-price"
                                            type="number"
                                            className="w-full p-3 bg-black border border-white/10 rounded-sm text-white focus:border-brand-accent outline-none"
                                            value={editForm.price || 0}
                                            onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Size Inventory</label>
                                    <div className="space-y-2">
                                            {editableSizes.map((size) => (
                                                <div key={size} className="flex items-center gap-2">
                                                    <label htmlFor={`size-inv-${size}`} className="w-12 text-xs font-bold text-gray-400">{size}:</label>
                                                    <input
                                                        id={`size-inv-${size}`}
                                                        type="number"
                                                        value={editForm.sizeInventory?.[size] || 0}
                                                        onChange={(e) => {
                                                            const newInventory = { ...(editForm.sizeInventory || {}) };
                                                            newInventory[size] = parseInt(e.target.value) || 0;
                                                            setEditForm({ ...editForm, sizeInventory: newInventory });
                                                        }}
                                                        className="flex-1 p-2 bg-black border border-white/10 rounded-sm text-white focus:border-brand-accent outline-none"
                                                        min="0"
                                                        title={`Inventory for ${size}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="product-desc" className="block text-xs font-bold uppercase text-gray-500 mb-1">Description</label>
                                    <textarea
                                        id="product-desc"
                                        className="w-full p-3 bg-black border border-white/10 rounded-sm text-white focus:border-brand-accent outline-none h-32"
                                        value={editForm.description || ''}
                                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    />
                                </div>

                                {/* Image Management */}
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Images</label>

                                    {/* URL Input */}
                                    <div className="flex space-x-2 mb-2">
                                        <input
                                            className="flex-1 p-3 bg-black border border-white/10 rounded-sm text-white focus:border-brand-accent outline-none text-sm"
                                            placeholder="Image URL"
                                            value={newImageUrl}
                                            onChange={e => setNewImageUrl(e.target.value)}
                                        />
                                        <button onClick={addImage} className="bg-white/10 px-4 rounded-sm hover:bg-white/20 transition-colors" title="Add from URL">
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {/* File Upload */}
                                    <div className="mb-4">
                                        <input
                                            id="product-image-upload"
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                            title="Select image file"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="w-full bg-brand-accent text-white px-4 py-3 rounded-sm hover:brightness-110 disabled:bg-gray-800 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider transition-all"
                                        >
                                            <Upload className="w-4 h-4" />
                                            {isUploading ? 'Applying Crop...' : 'Upload & Crop from PC'}
                                        </button>
                                        <p className="text-[10px] text-gray-500 mt-2 text-center uppercase tracking-widest font-bold">Drag, zoom, and crop to frame before upload</p>
                                        {uploadError && (
                                            <p className="text-[10px] text-red-400 mt-2 text-center">{uploadError}</p>
                                        )}
                                    </div>

                                    {/* Image Grid */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {editForm.images?.map((img, idx) => {
                                            const isPrimary = idx === 0;
                                            const isDragged = draggedImageIndex === idx;
                                            const isDropTarget = dragOverImageIndex === idx;

                                            return (
                                                <div
                                                    key={`${img}-${idx}`}
                                                    draggable
                                                    onDragStart={() => handleImageDragStart(idx)}
                                                    onDragOver={(event) => handleImageDragOver(event, idx)}
                                                    onDrop={() => handleImageDrop(idx)}
                                                    onDragEnd={handleImageDragEnd}
                                                    className={`relative group aspect-[4/5] overflow-hidden rounded-sm border transition ${isDropTarget
                                                        ? 'border-brand-accent ring-2 ring-brand-accent/40'
                                                        : 'border-white/10'
                                                        } ${isDragged ? 'opacity-50 scale-[0.98]' : ''}`}
                                                    title="Drag to reorder"
                                                >
                                                    <img src={img} alt={`Product thumbnail ${idx + 1}`} className="w-full h-full object-cover" />

                                                    <div className="absolute left-1 top-1 flex items-center gap-1">
                                                        <span className="rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                                                            #{idx + 1}
                                                        </span>
                                                        {isPrimary && (
                                                            <span className="rounded-full border border-brand-accent/30 bg-brand-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                                                                Primary
                                                            </span>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => removeImage(idx)}
                                                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"
                                                        title="Remove Image"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>

                                                    <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 opacity-0 transition group-hover:opacity-100">
                                                        <button
                                                            type="button"
                                                            onClick={() => moveImage(idx, -1)}
                                                            disabled={idx === 0}
                                                            className="flex h-7 flex-1 items-center justify-center rounded-md border border-white/10 bg-black/80 text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                                            title="Move earlier"
                                                        >
                                                            <ChevronLeft className="h-3 w-3" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => promoteImage(idx)}
                                                            disabled={idx === 0}
                                                            className="flex h-7 flex-1 items-center justify-center rounded-md border border-white/10 bg-black/80 text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                                            title="Set as primary"
                                                        >
                                                            <Star className={`h-3 w-3 ${isPrimary ? 'fill-brand-accent text-brand-accent' : ''}`} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => moveImage(idx, 1)}
                                                            disabled={idx === (editForm.images?.length || 0) - 1}
                                                            className="flex h-7 flex-1 items-center justify-center rounded-md border border-white/10 bg-black/80 text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                                            title="Move later"
                                                        >
                                                            <ChevronRight className="h-3 w-3" />
                                                        </button>
                                                    </div>

                                                    <div className="absolute bottom-1 left-1 rounded-full border border-white/10 bg-black/70 p-1 text-gray-300 opacity-0 transition group-hover:opacity-100">
                                                        <GripVertical className="h-3 w-3" />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-center">
                                        Drag tiles or use the arrows to reorder. The first image is the cover.
                                    </p>
                                </div>

                                <div className="flex space-x-2 pt-4">
                                    <button onClick={handleSave} className="flex-1 bg-white text-black py-3 font-bold uppercase text-xs tracking-[0.2em] hover:bg-gray-200 transition-all box-glow">Save Changes</button>
                                    <button onClick={handleDelete} className="px-4 border border-red-500 text-red-500 hover:bg-red-500/10 transition-colors" title="Delete Product"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <h1 className="text-4xl md:text-5xl font-display font-bold text-white uppercase tracking-tight text-glow">{product.name}</h1>
                                        </div>
                                        {isAdminMode && (
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="ml-4 text-[10px] bg-white/10 px-4 py-2 rounded-full font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all border border-white/10 flex items-center"
                                            >
                                                <Shield className="w-3 h-3 mr-2" /> Edit
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-2">
                                        <span className={`inline-flex items-center border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                                            isUnavailable
                                                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                                                : 'border-green-500/30 bg-green-500/10 text-green-300'
                                        }`}>
                                            <CheckCircle2 className="mr-1.5 h-3 w-3" />
                                            {availabilityLabel}
                                        </span>
                                        {product.isLimitedEdition && (
                                            <span className="inline-flex items-center border border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                                                Limited Edition
                                            </span>
                                        )}
                                        {product.archived && (
                                            <span className="inline-flex items-center border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-300">
                                                Archive Piece
                                            </span>
                                        )}
                                        {isNumbered && (
                                            <span className="inline-flex items-center border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300">
                                                Numbered Edition
                                            </span>
                                        )}
                                    </div>
                                    {tierInfo && (
                                        <div className="border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-200 space-y-1">
                                            <div className="text-yellow-300">{tierInfo.headline}</div>
                                            {tierInfo.subline && (
                                                <div className="text-[10px] text-yellow-200/80 font-bold uppercase tracking-[0.18em]">
                                                    {tierInfo.subline}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        <p className="text-3xl text-brand-accent font-bold font-mono tracking-tighter">${displayPrice}</p>
                                        {product.freeShipping && (
                                            <p className="inline-flex border border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                                                Free Shipping
                                            </p>
                                        )}
                                        {walletProduct && includeKeychainClipOn && (
                                            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">
                                                Base ${product.price} + {WALLET_KEYCHAIN_CLIP_LABEL} ${WALLET_KEYCHAIN_CLIP_PRICE}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 border-y border-white/10 py-5 sm:grid-cols-3">
                                    <div className="flex gap-3">
                                        <CheckCircle2 className={`mt-0.5 h-4 w-4 ${isUnavailable ? 'text-red-300' : 'text-green-300'}`} />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Status</p>
                                            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-white">{availabilityDetail}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Ruler className="mt-0.5 h-4 w-4 text-brand-accent" />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Size / Stock</p>
                                            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-white">{selectedSizeDetail}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <Truck className="mt-0.5 h-4 w-4 text-brand-accent" />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Fulfillment</p>
                                            <p className="mt-1 text-sm font-bold uppercase tracking-widest text-white">{shippingDetail}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-white/10">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Description</h3>
                                    <div className="prose prose-invert prose-sm text-gray-400 leading-relaxed font-light">
                                        <p className="text-base">{product.description}</p>
                                    </div>
                                    {makingVideoUrl && (
                                        <a
                                            href={makingVideoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-5 inline-flex max-w-full items-center gap-3 border border-brand-accent/30 bg-brand-accent/10 px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] text-brand-accent transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
                                        >
                                            <Instagram className="h-4 w-4 shrink-0" />
                                            <span className="min-w-0 break-words">Watch It Being Made</span>
                                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                        </a>
                                    )}
                                </div>

                                {isSold ? (
                                    <div className="pt-8 space-y-4 border-t border-white/10">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Archived Size</h3>
                                        <div className="border border-white/10 bg-white/5 p-4">
                                            <p className="text-sm font-bold uppercase tracking-widest text-white">
                                                {product.sizes?.join(', ') || 'One Size'}
                                            </p>
                                            <p className="mt-2 text-sm leading-relaxed text-gray-400">
                                                This exact piece is sold. Use request similar to start a new version based on the same direction.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-8 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Select Size</h3>
                                            <a href="#" className="text-xs font-bold uppercase tracking-widest text-brand-accent hover:text-white transition-colors border-b border-brand-accent/30 hover:border-white">Size guide</a>
                                        </div>

                                        {product.sizes && product.sizes.length === 1 && product.sizes[0].toLowerCase().includes('one') ? (
                                            <div className="bg-white/5 border border-brand-accent/30 p-4 rounded-sm flex items-center justify-between">
                                                <span className="text-sm font-bold uppercase tracking-widest text-white">ORDERING {product.sizes[0]}</span>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest py-1 px-2 rounded ${isSoldOut ? 'bg-red-500/10 text-red-300' : 'bg-green-500/10 text-green-500'}`}>
                                                    {isSoldOut ? 'SOLD OUT' : `${product.sizeInventory?.[product.sizes[0]] || 0} LEFT`}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-4 gap-3">
                                                {product.sizes?.map((size) => {
                                                    const sizeStock = product.sizeInventory?.[size] || 0;
                                                    const isOutOfStock = sizeStock === 0;
                                                    const isSelected = selectedSize === size;
                                                    return (
                                                        <button
                                                            key={size}
                                                            onClick={() => !isOutOfStock && setSelectedSize(size)}
                                                            disabled={isOutOfStock}
                                                            className={`group relative border py-4 flex flex-col items-center justify-center text-xs font-bold uppercase tracking-widest transition-all duration-200 ${isSelected
                                                                ? 'bg-white text-black border-white ring-2 ring-white/20'
                                                                : isOutOfStock
                                                                    ? 'border-white/5 bg-white/5 text-gray-600 cursor-not-allowed'
                                                                    : 'border-white/10 text-white hover:border-white hover:bg-white/5'
                                                                }`}
                                                            title={isOutOfStock ? 'Out of stock' : `${sizeStock} in stock`}
                                                        >
                                                            <span>{size}</span>
                                                            <span className={`text-[9px] mt-1 ${isSelected ? 'text-black/60' : isOutOfStock ? 'text-red-500/50' : sizeStock < 5 ? 'text-yellow-500' : 'text-brand-accent'}`}>
                                                                {isOutOfStock ? 'OUT' : `${sizeStock} left`}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {walletProduct && !isUnavailable && (
                                    <div className="pt-8 space-y-4 border-t border-white/10">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Optional Add-On</h3>
                                            <span className="text-xs font-bold uppercase tracking-widest text-brand-accent">+${WALLET_KEYCHAIN_CLIP_PRICE}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIncludeKeychainClipOn(prev => !prev)}
                                            className={`w-full border p-4 text-left transition-all ${
                                                includeKeychainClipOn
                                                    ? 'border-brand-accent bg-brand-accent/10'
                                                    : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-bold uppercase tracking-widest text-white">
                                                        Add {WALLET_KEYCHAIN_CLIP_LABEL}
                                                    </p>
                                                    <p className="mt-2 text-sm leading-relaxed text-gray-400">
                                                        Add a hardware clip-on so the wallet can hang from keys, belt loops, or everyday carry setups.
                                                    </p>
                                                </div>
                                                <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                                                    includeKeychainClipOn
                                                        ? 'border-brand-accent/40 bg-brand-accent text-white'
                                                        : 'border-white/10 bg-black/40 text-gray-400'
                                                }`}>
                                                    {includeKeychainClipOn ? 'Added' : 'Available'}
                                                </span>
                                            </div>
                                        </button>
                                    </div>
                                )}

                                <div className="pt-10 flex flex-col gap-4">
                                    {isUnavailable ? (
                                        /* Sold / Archived State */
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-start gap-3 border border-red-500/30 bg-red-500/10 px-4 py-4">
                                                <Clock3 className="mt-0.5 h-4 w-4 text-red-300" />
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">
                                                        {isSold ? 'Sold - This exact item is no longer available' : 'Sold out - Request the next version'}
                                                    </p>
                                                    <p className="mt-2 text-sm leading-relaxed text-gray-300">
                                                        {isSold
                                                            ? 'The original piece stays visible as part of the Coalition archive.'
                                                            : 'This drop has no remaining inventory, but a similar custom can be requested.'}
                                                    </p>
                                                </div>
                                            </div>
                                            {product.archiveNote && (
                                                <div className="border border-white/10 bg-white/5 px-4 py-5">
                                                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-accent mb-3">
                                                        Coalition Note
                                                    </p>
                                                    <p className="text-sm leading-relaxed text-gray-300">
                                                        {product.archiveNote}
                                                    </p>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => setShowRequestModal(true)}
                                                aria-label="Request similar style"
                                                className="group relative w-full bg-white text-transparent py-4 px-8 flex items-center justify-center text-sm font-bold uppercase tracking-[0.2em] hover:bg-brand-accent transition-all"
                                            >
                                                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-black transition-colors group-hover:text-white">
                                                    Request Similar Style
                                                </span>
                                            </button>
                                            <a
                                                href="/archive"
                                                aria-label="View all archive"
                                                className={`relative py-2 text-center text-xs text-transparent uppercase tracking-widest transition-colors ${isSold ? '' : 'hidden'}`}
                                            >
                                                <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-gray-500 transition-colors hover:text-white">
                                                    View All Archive
                                                </span>
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => addToCart(product, resolvedSize, { keychainClipOn: includeKeychainClipOn })}
                                                disabled={(!selectedSize && (product.sizes?.length || 0) > 1) || totalStock === 0}
                                                className="flex-1 bg-white text-black py-4 px-8 flex items-center justify-center text-sm font-bold uppercase tracking-[0.2em] hover:bg-brand-accent hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-black disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed box-glow"
                                            >
                                                {totalStock === 0 ? 'SOLD OUT' : (selectedSize || (product.sizes?.length === 1) ? `Add to bag${walletProduct && includeKeychainClipOn ? ' + clip-on' : ''}` : 'Select a size')}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleShare}
                                                className="p-4 bg-white/5 border border-white/10 rounded-sm hover:bg-white/10 hover:border-white/20 transition-all group"
                                                title={referralCode ? 'Share referral product link' : 'Share Product'}
                                            >
                                                <Share2 className="h-5 w-5 text-white opacity-60 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        </div>
                                    )}
                                    <p className="text-[10px] text-gray-500 text-center uppercase tracking-[0.2em] font-bold py-2">
                                        {isUnavailable ? (
                                            <span>Request similar pieces with preferred timeline and budget</span>
                                        ) : (
                                            <><span className="text-white">FREE SHIPPING</span> ON ALL ORDERS OVER $200</>
                                        )}
                                    </p>

                                    {/* Local Impact Message */}
                                    <ImpactMessage className="mt-2" />

                                    {/* Founder's Note - anti-tricky-brand voice at the conviction moment.
                                        Renders only when product.founderNote is set and non-whitespace.
                                        Whitespace-pre-line preserves the founder's intentional line breaks. */}
                                    {product.founderNote?.trim() && (
                                        <div className="border border-brand-accent/20 bg-brand-accent/5 px-5 py-5 text-left">
                                            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-accent mb-3">
                                                From the Founder
                                            </p>
                                            <p className="text-sm md:text-base leading-relaxed text-gray-200 font-light whitespace-pre-line">
                                                {product.founderNote}
                                            </p>
                                        </div>
                                    )}

                                    {/* Reddit Community Banner */}
                                    {(() => {
                                        const redditLinks: Record<string, { url: string; label: string; description: string }> = {
                                            'Coalition_NF_Tee': {
                                                url: 'https://www.reddit.com/user/Complex-Discipline86/comments/1ri70fm/coalition_nftee_50/',
                                                label: 'View on Reddit',
                                                description: 'Check out the full Reddit listing for the Coalition NF-Tee — pricing, details, and community discussion.'
                                            }
                                        };
                                        const specificLink = product ? redditLinks[product.id] : null;
                                        const redditUrl = specificLink?.url || 'https://www.reddit.com/r/SGCoalition/';
                                        const redditLabel = specificLink?.label || 'Join Reddit';
                                        const redditDesc = specificLink?.description || 'Join r/SGCoalition on Reddit to discuss this piece, share how you style it, and connect with the Coalition.';

                                        return (
                                            <div className="mt-8 bg-gradient-to-r from-[#ff4500]/20 via-[#ff4500]/10 to-brand-accent/10 border border-[#ff4500]/30 rounded-sm p-6 relative overflow-hidden group hover:border-[#ff4500]/50 transition-all">
                                                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#ff4500]/10 rounded-full blur-3xl group-hover:bg-[#ff4500]/20 transition-all"></div>
                                                <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#ff4500] bg-[#ff4500]/10 px-2 py-1 rounded flex items-center">
                                                                <MessageSquare className="w-3 h-3 mr-1" /> {specificLink ? 'REDDIT LISTING' : 'COMMUNITY HUB'}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-white font-bold uppercase tracking-widest text-sm mb-1">{specificLink ? 'This item is listed on Reddit' : 'Have feedback or fit pics?'}</h4>
                                                        <p className="text-xs text-gray-400 font-light">{redditDesc}</p>
                                                    </div>
                                                    <a
                                                        href={redditUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-shrink-0 bg-[#ff4500] hover:bg-[#ff4500]/80 text-white px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-[0.2em] transition-colors flex items-center whitespace-nowrap shadow-[0_0_15px_rgba(255,69,0,0.3)] hover:shadow-[0_0_20px_rgba(255,69,0,0.5)]"
                                                    >
                                                        {redditLabel} <ExternalLink className="w-3 h-3 ml-2" />
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {product.nft && (
                                    <div className="mt-12 pt-8 border-t border-white/10">
                                        <h3 className="font-display text-xl font-bold uppercase mb-6 flex items-center text-white text-glow">
                                            <Scan className="w-5 h-5 mr-3 text-brand-accent" />
                                            Phy-gital Verification
                                        </h3>
                                        <div className="bg-white/5 rounded-sm p-6 border border-white/10 antigravity-card space-y-6">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 mr-3 animate-pulse"></span>
                                                    <span className="text-xs font-bold text-white uppercase tracking-widest">On-Chain Asset</span>
                                                </div>
                                                <span className="text-[10px] bg-brand-accent/20 text-brand-accent border border-brand-accent/30 px-3 py-1 rounded-full font-bold uppercase tracking-widest">{product.nft.chain}</span>
                                            </div>

                                            <div className="text-sm text-gray-400 font-light">
                                                <p className="mb-4">This item contains a cryptographic signature. Verify authenticity and claim ownership via the embedded NFC tags.</p>
                                                <a
                                                    href={product.nft.openseaUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center text-brand-accent hover:text-white font-bold text-xs uppercase tracking-widest transition-colors group"
                                                >
                                                    View Collection <ExternalLink className="w-3 h-3 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                                </a>
                                            </div>

                                            {product.nft.nfcTags && (
                                                <div className="pt-6 border-t border-white/10">
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-4 flex items-center tracking-widest">
                                                        <Smartphone className="w-3 h-3 mr-2 text-brand-accent" /> Secure NFC Integration
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                                        <div className="bg-black border border-white/5 p-4 rounded-sm text-center hover:border-brand-accent/50 transition-colors cursor-help group" title="Scan the tag on the neck label">
                                                            <p className="text-xs font-bold text-white uppercase tracking-widest mb-1 group-hover:text-brand-accent">Neck Tag</p>
                                                            <p className="text-[9px] text-gray-500 uppercase tracking-tighter">Identity / Info</p>
                                                        </div>
                                                        <div className="bg-black border border-white/5 p-4 rounded-sm text-center hover:border-brand-accent/50 transition-colors cursor-help group" title="Scan the tag on the bottom hem">
                                                            <p className="text-xs font-bold text-white uppercase tracking-widest mb-1 group-hover:text-brand-accent">Side Tag</p>
                                                            <p className="text-[9px] text-gray-500 uppercase tracking-tighter">Ownership / Proof</p>
                                                        </div>
                                                    </div>

                                                    {/* Unlock Section */}
                                                    <div className="bg-black/50 p-5 rounded-sm border border-brand-accent/20 shadow-inner">
                                                        <h4 className="font-bold text-sm uppercase tracking-widest mb-4 flex items-center text-white">
                                                            {nftOwned ? <Unlock className="w-4 h-4 mr-3 text-green-500" /> : <Lock className="w-4 h-4 mr-3 text-brand-accent opacity-50" />}
                                                            Owner Terminal
                                                        </h4>

                                                        {!nftOwned ? (
                                                            <div className="space-y-4">
                                                                <p className="text-xs text-gray-400 font-light leading-relaxed">
                                                                    Connect your verified wallet to unlock the holder-only terminal and redeem exclusive Coalition perks.
                                                                </p>
                                                                <button
                                                                    onClick={handleUnlockPerks}
                                                                    disabled={isCheckingNft}
                                                                    className="w-full bg-brand-accent text-white text-xs font-bold uppercase tracking-[0.2em] py-3 rounded-sm hover:brightness-110 transition-all flex items-center justify-center box-glow"
                                                                >
                                                                    {isCheckingNft ? (
                                                                        <>
                                                                            <Loader className="w-3 h-3 mr-2 animate-spin" /> Initializing...
                                                                        </>
                                                                    ) : (
                                                                        'Verify Ownership'
                                                                    )}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-green-500/5 p-4 rounded-sm border border-green-500/20 text-center space-y-3">
                                                                <p className="text-[10px] font-bold text-green-500 tracking-[0.3em] uppercase">ACCESS GRANTED</p>
                                                                <p className="text-lg font-mono text-white p-3 bg-black/50 rounded border border-white/5 select-all tracking-tighter">
                                                                    VIP-CODE-2024
                                                                </p>
                                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Holder-only discount active</p>
                                                            </div>
                                                        )}

                                                        {unlockMessage && !nftOwned && (
                                                            <div className={`mt-4 p-3 rounded-sm text-[10px] font-bold uppercase tracking-widest text-center ${unlockMessage.includes('Verified') ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                                {unlockMessage}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            <ImageCropperModal
                open={!!pendingCropFile}
                file={pendingCropFile}
                title="Crop Product Detail Image"
                description="Fine-tune this image before it is added to the gallery. Drag to align the subject and use the zoom slider to fill the frame."
                confirmLabel="Apply Crop"
                onCancel={cancelCrop}
                onConfirm={handleCroppedImageUpload}
            />
            {showRequestModal && product && (
                <RequestSimilarModal product={product} onClose={() => setShowRequestModal(false)} />
            )}
            </div>
        </>
    );
};

export default ProductDetails;
