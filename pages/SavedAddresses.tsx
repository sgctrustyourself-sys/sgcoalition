import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MapPin, Plus, Edit2, Trash2, Check } from 'lucide-react';
import { Address } from '../types';

const SavedAddresses = () => {
    const { user } = useApp();
    const [addresses, setAddresses] = useState<Address[]>(user?.addresses || []);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Partial<Address>>({
        label: '',
        fullName: '',
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States',
        isDefault: false
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingId) {
            // Update existing address
            setAddresses(prev => prev.map(addr =>
                addr.id === editingId ? { ...formData, id: editingId } as Address : addr
            ));
            setEditingId(null);
        } else {
            // Add new address
            const newAddress: Address = {
                ...formData,
                id: `addr_${Date.now()}`,
                isDefault: addresses.length === 0 || formData.isDefault || false
            } as Address;

            setAddresses(prev => [...prev, newAddress]);
            setIsAdding(false);
        }

        // Reset form
        setFormData({
            label: '',
            fullName: '',
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: 'United States',
            isDefault: false
        });
    };

    const handleEdit = (address: Address) => {
        setFormData(address);
        setEditingId(address.id);
        setIsAdding(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this address?')) {
            setAddresses(prev => prev.filter(addr => addr.id !== id));
        }
    };

    const handleSetDefault = (id: string) => {
        setAddresses(prev => prev.map(addr => ({
            ...addr,
            isDefault: addr.id === id
        })));
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold font-display uppercase mb-2">Saved Addresses</h1>
                    <p className="text-gray-400">Manage your delivery addresses</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black font-bold rounded hover:bg-gray-200 transition"
                    >
                        <Plus className="w-5 h-5" />
                        Add Address
                    </button>
                )}
            </div>

            {/* Add/Edit Form */}
            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-gray-900 border border-white/10 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Address' : 'New Address'}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">Label</label>
                            <input
                                type="text"
                                value={formData.label}
                                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                placeholder="Home, Work, etc."
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">Full Name</label>
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-sm font-bold mb-2">Street Address</label>
                        <input
                            type="text"
                            value={formData.street}
                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-bold mb-2">City</label>
                            <input
                                type="text"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">State</label>
                            <input
                                type="text"
                                value={formData.state}
                                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">ZIP Code</label>
                            <input
                                type="text"
                                value={formData.zipCode}
                                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 focus:outline-none"
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.isDefault}
                                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                            />
                            <span className="text-sm">Set as default address</span>
                        </label>
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="submit"
                            className="flex-1 bg-white text-black font-bold py-2 rounded hover:bg-gray-200 transition"
                        >
                            {editingId ? 'Update Address' : 'Save Address'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsAdding(false);
                                setEditingId(null);
                                setFormData({
                                    label: '',
                                    fullName: '',
                                    street: '',
                                    city: '',
                                    state: '',
                                    zipCode: '',
                                    country: 'United States',
                                    isDefault: false
                                });
                            }}
                            className="flex-1 bg-white/5 border border-white/10 font-bold py-2 rounded hover:bg-white/10 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {/* Addresses List */}
            {addresses.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/50 rounded-xl border border-white/10 border-dashed">
                    <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                    <h2 className="text-xl font-bold mb-2">No saved addresses</h2>
                    <p className="text-gray-400 mb-6">Add an address for faster checkout</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.map(address => (
                        <div key={address.id} className="bg-gray-900 border border-white/10 rounded-xl p-6 relative">
                            {address.isDefault && (
                                <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded text-green-500 text-xs font-bold">
                                    <Check className="w-3 h-3" />
                                    Default
                                </div>
                            )}

                            <div className="mb-4">
                                <h3 className="font-bold text-lg mb-1">{address.label}</h3>
                                <p className="text-sm text-gray-400">{address.fullName}</p>
                            </div>

                            <div className="text-sm text-gray-300 mb-4">
                                <p>{address.street}</p>
                                <p>{address.city}, {address.state} {address.zipCode}</p>
                                <p>{address.country}</p>
                            </div>

                            <div className="flex gap-2">
                                {!address.isDefault && (
                                    <button
                                        onClick={() => handleSetDefault(address.id)}
                                        className="flex-1 text-xs py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded font-bold transition"
                                    >
                                        Set Default
                                    </button>
                                )}
                                <button
                                    onClick={() => handleEdit(address)}
                                    className="flex-1 text-xs py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-500 rounded font-bold transition flex items-center justify-center gap-1"
                                >
                                    <Edit2 className="w-3 h-3" />
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(address.id)}
                                    className="flex-1 text-xs py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded font-bold transition flex items-center justify-center gap-1"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SavedAddresses;
