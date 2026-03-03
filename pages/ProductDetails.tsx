import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Shield, Plus, Trash2, X, Upload, ExternalLink, Smartphone, Scan, Heart, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product, AuthProvider } from '../types';
import ImpactMessage from '../components/ImpactMessage';
import { ethers } from 'ethers';
import { checkNftOwnership, switchToPolygon } from '../services/web3Service';
import { Lock, Unlock, Loader } from 'lucide-react';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { products, addToCart, isAdminMode, updateProduct, deleteProduct, user, toggleFavorite, loginUser } = useApp();

    const [product, setProduct] = useState<Product | undefined>(undefined);
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    // Admin Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Product>>({});
    const [newImageUrl, setNewImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // NFT Unlock State
    const [isCheckingNft, setIsCheckingNft] = useState(false);
    const [nftOwned, setNftOwned] = useState(false);
    const [unlockMessage, setUnlockMessage] = useState('');

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

    useEffect(() => {
        const found = products.find(p => p.id === id);
        if (found) {
            setProduct(found);
            setSelectedSize(found.sizes?.[0] || '');
            setEditForm(found);
        } else {
            navigate('/shop');
        }
    }, [id, products, navigate]);

    if (!product) return null;

    const isFav = user?.favorites.includes(product.id);

    const handleSave = () => {
        if (editForm.id) {
            updateProduct(editForm as Product);
            setIsEditing(false);
        }
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this product?')) {
            deleteProduct(product.id);
            navigate('/shop');
        }
    };

    const addImage = () => {
        if (newImageUrl && editForm.images) {
            setEditForm({ ...editForm, images: [...editForm.images, newImageUrl] });
            setNewImageUrl('');
        }
    };

    const removeImage = (index: number) => {
        if (editForm.images) {
            const newImages = editForm.images.filter((_, i) => i !== index);
            setEditForm({ ...editForm, images: newImages });
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (JPG, PNG, GIF, WebP)');
            return;
        }

        // Validate file size (2MB limit)
        if (file.size > 2 * 1024 * 1024) {
            alert('Image must be less than 2MB. Please choose a smaller file.');
            return;
        }

        setIsUploading(true);

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (editForm.images) {
                setEditForm({ ...editForm, images: [...editForm.images, base64] });
            }
            setIsUploading(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };
        reader.onerror = () => {
            alert('Error reading file. Please try again.');
            setIsUploading(false);
        };
        reader.readAsDataURL(file);
    };

    const handleShare = async () => {
        if (!product) return;
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `SG Coalition - ${product.name}`,
                    text: `Check out ${product.name} on SG Coalition!`,
                    url: url
                });
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                alert('Product link copied to clipboard!');
            } catch (error) {
                console.error('Error copying to clipboard:', error);
            }
        }
    };

    return (
        <div className="pt-24 pb-16 min-h-screen bg-black text-chrome">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <button onClick={() => navigate(-1)} className="flex items-center text-sm text-gray-500 hover:text-white mb-8 transition-colors">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Image Gallery */}
                    <div className="space-y-4">
                        <div className="aspect-[4/5] bg-dark overflow-hidden rounded-sm relative border border-white/5 box-glow">
                            <img
                                src={(isEditing && editForm.images ? editForm.images : product.images)[activeImageIndex]}
                                alt={product.name}
                                className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity"
                            />
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
                            {(isEditing && editForm.images ? editForm.images : product.images).map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveImageIndex(idx)}
                                    className={`relative w-24 h-28 flex-shrink-0 overflow-hidden rounded-sm border-2 transition-all ${activeImageIndex === idx ? 'border-brand-accent' : 'border-white/10 opacity-50 hover:opacity-100'}`}
                                >
                                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
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
                                    <button onClick={() => setIsEditing(false)} className="text-xs text-brand-accent underline">Cancel</button>
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
                                            {(editForm.sizes || ['S', 'M', 'L', 'XL']).map((size) => (
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
                                            {isUploading ? 'Uploading...' : 'Upload from PC'}
                                        </button>
                                        <p className="text-[10px] text-gray-500 mt-2 text-center uppercase tracking-widest font-bold">JPG, PNG, GIF, WebP ΓÇó Max 2MB</p>
                                    </div>

                                    {/* Image Grid */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {editForm.images?.map((img, idx) => (
                                            <div key={idx} className="relative group aspect-[4/5]">
                                                <img src={img} alt={`Product thumbnail ${idx + 1}`} className="w-full h-full object-cover rounded-sm border border-white/10" />
                                                <button
                                                    onClick={() => removeImage(idx)}
                                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"
                                                    title="Remove Image"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
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
                                    <p className="text-3xl text-brand-accent font-bold font-mono tracking-tighter">${product.price}</p>
                                </div>

                                <div className="pt-8 border-t border-white/10">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Description</h3>
                                    <div className="prose prose-invert prose-sm text-gray-400 leading-relaxed font-light">
                                        <p className="text-base">{product.description}</p>
                                    </div>
                                </div>

                                <div className="pt-8 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Select Size</h3>
                                        <a href="#" className="text-xs font-bold uppercase tracking-widest text-brand-accent hover:text-white transition-colors border-b border-brand-accent/30 hover:border-white">Size guide</a>
                                    </div>

                                    {product.sizes && product.sizes.length === 1 && product.sizes[0].toLowerCase().includes('one') ? (
                                        <div className="bg-white/5 border border-brand-accent/30 p-4 rounded-sm flex items-center justify-between">
                                            <span className="text-sm font-bold uppercase tracking-widest text-white">ORDERING {product.sizes[0]}</span>
                                            <span className="text-[10px] font-bold uppercase tracking-widest py-1 px-2 bg-green-500/10 text-green-500 rounded">
                                                {product.sizeInventory?.[product.sizes[0]] || 0} LEFT
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

                                <div className="pt-10 flex flex-col gap-4">
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => addToCart(product, selectedSize || (product.sizes?.length === 1 ? product.sizes[0] : ''))}
                                            disabled={!selectedSize && (product.sizes?.length || 0) > 1}
                                            className="flex-1 bg-white text-black py-4 px-8 flex items-center justify-center text-sm font-bold uppercase tracking-[0.2em] hover:bg-brand-accent hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-black disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed box-glow"
                                        >
                                            {selectedSize || (product.sizes?.length === 1) ? 'Add to bag' : 'Select a size'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleShare}
                                            className="p-4 bg-white/5 border border-white/10 rounded-sm hover:bg-white/10 hover:border-white/20 transition-all group"
                                            title="Share Product"
                                        >
                                            <Share2 className="h-5 w-5 text-white opacity-60 group-hover:opacity-100 transition-opacity" />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-500 text-center uppercase tracking-[0.2em] font-bold py-2">
                                        <span className="text-white">FREE SHIPPING</span> ON ALL ORDERS OVER $200
                                    </p>

                                    {/* Local Impact Message */}
                                    <ImpactMessage className="mt-2" />

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
        </div>
    );
};

export default ProductDetails;
