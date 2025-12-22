import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Share2, Shield, Plus, Trash2, X, Upload, ExternalLink, Smartphone, Scan } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product, AuthProvider } from '../types';
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

    return (
        <div className="pt-24 pb-16 min-h-screen bg-black">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <button onClick={() => navigate(-1)} className="flex items-center text-sm text-gray-400 hover:text-white mb-8">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Image Gallery */}
                    <div className="space-y-4">
                        <div className="aspect-[4/5] bg-white/5 overflow-hidden rounded-sm relative">
                            <img
                                src={(isEditing && editForm.images ? editForm.images : product.images)[activeImageIndex]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                            {user && (
                                <button
                                    onClick={() => toggleFavorite(product.id)}
                                    className="absolute top-4 right-4 p-3 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition shadow-sm"
                                >
                                    <Heart className={`w-5 h-5 ${isFav ? 'fill-red-500 text-red-500' : 'text-gray-900'}`} />
                                </button>
                            )}
                        </div>
                        {/* Thumbnails */}
                        <div className="flex space-x-4 overflow-x-auto pb-2">
                            {(isEditing && editForm.images ? editForm.images : product.images).map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveImageIndex(idx)}
                                    className={`relative w-20 h-24 flex-shrink-0 overflow-hidden rounded-sm border-2 ${activeImageIndex === idx ? 'border-black' : 'border-transparent'}`}
                                >
                                    <img src={img} alt={`View ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Info */}
                    <div>
                        {isAdminMode && isEditing ? (
                            <div className="bg-white/5 p-6 rounded-lg space-y-4 border border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold uppercase flex items-center text-white"><Shield className="w-4 h-4 mr-2" /> Edit Product</h3>
                                    <button onClick={() => setIsEditing(false)} className="text-xs text-gray-400 underline hover:text-white">Cancel</button>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Name</label>
                                    <input
                                        className="w-full p-2 border border-white/10 rounded-sm bg-black/30 text-white placeholder-gray-500"
                                        value={editForm.name || ''}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Price</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border border-white/10 rounded-sm bg-black/30 text-white"
                                            value={editForm.price || 0}
                                            onChange={e => setEditForm({ ...editForm, price: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Size Inventory</label>
                                        <div className="space-y-2">
                                            {(editForm.sizes || ['S', 'M', 'L', 'XL']).map((size) => (
                                                <div key={size} className="flex items-center gap-2">
                                                    <span className="w-12 text-xs font-bold text-gray-400">{size}:</span>
                                                    <input
                                                        type="number"
                                                        value={editForm.sizeInventory?.[size] || 0}
                                                        onChange={(e) => {
                                                            const newInventory = { ...(editForm.sizeInventory || {}) };
                                                            newInventory[size] = parseInt(e.target.value) || 0;
                                                            setEditForm({ ...editForm, sizeInventory: newInventory });
                                                        }}
                                                        className="flex-1 p-2 border border-white/10 rounded-sm bg-black/30 text-white"
                                                        min="0"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Description</label>
                                    <textarea
                                        className="w-full p-2 border border-white/10 rounded-sm h-24 bg-black/30 text-white placeholder-gray-500"
                                        value={editForm.description || ''}
                                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    />
                                </div>

                                {/* Image Management */}
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Images</label>

                                    {/* URL Input */}
                                    <div className="flex space-x-2 mb-2">
                                        <input
                                            className="flex-1 p-2 border border-white/10 rounded-sm text-sm bg-black/30 text-white placeholder-gray-500"
                                            placeholder="Image URL"
                                            value={newImageUrl}
                                            onChange={e => setNewImageUrl(e.target.value)}
                                        />
                                        <button onClick={addImage} className="bg-white/10 px-3 rounded-sm hover:bg-white/20 border border-white/10" title="Add from URL">
                                            <Plus className="w-4 h-4 text-white" />
                                        </button>
                                    </div>

                                    {/* File Upload */}
                                    <div className="mb-4">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="w-full bg-brand-accent text-white px-4 py-2 rounded-sm hover:bg-brand-accent/80 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
                                        >
                                            <Upload className="w-4 h-4" />
                                            {isUploading ? 'Uploading...' : 'Upload from PC'}
                                        </button>
                                        <p className="text-xs text-gray-400 mt-1 text-center">JPG, PNG, GIF, WebP ΓÇó Max 2MB</p>
                                    </div>

                                    {/* Image Grid */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {editForm.images?.map((img, idx) => (
                                            <div key={idx} className="relative group aspect-[4/5]">
                                                <img src={img} className="w-full h-full object-cover rounded-sm border border-white/10" alt={`Product image ${idx + 1}`} />
                                                <button
                                                    onClick={() => removeImage(idx)}
                                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex space-x-2 pt-4">
                                    <button onClick={handleSave} className="flex-1 bg-white text-black py-2 font-bold uppercase text-xs tracking-widest hover:bg-gray-200">Save Changes</button>
                                    <button onClick={handleDelete} className="px-4 border border-red-500 text-red-400 hover:bg-red-500/10" title="Delete product"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h1 className="text-3xl font-display font-bold text-white uppercase tracking-wide">{product.name}</h1>
                                        <p className="mt-2 text-xl text-white font-medium">${product.price}</p>
                                    </div>
                                    {isAdminMode && (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="text-xs bg-gray-100 px-3 py-1 rounded-full font-bold uppercase tracking-wide hover:bg-gray-200 flex items-center"
                                        >
                                            <Shield className="w-3 h-3 mr-1" /> Edit
                                        </button>
                                    )}
                                </div>

                                <div className="mt-8">
                                    <h3 className="text-sm font-medium text-white">Description</h3>
                                    <div className="mt-4 prose prose-sm text-gray-400">
                                        <p>{product.description}</p>
                                    </div>
                                </div>

                                <div className="mt-8">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-white">Size</h3>
                                        <a href="#" className="text-sm font-medium text-brand-accent hover:text-white">Size guide</a>
                                    </div>

                                    <div className="grid grid-cols-4 gap-4 sm:grid-cols-8 lg:grid-cols-4 mt-4">
                                        {product.sizes?.map((size) => {
                                            const sizeStock = product.sizeInventory?.[size] || 0;
                                            const isOutOfStock = sizeStock === 0;
                                            return (
                                                <button
                                                    key={size}
                                                    onClick={() => !isOutOfStock && setSelectedSize(size)}
                                                    disabled={isOutOfStock}
                                                    className={`group relative border py-3 px-4 flex flex-col items-center justify-center text-sm font-medium uppercase focus:outline-none sm:flex-1 ${selectedSize === size
                                                        ? 'border-white ring-2 ring-white bg-white/10 text-white'
                                                        : isOutOfStock
                                                            ? 'border-white/10 bg-white/5 text-gray-500 cursor-not-allowed'
                                                            : 'border-white/20 hover:bg-white/10 text-white'
                                                        }`}
                                                    title={isOutOfStock ? 'Out of stock' : `${sizeStock} in stock`}
                                                >
                                                    <span>{size}</span>
                                                    <span className={`text-[10px] mt-1 ${isOutOfStock ? 'text-red-400' : sizeStock < 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                        {isOutOfStock ? 'Out' : `${sizeStock} left`}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mt-10 flex sm:flex-col1">
                                    <button
                                        onClick={() => addToCart(product, selectedSize)}
                                        disabled={!selectedSize}
                                        className="max-w-xs flex-1 bg-black border border-transparent py-3 px-8 flex items-center justify-center text-base font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-50 focus:ring-black sm:w-full disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
                                    >
                                        {selectedSize ? 'Add to bag' : 'Select a size'}
                                    </button>

                                    <button
                                        type="button"
                                        className="ml-4 py-3 px-3 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-500"
                                    >
                                        <Share2 className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
                                        <span className="sr-only">Share</span>
                                    </button>
                                </div>
                                <div className="mt-6 text-center">
                                    <p className="text-xs text-gray-400">Free shipping on orders over $200</p>
                                </div>

                                {product.nft && (
                                    <div className="mt-8 border-t border-white/10 pt-8">
                                        <h3 className="font-display text-lg font-bold uppercase mb-4 flex items-center text-white">
                                            <Scan className="w-5 h-5 mr-2 text-brand-accent" />
                                            Digital Verification
                                        </h3>
                                        <div className="bg-white/5 rounded-lg p-5 border border-white/10 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                                                    <span className="text-sm font-bold text-gray-300">Blockchain Verified</span>
                                                </div>
                                                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded font-bold uppercase tracking-wider">{product.nft.chain}</span>
                                            </div>

                                            <div className="text-sm text-gray-400">
                                                <p className="mb-2">This physical item is linked to a digital asset on the blockchain.</p>
                                                <a
                                                    href={product.nft.openseaUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center text-brand-accent hover:text-white font-bold text-xs uppercase tracking-wide"
                                                >
                                                    View on OpenSea <ExternalLink className="w-3 h-3 ml-1" />
                                                </a>
                                            </div>

                                            {product.nft.nfcTags && (
                                                <div className="pt-4 border-t border-white/10">
                                                    <p className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center">
                                                        <Smartphone className="w-3 h-3 mr-1" /> Dual NFC Integration
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                                        <div className="bg-white/5 p-3 rounded border border-white/10 text-center hover:border-brand-accent transition cursor-help" title="Scan the tag on the neck label">
                                                            <p className="text-xs font-bold text-white">Neck Tag</p>
                                                            <p className="text-[10px] text-gray-400 mt-1">Opens Linktree</p>
                                                        </div>
                                                        <div className="bg-white/5 p-3 rounded border border-white/10 text-center hover:border-brand-accent transition cursor-help" title="Scan the tag on the bottom hem">
                                                            <p className="text-xs font-bold text-white">Bottom Tag</p>
                                                            <p className="text-[10px] text-gray-400 mt-1">NFT Claim / Verify</p>
                                                        </div>
                                                    </div>

                                                    {/* Unlock Section */}
                                                    <div className="bg-white/5 p-4 rounded border border-purple-500/30 shadow-sm">
                                                        <h4 className="font-bold text-sm mb-2 flex items-center text-white">
                                                            {nftOwned ? <Unlock className="w-4 h-4 mr-2 text-green-500" /> : <Lock className="w-4 h-4 mr-2 text-gray-400" />}
                                                            Owner Perks
                                                        </h4>

                                                        {!nftOwned ? (
                                                            <div>
                                                                <p className="text-xs text-gray-400 mb-3">
                                                                    Connect your wallet to verify ownership and unlock exclusive content.
                                                                </p>
                                                                <button
                                                                    onClick={handleUnlockPerks}
                                                                    disabled={isCheckingNft}
                                                                    className="w-full bg-black text-white text-xs font-bold uppercase py-2 rounded-sm hover:bg-gray-800 transition flex items-center justify-center"
                                                                >
                                                                    {isCheckingNft ? (
                                                                        <>
                                                                            <Loader className="w-3 h-3 mr-2 animate-spin" /> Verifying...
                                                                        </>
                                                                    ) : (
                                                                        'Unlock Perks'
                                                                    )}
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-green-50 p-3 rounded border border-green-200 text-center">
                                                                <p className="text-xs font-bold text-green-700 mb-1">ACCESS GRANTED</p>
                                                                <p className="text-sm font-mono bg-white p-2 rounded border border-green-100 select-all">
                                                                    VIP-CODE-2024
                                                                </p>
                                                                <p className="text-[10px] text-green-600 mt-1">Use this code for 20% off your next order!</p>
                                                            </div>
                                                        )}

                                                        {unlockMessage && !nftOwned && (
                                                            <p className={`text-xs mt-2 text-center ${unlockMessage.includes('Verified') ? 'text-green-600' : 'text-red-500'}`}>
                                                                {unlockMessage}
                                                            </p>
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
