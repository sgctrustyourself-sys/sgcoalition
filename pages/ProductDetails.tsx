import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Share2, Shield, ExternalLink, Smartphone, Scan, Lock, Unlock, Loader } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product, AuthProvider } from '../types';
import { ethers } from 'ethers';
import { checkNftOwnership, switchToPolygon } from '../services/web3Service';
import FrequentlyBoughtTogether from '../components/FrequentlyBoughtTogether';
import FloatingHelpButton from '../components/FloatingHelpButton';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { products, addToCart, user, toggleFavorite, loginUser, isLoading } = useApp();

    const [product, setProduct] = useState<Product | undefined>(undefined);
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [activeImageIndex, setActiveImageIndex] = useState(0);

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
                setUnlockMessage('🎉 Verified! You own this item.');
            } else {
                setNftOwned(false);
                setUnlockMessage('❌ You do not own this NFT yet. Buy the shirt to claim it!');
            }

        } catch (error) {
            console.error('Unlock error:', error);
            setUnlockMessage('Error verifying ownership. Please try again.');
        } finally {
            setIsCheckingNft(false);
        }
    };

    useEffect(() => {
        if (isLoading) return;
        const found = products.find(p => p.id === id);
        if (found) {
            setProduct(found);
            setSelectedSize(found.sizes?.[0] || '');
        } else {
            navigate('/shop');
        }
    }, [id, products, navigate, isLoading]);

    if (isLoading) return <div className="pt-24 text-center text-white">Loading...</div>;

    if (!product) return null;

    const isFav = user?.favorites.includes(product.id);

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
                                src={product.images[activeImageIndex]}
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
                            {product.images.map((img, idx) => (
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
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-display font-bold text-white uppercase tracking-wide">{product.name}</h1>
                                <div className="flex items-center gap-3 mt-2">
                                    <p className="text-xl text-white font-medium">${product.price}</p>
                                    {product.stock === 1 && (
                                        <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide animate-pulse">
                                            Only 1 Available
                                        </span>
                                    )}
                                </div>
                            </div>
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
                                    const isOneSize = product.sizes?.length === 1 && size === 'One Size';

                                    return (
                                        <button
                                            key={size}
                                            onClick={() => !isOutOfStock && setSelectedSize(size)}
                                            disabled={isOutOfStock || isOneSize}
                                            className={`group relative border py-3 px-4 flex flex-col items-center justify-center text-sm font-medium uppercase focus:outline-none sm:flex-1 ${selectedSize === size || isOneSize
                                                ? 'border-white ring-2 ring-white bg-white/10 text-white'
                                                : isOutOfStock
                                                    ? 'border-white/10 bg-white/5 text-gray-500 cursor-not-allowed'
                                                    : 'border-white/20 hover:bg-white/10 text-white'
                                                } ${isOneSize ? 'cursor-default ring-0 border-white/30' : ''}`}
                                            title={isOutOfStock ? 'Out of stock' : `${sizeStock} in stock`}
                                        >
                                            <span>{size}</span>
                                            {!isOneSize && (
                                                <span className={`text-[10px] mt-1 ${isOutOfStock ? 'text-red-400' : sizeStock < 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                    {isOutOfStock ? 'Out' : `${sizeStock} left`}
                                                </span>
                                            )}
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

                        {/* NFT Verification Section */}
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

                        {/* Frequently Bought Together */}
                        <div className="mt-12">
                            <FrequentlyBoughtTogether currentProduct={product} />
                        </div>
                    </div>
                </div>
            </div>
            <FloatingHelpButton />
        </div>
    );
};

export default ProductDetails;
