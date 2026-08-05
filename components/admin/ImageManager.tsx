import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import {
    Upload, Plus, X, ChevronLeft, ChevronRight, Star, GripVertical,
    Search, Save, Loader2, AlertCircle, CheckCircle, Image as ImageIcon,
    ExternalLink, Globe, AlertTriangle
} from 'lucide-react';
import { uploadProductImage } from '../../services/productUpload';
import ImageCropperModal from '../ui/ImageCropperModal';
import { moveArrayItem } from '../../utils/arrayMove';
import { normalizeProductSizeData } from '../../utils/productSizes';

// Types of image URL accessibility
const IMAGE_URL_TYPE = {
    SUPABASE_STORAGE: 'supabase',   // https://*.supabase.co/storage/* — globally accessible
    CDN_ABSOLUTE: 'cdn',            // https://i.imgur.com, https://imgur.com — globally accessible
    LOCAL_PATH: 'local',            // /images/* — served from Vercel CDN, globally accessible
    OTHER_ABSOLUTE: 'other',        // Any other https:// URL — depends on the source
    INSECURE: 'insecure',           // http:// (no SSL) — might be blocked by some browsers/regions
    INVALID: 'invalid',             // Not a valid image URL format
} as const;

type ImageUrlType = typeof IMAGE_URL_TYPE[keyof typeof IMAGE_URL_TYPE];

function classifyImageUrl(url: string): { type: ImageUrlType; label: string; warning?: string } {
    if (!url || typeof url !== 'string') {
        return { type: IMAGE_URL_TYPE.INVALID, label: 'Invalid', warning: 'Empty or invalid URL' };
    }

    if (url.startsWith('/')) {
        return {
            type: IMAGE_URL_TYPE.LOCAL_PATH,
            label: 'Local (Vercel CDN)',
            warning: undefined,
        };
    }

    if (url.startsWith('http://')) {
        return {
            type: IMAGE_URL_TYPE.INSECURE,
            label: 'HTTP (No SSL)',
            warning: 'Non-HTTPS URLs may be blocked by some browsers and regions. Use HTTPS or upload via the crop tool.'
        };
    }

    if (url.startsWith('https://')) {
        if (url.includes('supabase.co/storage')) {
            return {
                type: IMAGE_URL_TYPE.SUPABASE_STORAGE,
                label: 'Supabase CDN',
                warning: undefined,
            };
        }
        if (url.includes('imgur.com') || url.includes('i.imgur.com') || url.includes('i.ibb.co')) {
            return {
                type: IMAGE_URL_TYPE.CDN_ABSOLUTE,
                label: 'Image CDN',
                warning: undefined,
            };
        }
        // Check for localhost or private IPs
        if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('192.168.') || url.includes('10.')) {
            return {
                type: IMAGE_URL_TYPE.OTHER_ABSOLUTE,
                label: '⚠ Private URL',
                warning: 'This URL points to a local or private network address. It will not be accessible to visitors outside your network.'
            };
        }
        return {
            type: IMAGE_URL_TYPE.OTHER_ABSOLUTE,
            label: 'External HTTPS',
            warning: undefined,
        };
    }

    return {
        type: IMAGE_URL_TYPE.INVALID,
        label: 'Invalid',
        warning: 'This does not appear to be a valid image URL. Use a full https:// URL or a /images/ path.'
    };
}

const ImageManager: React.FC = () => {
    const { products, updateProduct } = useApp();
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [editImages, setEditImages] = useState<string[] | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
    const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
    const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [urlInput, setUrlInput] = useState('');

    const selectedProduct = selectedProductId
        ? products.find(p => p.id === selectedProductId)
        : null;

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const openProduct = (product: Product) => {
        setSelectedProductId(product.id);
        setEditImages([...product.images]);
        setError(null);
        setSuccess(null);
        setDraggedImageIndex(null);
        setDragOverImageIndex(null);
    };

    const closeProduct = () => {
        setSelectedProductId(null);
        setEditImages(null);
        setError(null);
        setSuccess(null);
        setPendingCropFile(null);
        setUrlInput('');
    };

    const updateImages = (updater: (images: string[]) => string[]) => {
        setEditImages(prev => updater(prev || []));
    };

    const moveImage = (fromIndex: number, toIndex: number) => {
        updateImages(images => moveArrayItem(images, fromIndex, toIndex));
    };

    const promoteImage = (index: number) => {
        moveImage(index, 0);
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
        moveImage(draggedImageIndex, index);
        setDraggedImageIndex(null);
        setDragOverImageIndex(null);
    };

    const handleImageDragEnd = () => {
        setDraggedImageIndex(null);
        setDragOverImageIndex(null);
    };

    const removeImage = (index: number) => {
        if (!editImages) return;
        const newImages = editImages.filter((_, i) => i !== index);
        setEditImages(newImages);
        if (draggedImageIndex !== null && draggedImageIndex === index) {
            setDraggedImageIndex(null);
        }
        setDragOverImageIndex(null);
    };

    const addUrl = () => {
        if (!urlInput || !urlInput.trim()) return;
        updateImages(images => [...images, urlInput.trim()]);
        setUrlInput('');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file (JPG, PNG, GIF, WebP)');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
        setError(null);
        setPendingCropFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCroppedUpload = async (croppedFile: File) => {
        if (!selectedProduct) return;
        setIsUploading(true);
        setError(null);
        try {
            const url = await uploadProductImage(croppedFile, selectedProduct.name || 'product');
            updateImages(images => [...images, url]);
            setSuccess('Image uploaded!');
            setTimeout(() => setSuccess(null), 2000);
            setPendingCropFile(null);
        } catch (err: any) {
            setError('Upload failed: ' + (err.message || 'Unknown error'));
            throw err;
        } finally {
            setIsUploading(false);
        }
    };

    const cancelCrop = () => {
        setPendingCropFile(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Validate all image URLs before saving
    const validateImageUrls = (urls: string[]): { valid: boolean; warnings: string[] } => {
        const warnings: string[] = [];
        for (let i = 0; i < urls.length; i++) {
            const result = classifyImageUrl(urls[i]);
            if (result.type === IMAGE_URL_TYPE.INVALID) {
                warnings.push(`Image #${i + 1}: ${result.warning}`);
            } else if (result.type === IMAGE_URL_TYPE.INSECURE) {
                warnings.push(`Image #${i + 1}: ${result.warning}`);
            } else if (result.warning) {
                warnings.push(`Image #${i + 1}: ${result.warning}`);
            }
        }
        return { valid: warnings.length === 0, warnings };
    };

    const saveImages = async () => {
        if (!selectedProduct || !editImages) return;
        if (editImages.length === 0) {
            setError('Product must have at least one image.');
            return;
        }

        // Pre-save validation
        const validation = validateImageUrls(editImages);
        if (!validation.valid) {
            const confirmed = window.confirm(
                'Some images may not be globally accessible:\n\n' +
                validation.warnings.join('\n') +
                '\n\nClick OK to save anyway, or Cancel to fix them first.'
            );
            if (!confirmed) return;
        }

        setIsSaving(true);
        setError(null);
        setSuccess(null);
        try {
            const normalizedSizes = normalizeProductSizeData(
                selectedProduct.sizes,
                selectedProduct.sizeInventory
            );
            await updateProduct({
                ...selectedProduct,
                images: editImages,
                sizes: normalizedSizes.sizes,
                sizeInventory: normalizedSizes.sizeInventory,
            });
            const accessibleCount = editImages.filter(img =>
                classifyImageUrl(img).type !== IMAGE_URL_TYPE.INVALID &&
                classifyImageUrl(img).type !== IMAGE_URL_TYPE.INSECURE &&
                !classifyImageUrl(img).warning
            ).length;
            setSuccess(`Saved! ${accessibleCount}/${editImages.length} images use globally accessible URLs.`);
            setTimeout(() => setSuccess(null), 4000);
        } catch (err) {
            console.error('Save failed:', err);
            setError('Failed to save images. Check console for details.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="font-display text-2xl font-bold uppercase text-white">Image Manager</h2>
                    <p className="text-gray-400 text-sm">
                        {selectedProduct
                            ? 'Editing: ' + selectedProduct.name
                            : 'Select a product to manage its gallery images'
                        }
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedProduct && (
                        <button
                            onClick={closeProduct}
                            className="flex items-center gap-2 bg-white/10 text-white px-4 py-2 rounded-lg font-bold uppercase text-xs hover:bg-white/20 transition"
                        >
                            <X className="w-4 h-4" />
                            Back to Grid
                        </button>
                    )}
                    {!selectedProduct && (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-white/30 focus:outline-none w-full md:w-64"
                                title="Search Products"
                                aria-label="Search Products"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Feedback Messages */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm">{error}</span>
                </div>
            )}
            {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm">{success}</span>
                </div>
            )}

            {selectedProduct && editImages ? (
                /* Expanded Product Image Editor */
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm shadow-2xl">
                    {/* Product Info Header */}
                    <div className="flex items-center gap-4 mb-6 pb-4 border-b border-white/10">
                        <div className="w-16 h-16 rounded-lg bg-black/40 overflow-hidden border border-white/10 shrink-0">
                            <img
                                src={editImages[0] || selectedProduct.images[0]}
                                alt={selectedProduct.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/100?text=No+Img'; }}
                            />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-white text-lg truncate">{selectedProduct.name}</h3>
                            <p className="text-xs text-gray-500 font-mono">{selectedProduct.id}</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {editImages.length} image{editImages.length !== 1 ? 's' : ''}
                                {' · '}
                                <span className="text-brand-accent">First image = storefront cover</span>
                            </p>
                        </div>
                    </div>

                    {/* Upload & URL Controls */}
                    <div className="flex flex-col md:flex-row gap-3 mb-6">
                        <div className="flex-1 flex gap-2">
                            <input
                                type="text"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
                                className="flex-1 bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-white/30 outline-none"
                                placeholder="Paste image URL..."
                            />
                            <button
                                onClick={addUrl}
                                className="bg-white/10 text-white px-4 rounded-lg font-bold uppercase text-xs hover:bg-white/20 transition"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            accept="image/*"
                            title="Upload Product Image"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="flex items-center justify-center gap-2 bg-brand-accent text-white px-5 py-3 rounded-lg font-bold uppercase text-xs hover:brightness-110 transition disabled:opacity-50"
                        >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            {isUploading ? 'Uploading...' : 'Upload & Crop'}
                        </button>
                    </div>

                    {/* Image Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                        {editImages.map((img, index) => {
                            const isPrimary = index === 0;
                            const isDragged = draggedImageIndex === index;
                            const isDropTarget = dragOverImageIndex === index;

                            return (
                                <div
                                    key={`${img}-${index}`}
                                    draggable
                                    onDragStart={() => handleImageDragStart(index)}
                                    onDragOver={(event) => handleImageDragOver(event, index)}
                                    onDrop={() => handleImageDrop(index)}
                                    onDragEnd={handleImageDragEnd}
                                    className={`relative aspect-[4/5] bg-black/40 rounded-lg overflow-hidden border-2 transition group cursor-grab active:cursor-grabbing ${isDropTarget ? 'border-brand-accent ring-2 ring-brand-accent/40' : isPrimary ? 'border-brand-accent/50' : 'border-white/10'} ${isDragged ? 'opacity-50 scale-[0.98]' : ''}`}
                                >
                                    <img
                                        src={img}
                                        alt={`${index + 1}`}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/200?text=Broken'; }}
                                    />
                                    <div className="absolute left-1 top-1 flex items-center gap-1">
                                        <span className="rounded-full border border-white/10 bg-black/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                                            #{index + 1}
                                        </span>
                                        {isPrimary && (
                                            <span className="rounded-full border border-brand-accent/30 bg-brand-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                                                Cover
                                            </span>
                                        )}
                                    </div>
                                    {/* Global accessibility badge */}
                                    <div className="absolute right-1 bottom-10" title={classifyImageUrl(img).warning || classifyImageUrl(img).label}>
                                        {classifyImageUrl(img).warning ? (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/40 bg-yellow-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-300">
                                                <AlertTriangle className="w-2.5 h-2.5" />
                                                {classifyImageUrl(img).label}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-green-300">
                                                <Globe className="w-2.5 h-2.5" />
                                                {classifyImageUrl(img).label}
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => removeImage(index)}
                                        className="absolute top-1 right-1 bg-red-500/90 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg hover:bg-red-600"
                                        title="Remove Image"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 opacity-0 transition group-hover:opacity-100">
                                        <button
                                            type="button"
                                            onClick={() => moveImage(index, index - 1)}
                                            disabled={index === 0}
                                            className="flex h-7 flex-1 items-center justify-center rounded-md border border-white/10 bg-black/80 text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                            title="Move left"
                                        >
                                            <ChevronLeft className="h-3 w-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => promoteImage(index)}
                                            disabled={index === 0}
                                            className="flex h-7 flex-1 items-center justify-center rounded-md border border-white/10 bg-black/80 text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                            title="Set as cover"
                                        >
                                            <Star className={`h-3 w-3 ${isPrimary ? 'fill-brand-accent text-brand-accent' : ''}`} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveImage(index, index + 1)}
                                            disabled={index === editImages.length - 1}
                                            className="flex h-7 flex-1 items-center justify-center rounded-md border border-white/10 bg-black/80 text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                            title="Move right"
                                        >
                                            <ChevronRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <div className="absolute bottom-1 left-1 rounded-full border border-white/10 bg-black/80 p-1 text-gray-300 opacity-0 transition group-hover:opacity-100">
                                        <GripVertical className="h-3 w-3" />
                                    </div>
                                </div>
                            );
                        })}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="aspect-[4/5] bg-white/5 border-2 border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 hover:border-white/40 transition gap-2 disabled:opacity-50 group"
                        >
                            {isUploading ? (
                                <Loader2 className="w-8 h-8 animate-spin" />
                            ) : (
                                <Plus className="w-8 h-8 text-gray-400 group-hover:text-white transition" />
                            )}
                            <span className="text-[10px] uppercase font-bold tracking-wider">
                                {isUploading ? 'Uploading...' : 'Add Image'}
                            </span>
                        </button>
                    </div>

                    {/* Accessibility Summary */}
                    <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {['supabase', 'cdn', 'local'].map(type => {
                            const count = editImages.filter(img => {
                                const t = classifyImageUrl(img);
                                return t.type === type && !t.warning;
                            }).length;
                            const label = type === 'supabase' ? 'Supabase CDN' : type === 'cdn' ? 'Image CDN' : 'Local (Vercel)';
                            return count > 0 ? (
                                <div key={type} className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-green-400">
                                        <Globe className="w-3 h-3 inline mr-1" />
                                        {count} {label}
                                    </p>
                                    <p className="text-[9px] text-gray-500 mt-0.5">Global CDN ✓</p>
                                </div>
                            ) : null;
                        })}
                    </div>

                    <p className="text-[10px] text-gray-500 mb-6 text-center italic font-mono uppercase tracking-tighter">
                        Drag tiles or use the arrow buttons to reorder. Click the star to set as cover. First image is the storefront cover image.
                        Uploaded images are stored on Supabase CDN for global accessibility. Local paths are served via Vercel CDN.
                    </p>

                    <div className="flex gap-4 pt-4 border-t border-white/10">
                        <button
                            onClick={saveImages}
                            disabled={isSaving}
                            className={`flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition ${isSaving ? 'opacity-50 cursor-not-allowed' : 'shadow-[0_0_20px_rgba(255,255,255,0.3)]'}`}
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {isSaving ? 'Saving...' : 'Save to Database'}
                        </button>
                        <a
                            href={`/product/${selectedProduct.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-white/20 transition"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Preview Page
                        </a>
                    </div>
                </div>
            ) : (
                /* Product Grid */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredProducts.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-500">
                            <ImageIcon className="w-12 h-12 mb-4 opacity-30" />
                            <p className="text-lg font-bold uppercase tracking-widest">No products found</p>
                            <p className="text-sm mt-2">Try a different search term</p>
                        </div>
                    ) : (
                        filteredProducts.map((product) => (
                            <button
                                key={product.id}
                                onClick={() => openProduct(product)}
                                className="group bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-brand-accent/50 hover:bg-white/10 transition-all text-left"
                            >
                                <div className="aspect-[4/5] bg-black/40 overflow-hidden relative">
                                    <img
                                        src={product.images[0]}
                                        alt={product.name}
                                        className="w-full h-full object-cover transition duration-500 group-hover:scale-105"
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://via.placeholder.com/200?text=No+Img'; }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="inline-block bg-black/80 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-white/10">
                                            {product.images.length} image{product.images.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-3">
                                    <p className="text-xs font-bold text-white truncate group-hover:text-brand-accent transition">
                                        {product.name}
                                    </p>
                                    <p className="text-[10px] text-gray-500 font-mono mt-1 truncate">
                                        {product.id}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}

            <ImageCropperModal
                open={!!pendingCropFile}
                file={pendingCropFile}
                title="Crop Product Image"
                description="Frame the image before it uploads. Drag to align the subject and use the zoom slider to fill the frame."
                confirmLabel="Upload Cropped Image"
                onCancel={cancelCrop}
                onConfirm={handleCroppedUpload}
            />
        </div>
    );
};

export default ImageManager;
