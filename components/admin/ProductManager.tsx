import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Copy, Search, AlertCircle, CheckCircle, RefreshCw, Loader2, Upload, ChevronLeft, ChevronRight, GripVertical, Star } from 'lucide-react';
import { syncProductsToCode } from '../../services/imgurService';
import { uploadProductImage } from '../../services/productUpload';
import ImageCropperModal from '../ui/ImageCropperModal';
import { moveArrayItem } from '../../utils/arrayMove';
import { getProductEditableSizes, normalizeProductSizeData } from '../../utils/productSizes';

const ProductManager: React.FC = () => {
    const { products, addProduct, updateProduct, deleteProduct } = useApp();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editForm, setEditForm] = useState<Partial<Product>>({});
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);
    const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
    const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize new product form
    const initNewProduct = () => {
        setIsAdding(true);
        setError(null);
        setSuccess(null);
        setEditForm({
            id: `prod_${Date.now()}`,
            name: '',
            price: 0,
            images: [],
            description: '',
            category: 'apparel',
            isFeatured: false,
            sizes: ['S', 'M', 'L', 'XL'],
            sizeInventory: { 'S': 0, 'M': 0, 'L': 0, 'XL': 0 },
        });
    };

    // Start editing existing product
    const startEdit = (product: Product) => {
        setEditingId(product.id);
        setEditForm({ ...product });
        setIsAdding(false);
        setError(null);
        setSuccess(null);
        setPendingCropFile(null);
        setDraggedImageIndex(null);
        setDragOverImageIndex(null);
    };

    // Cancel editing
    const cancelEdit = () => {
        setEditingId(null);
        setIsAdding(false);
        setEditForm({});
        setError(null);
        setPendingCropFile(null);
        setDraggedImageIndex(null);
        setDragOverImageIndex(null);
    };

    // Save product (add or update)
    const saveProduct = async () => {
        setError(null);
        setSuccess(null);

        if (!editForm.name || !editForm.price || !editForm.images?.[0]) {
            setError('Please fill in all required fields (Name, Price, Image)');
            return;
        }

        setIsSaving(true);
        try {
            const normalizedSizes = normalizeProductSizeData(editForm.sizes, editForm.sizeInventory);
            const productData: Product = {
                id: editForm.id || `prod_${Date.now()}`,
                name: editForm.name,
                price: Number(editForm.price),
                images: editForm.images || [],
                description: editForm.description || '',
                category: editForm.category || 'apparel',
                isFeatured: editForm.isFeatured || false,
                sizes: normalizedSizes.sizes,
                sizeInventory: normalizedSizes.sizeInventory,
                nft: editForm.nft,
                archived: editForm.archived || false,
            };

            if (isAdding) {
                await addProduct(productData);
                setSuccess('Product added successfully!');
            } else {
                await updateProduct(productData);
                setSuccess('Product updated successfully!');
            }

            setTimeout(() => {
                cancelEdit();
                setSuccess(null);
            }, 2000);
        } catch (err) {
            console.error("❌ SAVE FAILED:", err);
            setError(`Failed to save product: ${err instanceof Error ? err.message : 'Unknown error'}.`);
        } finally {
            setIsSaving(false);
        }
    };

    // Sync to Codebase
    const handleSync = async () => {
        if (!window.confirm('This will update constants.ts with all current database products and create a Git commit. Proceed?')) return;

        setIsSyncing(true);
        setError(null);
        setSuccess(null);
        try {
            const hash = await syncProductsToCode();
            setSuccess(`Sync Complete! Constants updated and committed (${hash})`);
            setTimeout(() => setSuccess(null), 5000);
        } catch (err) {
            console.error('Core sync failed:', err);
            setError('Failed to sync products to codebase. Make sure the local server is running.');
        } finally {
            setIsSyncing(false);
        }
    };

    // Handle Direct File Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setSuccess(null);

        if (!file.type.startsWith('image/')) {
            setError('Please choose an image file before opening the cropper.');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setPendingCropFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCroppedUpload = async (croppedFile: File) => {
        setIsUploading(true);
        setError(null);
        try {
            const url = await uploadProductImage(croppedFile, editForm.name || 'new-product');
            setEditForm(prev => ({
                ...prev,
                images: [...(prev.images || []), url]
            }));
            setSuccess('Cropped image uploaded successfully!');
            setTimeout(() => setSuccess(null), 3000);
            setPendingCropFile(null);
        } catch (err: any) {
            console.error('Upload failed:', err);
            setError(`Upload failed: ${err.message || 'Unknown error'}`);
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

    // Delete product with confirmation
    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
            try {
                await deleteProduct(id);
                setSuccess(`Deleted "${name}"`);
                setTimeout(() => setSuccess(null), 3000);
            } catch (err) {
                console.error("Failed to delete product", err);
                setError("Failed to delete product");
            }
        }
    };

    // Duplicate product
    const duplicateProduct = async (product: Product) => {
        try {
            const duplicatedProduct: Product = {
                ...product,
                id: `prod_${Date.now()}`,
                name: `${product.name} (Copy)`,
                sizeInventory: product.sizes?.reduce((acc, size) => ({ ...acc, [size]: 0 }), {}) || {},
            };
            await addProduct(duplicatedProduct);
            setSuccess(`Duplicated "${product.name}"`);
            setTimeout(() => setSuccess(null), 3000);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error("Failed to duplicate product", err);
            setError("Failed to duplicate product");
        }
    };

    // Update form field
    const updateField = (field: keyof Product, value: any) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const updateImages = (updater: (images: string[]) => string[]) => {
        setEditForm(prev => {
            const currentImages = prev.images || [];
            return {
                ...prev,
                images: updater(currentImages),
            };
        });
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

    // Remove image field
    const removeImageField = (index: number) => {
        const newImages = (editForm.images || []).filter((_, i) => i !== index);
        setEditForm(prev => ({ ...prev, images: newImages }));
        if (draggedImageIndex !== null && draggedImageIndex === index) {
            setDraggedImageIndex(null);
        }
        setDragOverImageIndex(null);
    };

    // Filter products
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const editableSizes = getProductEditableSizes(editForm.sizes, editForm.sizeInventory);

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="font-display text-2xl font-bold uppercase text-white">Products</h2>
                    <p className="text-gray-400 text-sm">Manage your catalog and inventory</p>
                </div>
                <div className="flex flex-wrap gap-3">
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
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 text-purple-300 px-4 py-2 rounded-lg font-bold uppercase text-sm hover:bg-purple-500/30 transition disabled:opacity-50"
                        title="Sync Supabase products to constants.ts"
                    >
                        {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Sync Code
                    </button>
                    <button
                        onClick={initNewProduct}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg font-bold uppercase text-sm hover:bg-gray-200 transition"
                    >
                        <Plus className="w-4 h-4" />
                        Add Product
                    </button>
                </div>
            </div>

            {/* Feedback Messages */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}
            {success && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg flex items-center gap-3">
                    <CheckCircle className="w-5 h-5" />
                    {success}
                </div>
            )}

            {/* Edit Form */}
            {(isAdding || editingId) && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm shadow-2xl">
                    <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                        <h3 className="font-display text-xl font-bold uppercase text-white">
                            {isAdding ? 'Add New Product' : 'Edit Product'}
                        </h3>
                        <button onClick={cancelEdit} className="text-gray-400 hover:text-white transition" title="Cancel Edit">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column: Basic Info */}
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Product Name</label>
                                <input
                                    type="text"
                                    value={editForm.name || ''}
                                    onChange={(e) => updateField('name', e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-white/30 outline-none"
                                    placeholder="e.g. Coalition Classic Tee"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Price ($)</label>
                                    <input
                                        type="number"
                                        value={editForm.price || 0}
                                        onChange={(e) => updateField('price', parseFloat(e.target.value))}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-white/30 outline-none"
                                        step="0.01"
                                        title="Product Price"
                                        aria-label="Product Price"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Category</label>
                                    <select
                                        value={editForm.category || 'apparel'}
                                        onChange={(e) => updateField('category', e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-white/30 outline-none"
                                        title="Product Category"
                                        aria-label="Product Category"
                                    >
                                        <option value="apparel">Apparel</option>
                                        <option value="accessory">Accessory</option>
                                        <option value="shirt">Shirt</option>
                                        <option value="hoodie">Hoodie</option>
                                        <option value="hat">Hat</option>
                                        <option value="jeans">Jeans</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Inventory (Sizes & Qty)</label>
                                <div className="bg-black/30 border border-white/10 rounded-lg p-4 space-y-3">
                                    {editableSizes.map((size) => (
                                        <div key={size} className="flex items-center gap-4">
                                            <span className="w-12 text-sm font-bold text-gray-400">{size}</span>
                                            <input
                                                type="number"
                                                value={editForm.sizeInventory?.[size] || 0}
                                                onChange={(e) => {
                                                    const newInventory = { ...(editForm.sizeInventory || {}) };
                                                    newInventory[size] = parseInt(e.target.value) || 0;
                                                    setEditForm(prev => ({ ...prev, sizeInventory: newInventory }));
                                                }}
                                                className="flex-1 bg-black/20 border border-white/10 rounded p-2 text-white text-sm focus:border-white/30 outline-none"
                                                min="0"
                                                title={`Inventory for size ${size}`}
                                                aria-label={`Inventory for size ${size}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <input
                                    type="checkbox"
                                    id="featured"
                                    checked={editForm.isFeatured || false}
                                    onChange={(e) => updateField('isFeatured', e.target.checked)}
                                    className="w-5 h-5 rounded border-white/10 bg-black/30 text-white focus:ring-0"
                                    title="Mark as Featured Product"
                                    aria-label="Mark as Featured Product"
                                />
                                <label htmlFor="featured" className="text-sm font-bold uppercase text-gray-300 cursor-pointer">
                                    Featured Product
                                </label>
                            </div>
                        </div>

                        {/* Right Column: Images & Details */}
                        <div className="space-y-5">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-bold uppercase text-gray-400">Media Assets</label>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading || !!pendingCropFile}
                                        type="button"
                                        className="flex items-center gap-1 text-xs font-bold uppercase text-brand-accent hover:text-white transition disabled:opacity-50"
                                    >
                                        {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                        Crop & Upload
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        accept="image/*"
                                        title="Upload Product Image"
                                    />
                                </div>

                                {/* Image Preview Grid */}
                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    {(editForm.images || []).map((img, index) => {
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
                                                className={`relative aspect-square bg-black/30 rounded-lg overflow-hidden border transition group ${isDropTarget
                                                    ? 'border-brand-accent ring-2 ring-brand-accent/40'
                                                    : 'border-white/10'
                                                    } ${isDragged ? 'opacity-50 scale-[0.98]' : ''}`}
                                                title="Drag to reorder"
                                            >
                                                <img src={img} alt={`Product ${index}`} className="w-full h-full object-cover" />

                                                <div className="absolute left-1 top-1 flex items-center gap-1">
                                                    <span className="rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                                                        #{index + 1}
                                                    </span>
                                                    {isPrimary && (
                                                        <span className="rounded-full border border-brand-accent/30 bg-brand-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">
                                                            Primary
                                                        </span>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => removeImageField(index)}
                                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition"
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
                                                        title="Move earlier"
                                                    >
                                                        <ChevronLeft className="h-3 w-3" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => promoteImage(index)}
                                                        disabled={index === 0}
                                                        className="flex h-7 flex-1 items-center justify-center rounded-md border border-white/10 bg-black/80 text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                                        title="Set as primary"
                                                    >
                                                        <Star className={`h-3 w-3 ${isPrimary ? 'fill-brand-accent text-brand-accent' : ''}`} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveImage(index, index + 1)}
                                                        disabled={index === (editForm.images?.length || 0) - 1}
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
                                    {/* Upload Placeholder */}
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploading}
                                        className="aspect-square bg-white/5 border border-dashed border-white/20 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 hover:border-white/40 transition gap-1 disabled:opacity-50"
                                    >
                                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                        <span className="text-[10px] uppercase font-bold">{isUploading ? 'Uploading...' : 'New Asset'}</span>
                                    </button>
                                </div>

                                {/* Manual URL Input */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        id="imgur-input"
                                        className="flex-1 bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-white/30 outline-none"
                                        placeholder="Paste image link manually..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const input = e.currentTarget;
                                                if (input.value) {
                                                    setEditForm(prev => ({ ...prev, images: [...(prev.images || []), input.value] }));
                                                    input.value = '';
                                                }
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={() => {
                                            const input = document.getElementById('imgur-input') as HTMLInputElement;
                                            if (input.value) {
                                                setEditForm(prev => ({ ...prev, images: [...(prev.images || []), input.value] }));
                                                input.value = '';
                                            }
                                        }}
                                        className="bg-white/10 text-white px-4 rounded-lg font-bold uppercase text-xs hover:bg-white/20 transition"
                                    >
                                        Add
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2 italic font-mono uppercase tracking-tighter">
                                    First image is the storefront cover. Drag tiles or use the arrows to reorder before saving.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Description</label>
                                <textarea
                                    value={editForm.description || ''}
                                    onChange={(e) => updateField('description', e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-white/30 outline-none h-32"
                                    placeholder="Product description... (Markdown supported)"
                                />
                            </div>

                            {/* Archive Toggle */}
                            <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-white uppercase text-sm">Deployment Status</h4>
                                        <p className="text-xs text-gray-400">Archived products are hidden from public shop</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={editForm.archived || false}
                                            onChange={(e) => updateField('archived', e.target.checked)}
                                            title="Archive Product"
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent shadow-inner"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-8 pt-6 border-t border-white/10">
                        <button
                            onClick={saveProduct}
                            disabled={isSaving}
                            className={`flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition ${isSaving ? 'opacity-50 cursor-not-allowed shadow-none' : 'shadow-[0_0_20px_rgba(255,255,255,0.3)]'}`}
                        >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            {isSaving ? 'Deploying...' : (isAdding ? 'Deploy Product' : 'Apply Changes')}
                        </button>
                        <button
                            onClick={cancelEdit}
                            className="flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-white/20 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <ImageCropperModal
                open={!!pendingCropFile}
                file={pendingCropFile}
                title="Crop Product Image"
                description="Frame the image before it uploads. Drag to align the subject, zoom to fill the frame, and choose the best crop ratio for the storefront."
                confirmLabel="Upload Cropped Image"
                onCancel={cancelCrop}
                onConfirm={handleCroppedUpload}
            />

            {/* Product List */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black/40 text-gray-400 uppercase text-xs font-bold tracking-wider border-b border-white/10">
                            <tr>
                                <th className="p-4">Product</th>
                                <th className="p-4">Price</th>
                                <th className="p-4">Inventory</th>
                                <th className="p-4">Category</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-500 italic">
                                        No products found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map(product => (
                                    <tr key={product.id} className="hover:bg-white/5 transition group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded bg-black/40 overflow-hidden flex-shrink-0 border border-white/10 group-hover:border-white/30 transition">
                                                    <img
                                                        src={product.images[0]}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition duration-500"
                                                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/100?text=No+Img')}
                                                    />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white group-hover:text-brand-accent transition">{product.name}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">{product.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 font-bold text-white">
                                            ${product.price ? product.price.toFixed(2) : '0.00'}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-2">
                                                {product.sizeInventory && Object.entries(product.sizeInventory).map(([size, qty]) => (
                                                    <span
                                                        key={size}
                                                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-tighter ${(qty as number) > 0
                                                            ? 'border-green-500/30 text-green-400 bg-green-500/10'
                                                            : 'border-red-500/30 text-red-400 bg-red-500/10 opacity-50'
                                                            }`}
                                                    >
                                                        {size}: {qty}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-white/5 px-2 py-1 rounded border border-white/5">
                                                {product.category}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition">
                                                <button
                                                    onClick={() => duplicateProduct(product)}
                                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded transition"
                                                    title="Duplicate"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => startEdit(product)}
                                                    className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id, product.name)}
                                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProductManager;
