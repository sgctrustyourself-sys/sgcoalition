import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Share2, Shield, ExternalLink, Smartphone, Scan, Lock, Unlock, Loader } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Product, AuthProvider } from '../types';
import { ethers } from 'ethers';
import { checkNftOwnership, switchToPolygon } from '../services/web3Service';
import FrequentlyBoughtTogether from '../components/FrequentlyBoughtTogether';
import FloatingHelpButton from '../components/FloatingHelpButton';

const ProductReviews = React.lazy(() => import('../components/ProductReviews'));

const ProductDetails = () => {
    const { id } = useParams();
    // ... (skip unchanged lines) ...
    {/* Frequently Bought Together */ }
    <div className="mt-12">
        <FrequentlyBoughtTogether currentProduct={product} />
    </div>

    {/* Product Reviews */ }
    <React.Suspense fallback={<div className="h-40 bg-white/5 animate-pulse rounded-lg" />}>
        <ProductReviews productId={product.id} />
    </React.Suspense>
                    </div >
                </div >
            </div >
    <FloatingHelpButton />
        </div >
    );
};

export default ProductDetails;
