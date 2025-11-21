import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { OrderItem } from '../types';
import { X, Plus, Trash2 } from 'lucide-react';

interface ManualOrderFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const ManualOrderForm: React.FC<ManualOrderFormProps> = ({ onClose, onSuccess }) => {
    const { products, addOrder, generateOrderNumber } = useApp();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Customer information
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');

    // Order items
    const [orderItems, setOrderItems] = useState<Array<{
        productId: string;
        selectedSize: string;
        quantity: number;
    }>>([{ productId: '', selectedSize: '', quantity: 1 }]);

    // Payment and pricing
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'venmo' | 'zelle' | 'other'>('cash');
    const [discount, setDiscount] = useState(0);
    const [tax, setTax] = useState(0);
    const [notes, setNotes] = useState('');

    // Shipping (optional for manual orders)
    const [includeShipping, setIncludeShipping] = useState(false);
    const [shippingAddress, setShippingAddress] = useState({
        address1: '',
        city: '',
        state: '',
        zip: '',
        country: ''
    });

    const addOrderItem = () => {
        setOrderItems([...orderItems, { productId: '', selectedSize: '', quantity: 1 }]);
    };

    const removeOrderItem = (index: number) => {
        if (orderItems.length > 1) {
            setOrderItems(orderItems.filter((_, i) => i !== index));
        }
    };

    const updateOrderItem = (index: number, field: string, value: any) => {
        const updated = [...orderItems];
        updated[index] = { ...updated[index], [field]: value };
        setOrderItems(updated);
    };

    const calculateSubtotal = () => {
        return orderItems.reduce((sum, item) => {
            const product = products.find(p => p.id === item.productId);
            if (!product) return sum;
            return sum + (product.price * item.quantity);
        }, 0);
    };

    const calculateTotal = () => {
        const subtotal = calculateSubtotal();
        return subtotal + tax - discount;
    };

    const validateForm = (): boolean => {
        if (!customerName.trim()) {
            alert('Please enter customer name');
            return false;
        }
        if (!customerEmail.trim() || !customerEmail.includes('@')) {
            alert('Please enter a valid email');
            return false;
        }
        if (orderItems.some(item => !item.productId || !item.selectedSize || item.quantity < 1)) {
            alert('Please complete all order items');
            return false;
        }

        // Check inventory availability
        for (const item of orderItems) {
            const product = products.find(p => p.id === item.productId);
            if (!product) continue;

            const availableStock = product.sizeInventory?.[item.selectedSize] || 0;
            if (availableStock < item.quantity) {
                alert(`Insufficient stock for ${product.name} (Size ${item.selectedSize}). Available: ${availableStock}`);
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsSubmitting(true);

        try {
            const orderNumber = generateOrderNumber();
            const subtotal = calculateSubtotal();
            const total = calculateTotal();

            const items: OrderItem[] = orderItems.map(item => {
                const product = products.find(p => p.id === item.productId)!;
                return {
                    productId: product.id,
                    productName: product.name,
                    productImage: product.images[0],
                    selectedSize: item.selectedSize,
                    quantity: item.quantity,
                    price: product.price,
                    total: product.price * item.quantity
                };
            });

            const order = {
                id: `order_${Date.now()}`,
                orderNumber,
                customerName,
                customerEmail,
                customerPhone,
                items,
                subtotal,
                tax,
                discount,
                total,
                paymentMethod,
                paymentStatus: 'paid' as const,
                orderType: 'manual' as const,
                status: 'pending' as any,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                paidAt: new Date().toISOString(),
                notes,
                shippingAddress: includeShipping ? shippingAddress : undefined
            };

            await addOrder(order);
            alert(`Order ${orderNumber} created successfully!`);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating manual order:', error);
            alert('Failed to create order. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-900">Create Manual Order</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Customer Information */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-bold text-lg mb-4">Customer Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email *</label>
                                <input
                                    type="email"
                                    value={customerEmail}
                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Phone</label>
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Order Items */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">Order Items</h3>
                            <button
                                type="button"
                                onClick={addOrderItem}
                                className="flex items-center gap-2 px-3 py-1 bg-black text-white rounded-lg text-sm hover:bg-gray-800 transition"
                            >
                                <Plus size={16} />
                                Add Item
                            </button>
                        </div>
                        <div className="space-y-3">
                            {orderItems.map((item, index) => {
                                const selectedProduct = products.find(p => p.id === item.productId);
                                const availableStock = selectedProduct?.sizeInventory?.[item.selectedSize] || 0;

                                return (
                                    <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium mb-1">Product *</label>
                                                <select
                                                    value={item.productId}
                                                    onChange={(e) => updateOrderItem(index, 'productId', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                                    required
                                                >
                                                    <option value="">Select product...</option>
                                                    {products.map(product => (
                                                        <option key={product.id} value={product.id}>
                                                            {product.name} - ${product.price.toFixed(2)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Size *</label>
                                                <select
                                                    value={item.selectedSize}
                                                    onChange={(e) => updateOrderItem(index, 'selectedSize', e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                                    required
                                                    disabled={!item.productId}
                                                >
                                                    <option value="">Select size...</option>
                                                    {selectedProduct?.sizes?.map(size => {
                                                        const stock = selectedProduct.sizeInventory?.[size] || 0;
                                                        return (
                                                            <option key={size} value={size}>
                                                                {size} ({stock} available)
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="block text-sm font-medium mb-1">Qty *</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={availableStock}
                                                        value={item.quantity}
                                                        onChange={(e) => updateOrderItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                                        required
                                                    />
                                                </div>
                                                {orderItems.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeOrderItem(index)}
                                                        className="mt-6 p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                        title="Remove item"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {selectedProduct && item.selectedSize && (
                                            <div className="mt-2 text-sm text-gray-600">
                                                Item Total: ${(selectedProduct.price * item.quantity).toFixed(2)}
                                                {availableStock < item.quantity && (
                                                    <span className="ml-2 text-red-600 font-semibold">
                                                        ⚠ Insufficient stock!
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Payment Details */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-bold text-lg mb-4">Payment Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Payment Method *</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                >
                                    <option value="cash">Cash</option>
                                    <option value="venmo">Venmo</option>
                                    <option value="zelle">Zelle</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Tax ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={tax}
                                    onChange={(e) => setTax(parseFloat(e.target.value) || 0)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Discount ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={discount}
                                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600">Subtotal:</span>
                                    <span className="font-semibold">${calculateSubtotal().toFixed(2)}</span>
                                </div>
                                {tax > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Tax:</span>
                                        <span className="font-semibold">${tax.toFixed(2)}</span>
                                    </div>
                                )}
                                {discount > 0 && (
                                    <div className="flex justify-between text-sm text-green-600">
                                        <span>Discount:</span>
                                        <span className="font-semibold">-${discount.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                                    <span>Total:</span>
                                    <span>${calculateTotal().toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Shipping Address (Optional) */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                id="includeShipping"
                                checked={includeShipping}
                                onChange={(e) => setIncludeShipping(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <label htmlFor="includeShipping" className="font-bold text-lg cursor-pointer">
                                Include Shipping Address
                            </label>
                        </div>
                        {includeShipping && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">Address</label>
                                    <input
                                        type="text"
                                        value={shippingAddress.address1}
                                        onChange={(e) => setShippingAddress({ ...shippingAddress, address1: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">City</label>
                                    <input
                                        type="text"
                                        value={shippingAddress.city}
                                        onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">State</label>
                                    <input
                                        type="text"
                                        value={shippingAddress.state}
                                        onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">ZIP</label>
                                    <input
                                        type="text"
                                        value={shippingAddress.zip}
                                        onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Country</label>
                                    <input
                                        type="text"
                                        value={shippingAddress.country}
                                        onChange={(e) => setShippingAddress({ ...shippingAddress, country: e.target.value })}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-black focus:border-transparent"
                            placeholder="Add any additional notes about this order..."
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-end border-t border-gray-200 pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition font-bold uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Creating Order...' : 'Create Order'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualOrderForm;
