import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';
import { Plus, Edit2, Trash2, Save, X, Image as ImageIcon, Copy, Search, AlertCircle, CheckCircle } from 'lucide-react';

const ProductManager: React.FC = () => {
    const { products, addProduct, updateProduct, deleteProduct } = useApp();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editForm, setEditForm] = useState<Partial<Product>>({});
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Initialize new product form
    const initNewProduct = () => {
        setIsAdding(true);
        setError(null);
        setSuccess(null);
        setEditForm({
            id: `prod_${Date.now()}`,
            name: '',
            price: 0,
            images: [''],
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
    };

    // Cancel editing
    const cancelEdit = () => {
        setEditingId(null);
        setIsAdding(false);
        setEditForm({});
        setError(null);
    };

    // Save product (add or update)
    const saveProduct = async () => {
        setError(null);
        setSuccess(null);

        if (!editForm.name || !editForm.price || !editForm.images?.[0]) {
            setError('Please fill in all required fields (Name, Price, Image URL)');
            return;
        }

        setIsSaving(true);
        try {
            const productData: Product = {
                id: editForm.id || `prod_${Date.now()}`,
                name: editForm.name,
                price: Number(editForm.price),
                images: editForm.images || [''],
                description: editForm.description || '',
                category: editForm.category || 'apparel',
                isFeatured: editForm.isFeatured || false,
                sizes: editForm.sizes || ['S', 'M', 'L', 'XL'],
                sizeInventory: editForm.sizeInventory || {},
                nft: editForm.nft,
            };

            console.log('💾 SAVING PRODUCT:', productData);

            if (isAdding) {
                console.log('➕ Adding new product...');
                await addProduct(productData);
                console.log('✅ Product added successfully');
                setSuccess('Product added successfully! Check console for details.');
            } else {
                console.log('✏️ Updating existing product...');
                await updateProduct(productData);
                console.log('✅ Product updated successfully');
                setSuccess('Product updated successfully! Check console for verification.');
            }

            setTimeout(() => {
                cancelEdit();
                setSuccess(null);
            }, 2000);
        } catch (err) {
            console.error("❌ SAVE FAILED:", err);
            setError(`Failed to save product: ${err instanceof Error ? err.message : 'Unknown error'}. Check console for details.`);
        } finally {
            setIsSaving(false);
        }
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

    // Update image URL
    const updateImage = (index: number, value: string) => {
        const newImages = [...(editForm.images || [''])];
        newImages[index] = value;
        setEditForm(prev => ({ ...prev, images: newImages }));
    };

    // Add image field
    const addImageField = () => {
        setEditForm(prev => ({ ...prev, images: [...(prev.images || ['']), ''] }));
    };

    // Remove image field
    const removeImageField = (index: number) => {
        const newImages = (editForm.images || ['']).filter((_, i) => i !== index);
        setEditForm(prev => ({ ...prev, images: newImages.length > 0 ? newImages : [''] }));
    };

    // Filter products
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="font-display text-2xl font-bold uppercase text-white">Products</h2>
                    <p className="text-gray-400 text-sm">Manage your catalog and inventory</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-white/30 focus:outline-none w-full md:w-64"
                        />
                    </div>
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
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
                        <h3 className="font-display text-xl font-bold uppercase text-white">
                            {isAdding ? 'Add New Product' : 'Edit Product'}
                        </h3>
                        <button onClick={cancelEdit} className="text-gray-400 hover:text-white transition">
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
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Category</label>
                                    <select
                                        value={editForm.category || 'apparel'}
                                        onChange={(e) => updateField('category', e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-white/30 outline-none"
                                    >
                                        <option value="apparel">Apparel</option>
                                        <option value="accessory">Accessory</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Inventory</label>
                                <div className="bg-black/30 border border-white/10 rounded-lg p-4 space-y-3">
                                    {(editForm.sizes || ['S', 'M', 'L', 'XL']).map((size) => (
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
                                />
                                <label htmlFor="featured" className="text-sm font-bold uppercase text-gray-300 cursor-pointer">
                                    Featured Product
                                </label>
                            </div>
                        </div>

                        {/* Right Column: Images & Details */}
                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Images</label>
                                <div className="space-y-3">
                                    {(editForm.images || ['']).map((img, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={img}
                                                onChange={(e) => updateImage(index, e.target.value)}
                                                className="flex-1 bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-white/30 outline-none"
                                                placeholder="Image URL"
                                            />
                                            {(editForm.images?.length || 0) > 1 && (
                                                <button
                                                    onClick={() => removeImageField(index)}
                                                    className="p-3 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={addImageField}
                                        className="text-xs text-brand-accent hover:text-white font-bold uppercase tracking-wide"
                                    >
                                        + Add Another Image
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Description</label>
                                <textarea
                                    value={editForm.description || ''}
                                    onChange={(e) => updateField('description', e.target.value)}
                                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-white/30 outline-none h-32"
                                    placeholder="Product description..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-8 pt-6 border-t border-white/10">
                        <button
                            onClick={saveProduct}
                            disabled={isSaving}
                            className={`flex items-center gap-2 bg-white text-black px-6 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-gray-200 transition ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Save className="w-5 h-5" />
                            {isSaving ? 'Saving...' : (isAdding ? 'Add Product' : 'Save Changes')}
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

            {/* Product List */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black/40 text-gray-400 uppercase text-xs font-bold tracking-wider">
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
                                    <td colSpan={5} className="p-12 text-center text-gray-500">
                                        No products found
                                    </td>
                                </tr>
                            ) : (
                                filteredProducts.map(product => (
                                    <tr key={product.id} className="hover:bg-white/5 transition">
                                        <td className="p-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded bg-white/10 overflow-hidden flex-shrink-0">
                                                    <img
                                                        src={product.images[0]}
                                                        alt={product.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/100?text=No+Img')}
                                                    />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white">{product.name}</p>
                                                    <p className="text-xs text-gray-500 font-mono">{product.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 font-bold text-white">
                                            ${product.price.toFixed(2)}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-2">
                                                {product.sizeInventory && Object.entries(product.sizeInventory).map(([size, qty]) => (
                                                    <span
                                                        key={size}
                                                        className={`text-xs px-2 py-1 rounded border ${(qty as number) > 0
                                                            ? 'border-green-500/30 text-green-400 bg-green-500/10'
                                                            : 'border-red-500/30 text-red-400 bg-red-500/10'
                                                            }`}
                                                    >
                                                        {size}: {qty}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="text-xs font-bold uppercase tracking-wide text-gray-400 bg-white/5 px-2 py-1 rounded">
                                                {product.category}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-2">
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
