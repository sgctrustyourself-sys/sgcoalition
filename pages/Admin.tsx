import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Product } from '../types';
import { Plus, Edit2, Trash2, Save, X, Package, DollarSign, Image as ImageIcon, Copy, RotateCcw, ShoppingCart, GitBranch } from 'lucide-react';
import Orders from './Orders';
import GitManager from '../components/GitManager';

const Admin: React.FC = () => {
    const { products, addProduct, updateProduct, deleteProduct, isSupabaseConfigured } = useApp();
    const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'git'>('products');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Product>>({});

    // Initialize new product form
    const initNewProduct = () => {
        setIsAdding(true);
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
    };

    // Cancel editing
    const cancelEdit = () => {
        setEditingId(null);
        setIsAdding(false);
        setEditForm({});
    };

    // Save product (add or update)
    const saveProduct = async () => {
        if (!editForm.name || !editForm.price || !editForm.images?.[0]) {
            alert('Please fill in all required fields (Name, Price, Image URL)');
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

            if (isAdding) {
                await addProduct(productData);
            } else {
                await updateProduct(productData);
            }
            cancelEdit();
        } catch (error) {
            console.error("Failed to save product", error);
            alert("Failed to save product");
        } finally {
            setIsSaving(false);
        }
    };

    // Delete product with confirmation
    const handleDelete = async (id: string, name: string) => {
        if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
            setIsSaving(true);
            try {
                await deleteProduct(id);
            } catch (error) {
                console.error("Failed to delete product", error);
                alert("Failed to delete product");
            } finally {
                setIsSaving(false);
            }
        }
    };

    // Duplicate product
    const duplicateProduct = async (product: Product) => {
        setIsSaving(true);
        try {
            const duplicatedProduct: Product = {
                ...product,
                id: `prod_${Date.now()}`,
                name: `${product.name} (Copy)`,
                sizeInventory: product.sizes?.reduce((acc, size) => ({ ...acc, [size]: 0 }), {}) || {},
            };
            await addProduct(duplicatedProduct);
            // Scroll to top to see the new product
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error("Failed to duplicate product", error);
            alert("Failed to duplicate product");
        } finally {
            setIsSaving(false);
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

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 bg-gray-50">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="font-display text-4xl font-bold uppercase mb-2">Admin Dashboard</h1>
                        <div className="flex items-center gap-2">
                            <p className="text-gray-600">Manage products and inventory</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${isSupabaseConfigured ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {isSupabaseConfigured ? '● Live Database' : '● Local Storage'}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                if (window.confirm('Reset all products to default? This cannot be undone.')) {
                                    localStorage.removeItem('coalition_products_v3');
                                    window.location.reload();
                                }
                            }}
                            className="flex items-center gap-2 bg-white border-2 border-gray-200 text-gray-600 px-4 py-3 rounded-sm font-bold uppercase tracking-widest hover:border-red-500 hover:text-red-500 transition"
                            title="Reset to default products"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                        <button
                            onClick={initNewProduct}
                            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition"
                        >
                            <Plus className="w-5 h-5" />
                            Add Product
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 mb-8 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-wide transition-colors ${activeTab === 'products'
                            ? 'border-b-2 border-black text-black'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Package size={20} />
                        Products
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-wide transition-colors ${activeTab === 'orders'
                            ? 'border-b-2 border-black text-black'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <ShoppingCart size={20} />
                        Orders
                    </button>
                    <button
                        onClick={() => setActiveTab('git')}
                        className={`flex items-center gap-2 px-6 py-3 font-bold uppercase tracking-wide transition-colors ${activeTab === 'git'
                            ? 'border-b-2 border-black text-black'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <GitBranch size={20} />
                        Version Control
                    </button>
                </div>

                {/* Conditional Content Based on Active Tab */}
                {activeTab === 'orders' ? (
                    <Orders />
                ) : activeTab === 'git' ? (
                    <GitManager />
                ) : (
                    <>
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Package className="w-6 h-6 text-blue-600" />
                                    <h3 className="font-bold text-gray-600 uppercase text-sm">Total Products</h3>
                                </div>
                                <p className="text-3xl font-bold">{products.length}</p>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <DollarSign className="w-6 h-6 text-green-600" />
                                    <h3 className="font-bold text-gray-600 uppercase text-sm">Total Inventory Value</h3>
                                </div>
                                <p className="text-3xl font-bold">
                                    ${products.reduce((sum, p) => {
                                        const totalStock = p.sizeInventory ? Object.values(p.sizeInventory).reduce((a, b) => (a as number) + (b as number), 0) : 0;
                                        return sum + (p.price * totalStock);
                                    }, 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <Package className="w-6 h-6 text-purple-600" />
                                    <h3 className="font-bold text-gray-600 uppercase text-sm">Total Stock Units</h3>
                                </div>
                                <p className="text-3xl font-bold">
                                    {products.reduce((sum, p) => {
                                        const totalStock = p.sizeInventory ? Object.values(p.sizeInventory).reduce((a: number, b: number) => a + b, 0) : 0;
                                        return sum + totalStock;
                                    }, 0)}
                                </p>
                            </div>
                        </div>

                        {/* Add/Edit Form */}
                        {(isAdding || editingId) && (
                            <div className="bg-white rounded-lg shadow-lg p-6 mb-8 border-2 border-black">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="font-display text-2xl font-bold uppercase">
                                        {isAdding ? 'Add New Product' : 'Edit Product'}
                                    </h2>
                                    <button onClick={cancelEdit} className="text-gray-500 hover:text-black transition" aria-label="Close form" title="Close form">
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Basic Info */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold mb-2 uppercase">Product Name *</label>
                                            <input
                                                type="text"
                                                value={editForm.name || ''}
                                                onChange={(e) => updateField('name', e.target.value)}
                                                className="w-full border-2 border-gray-300 rounded p-3 focus:border-black outline-none"
                                                placeholder="Coalition Classic Tee"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold mb-2 uppercase">Price ($) *</label>
                                            <input
                                                type="number"
                                                value={editForm.price || 0}
                                                onChange={(e) => updateField('price', parseFloat(e.target.value))}
                                                className="w-full border-2 border-gray-300 rounded p-3 focus:border-black outline-none"
                                                placeholder="45.00"
                                                step="0.01"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold mb-2 uppercase">Size Inventory *</label>
                                            <div className="space-y-2">
                                                {(editForm.sizes || ['S', 'M', 'L', 'XL']).map((size) => (
                                                    <div key={size} className="flex items-center gap-3">
                                                        <span className="w-16 text-sm font-bold text-gray-600">{size}:</span>
                                                        <input
                                                            type="number"
                                                            value={editForm.sizeInventory?.[size] || 0}
                                                            onChange={(e) => {
                                                                const newInventory = { ...(editForm.sizeInventory || {}) };
                                                                newInventory[size] = parseInt(e.target.value) || 0;
                                                                setEditForm(prev => ({ ...prev, sizeInventory: newInventory }));
                                                            }}
                                                            className="flex-1 border-2 border-gray-300 rounded p-2 focus:border-black outline-none"
                                                            placeholder="0"
                                                            min="0"
                                                        />
                                                    </div>
                                                ))}
                                                <p className="text-xs text-gray-500 mt-2">
                                                    Total: {Object.values(editForm.sizeInventory || {}).reduce((a, b) => (a as number) + (b as number), 0)} units
                                                </p>
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="category-select" className="block text-sm font-bold mb-2 uppercase">Category</label>
                                            <select
                                                id="category-select"
                                                value={editForm.category || 'apparel'}
                                                onChange={(e) => updateField('category', e.target.value as 'apparel' | 'accessory')}
                                                className="w-full border-2 border-gray-300 rounded p-3 focus:border-black outline-none"
                                            >
                                                <option value="apparel">Apparel</option>
                                                <option value="accessory">Accessory</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="featured"
                                                checked={editForm.isFeatured || false}
                                                onChange={(e) => updateField('isFeatured', e.target.checked)}
                                                className="w-5 h-5"
                                            />
                                            <label htmlFor="featured" className="text-sm font-bold uppercase cursor-pointer">
                                                Featured Product
                                            </label>
                                        </div>
                                    </div>

                                    {/* Images & Description */}
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold mb-2 uppercase flex items-center gap-2">
                                                <ImageIcon className="w-4 h-4" />
                                                Product Images *
                                            </label>
                                            {(editForm.images || ['']).map((img, index) => (
                                                <div key={index} className="flex gap-2 mb-2">
                                                    <input
                                                        type="text"
                                                        value={img}
                                                        onChange={(e) => updateImage(index, e.target.value)}
                                                        className="flex-1 border-2 border-gray-300 rounded p-3 focus:border-black outline-none"
                                                        placeholder="https://example.com/image.jpg"
                                                    />
                                                    {(editForm.images?.length || 0) > 1 && (
                                                        <button
                                                            onClick={() => removeImageField(index)}
                                                            className="px-3 bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                                            aria-label="Remove image"
                                                            title="Remove image"
                                                        >
                                                            <X className="w-5 h-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            <button
                                                onClick={addImageField}
                                                className="text-sm text-blue-600 hover:text-blue-800 font-bold uppercase"
                                            >
                                                + Add Another Image
                                            </button>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold mb-2 uppercase">Description</label>
                                            <textarea
                                                value={editForm.description || ''}
                                                onChange={(e) => updateField('description', e.target.value)}
                                                className="w-full border-2 border-gray-300 rounded p-3 focus:border-black outline-none"
                                                rows={4}
                                                placeholder="Product description..."
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold mb-2 uppercase">Available Sizes</label>
                                            <div className="flex gap-2 flex-wrap">
                                                {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'].map(size => (
                                                    <label key={size} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={(editForm.sizes || []).includes(size)}
                                                            onChange={(e) => {
                                                                const currentSizes = editForm.sizes || [];
                                                                const newSizes = e.target.checked
                                                                    ? [...currentSizes, size]
                                                                    : currentSizes.filter(s => s !== size);
                                                                updateField('sizes', newSizes);
                                                            }}
                                                            className="w-4 h-4"
                                                        />
                                                        <span className="text-sm font-medium">{size}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-4 mt-6 pt-6 border-t-2 border-gray-200">
                                    <button
                                        onClick={saveProduct}
                                        disabled={isSaving}
                                        className={`flex items-center gap-2 bg-black text-white px-6 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <Save className="w-5 h-5" />
                                        {isSaving ? 'Saving...' : (isAdding ? 'Add Product' : 'Save Changes')}
                                    </button>
                                    <button
                                        onClick={cancelEdit}
                                        className="flex items-center gap-2 bg-gray-200 text-gray-800 px-6 py-3 rounded-sm font-bold uppercase tracking-widest hover:bg-gray-300 transition"
                                    >
                                        <X className="w-5 h-5" />
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Products Table */}
                        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-100 border-b-2 border-gray-200">
                                        <tr>
                                            <th className="text-left p-4 font-bold uppercase text-sm">Image</th>
                                            <th className="text-left p-4 font-bold uppercase text-sm">Product</th>
                                            <th className="text-left p-4 font-bold uppercase text-sm">SKU</th>
                                            <th className="text-left p-4 font-bold uppercase text-sm">Price</th>
                                            <th className="text-left p-4 font-bold uppercase text-sm">Size Inventory</th>
                                            <th className="text-left p-4 font-bold uppercase text-sm">Category</th>
                                            <th className="text-left p-4 font-bold uppercase text-sm">Featured</th>
                                            <th className="text-right p-4 font-bold uppercase text-sm">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {products.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="text-center p-12 text-gray-500">
                                                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                                    <p className="font-bold">No products yet</p>
                                                    <p className="text-sm">Click "Add Product" to create your first product</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            products.map(product => (
                                                <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                                    <td className="p-4">
                                                        <img
                                                            src={product.images[0]}
                                                            alt={product.name}
                                                            className="w-16 h-16 object-cover rounded bg-gray-100"
                                                        />
                                                    </td>
                                                    <td className="p-4">
                                                        <p className="font-bold">{product.name}</p>
                                                        <p className="text-sm text-gray-500 truncate max-w-xs">
                                                            {product.description}
                                                        </p>
                                                    </td>
                                                    <td className="p-4">
                                                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                            {product.id}
                                                        </code>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="font-bold text-green-600">
                                                            ${product.price.toFixed(2)}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {product.sizeInventory ? (
                                                            <div className="space-y-1">
                                                                {Object.entries(product.sizeInventory).map(([size, qty]: [string, number]) => {
                                                                    return (
                                                                        <div key={size} className="flex items-center gap-2 text-xs">
                                                                            <span className="font-medium text-gray-600 w-10">{size}:</span>
                                                                            <span className={`font-bold ${qty > 10 ? 'text-green-600' : qty > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                                {qty}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                                <div className="text-xs font-bold text-gray-800 pt-1 border-t border-gray-200">
                                                                    Total: {Object.values(product.sizeInventory).reduce((a: number, b: number) => a + b, 0)}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-sm">No inventory</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="text-sm capitalize bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                            {product.category}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        {product.isFeatured && (
                                                            <span className="text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                                                ⭐ Featured
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex gap-2 justify-end">
                                                            <button
                                                                onClick={() => duplicateProduct(product)}
                                                                className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200 transition"
                                                                title="Duplicate Product"
                                                                aria-label="Duplicate Product"
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => startEdit(product)}
                                                                className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition"
                                                                title="Edit Product"
                                                                aria-label="Edit Product"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(product.id, product.name)}
                                                                className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                                                title="Delete Product"
                                                                aria-label="Delete Product"
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
                    </>
                )}
            </div>
        </div>
    );
};

export default Admin;
