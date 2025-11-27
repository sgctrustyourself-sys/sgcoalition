import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Share2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { Loader } from 'lucide-react';
import FrequentlyBoughtTogether from '../components/FrequentlyBoughtTogether';
import FloatingHelpButton from '../components/FloatingHelpButton';

const ProductDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { products, addToCart, user, toggleFavorite, isLoading } = useApp();

    const [product, setProduct] = useState<Product | undefined>(undefined);
    const [selectedSize, setSelectedSize] = useState<string>('');
    const [activeImageIndex, setActiveImageIndex] = useState(0);

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
