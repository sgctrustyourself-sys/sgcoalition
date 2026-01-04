import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Tag, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../services/supabase';

interface Coupon {
    id: string;
    code: string;
    discount_type: 'percent' | 'fixed';
    discount_value: number;
    min_order_value: number;
    max_uses: number | null;
    used_count: number;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
}

const CouponManager: React.FC = () => {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [newCode, setNewCode] = useState('');
    const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
    const [discountValue, setDiscountValue] = useState('');
    const [minOrder, setMinOrder] = useState('0');
    const [maxUses, setMaxUses] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        fetchCoupons();
    }, []);

    const fetchCoupons = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('coupons')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching coupons:', error);
            setError('Failed to load coupons');
        } else {
            setCoupons(data || []);
        }
        setIsLoading(false);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const { error } = await supabase.from('coupons').insert({
                code: newCode.toUpperCase(),
                discount_type: discountType,
                discount_value: parseFloat(discountValue),
                min_order_value: parseFloat(minOrder),
                max_uses: maxUses ? parseInt(maxUses) : null,
                end_date: endDate || null,
                is_active: true
            });

            if (error) throw error;

            setShowForm(false);
            setNewCode('');
            setDiscountValue('');
            fetchCoupons();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const toggleStatus = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('coupons')
            .update({ is_active: !currentStatus })
            .eq('id', id);

        if (!error) fetchCoupons();
    };

    const deleteCoupon = async (id: string) => {
        if (!confirm('Are you sure you want to delete this coupon?')) return;

        const { error } = await supabase
            .from('coupons')
            .delete()
            .eq('id', id);

        if (!error) fetchCoupons();
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-white">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Tag className="w-5 h-5 text-brand-accent" />
                        Coupon Manager
                    </h2>
                    <p className="text-gray-400 text-sm">Manage discount codes and sales campaigns</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-brand-accent text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-white transition"
                >
                    <Plus className="w-4 h-4" />
                    Create Coupon
                </button>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-400">{error}</span>
                </div>
            )}

            {showForm && (
                <div className="mb-8 bg-white/5 p-6 rounded-xl border border-white/10">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Coupon Code</label>
                                <input
                                    required
                                    type="text"
                                    value={newCode}
                                    onChange={e => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white font-mono"
                                    placeholder="SUMMER2025"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Type</label>
                                    <select
                                        value={discountType}
                                        onChange={e => setDiscountType(e.target.value as 'percent' | 'fixed')}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                    >
                                        <option value="percent">Percent (%)</option>
                                        <option value="fixed">Fixed Amount ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Value</label>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        value={discountValue}
                                        onChange={e => setDiscountValue(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                        placeholder={discountType === 'percent' ? '20' : '10.00'}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Min Order ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={minOrder}
                                    onChange={e => setMinOrder(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Expiry Date (Optional)</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="bg-white text-black px-6 py-2 rounded-lg font-bold hover:bg-gray-200"
                            >
                                Create Coupon
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="text-gray-400 text-sm border-b border-white/10">
                        <tr>
                            <th className="pb-3 pl-4">Code</th>
                            <th className="pb-3">Discount</th>
                            <th className="pb-3">Usage</th>
                            <th className="pb-3">Status</th>
                            <th className="pb-3 text-right pr-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {isLoading ? (
                            <tr><td colSpan={5} className="text-center py-8 text-gray-500">Loading coupons...</td></tr>
                        ) : coupons.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-8 text-gray-500">No coupons created yet</td></tr>
                        ) : (
                            coupons.map(coupon => (
                                <tr key={coupon.id} className="border-b border-white/5 hover:bg-white/5 transition">
                                    <td className="py-4 pl-4 font-mono text-brand-accent font-bold">{coupon.code}</td>
                                    <td className="py-4">
                                        {coupon.discount_type === 'percent'
                                            ? `${coupon.discount_value}% OFF`
                                            : `$${coupon.discount_value} OFF`}
                                        {coupon.min_order_value > 0 && <span className="text-gray-500 text-xs block">Min: ${coupon.min_order_value}</span>}
                                    </td>
                                    <td className="py-4">
                                        {coupon.used_count} uses
                                        {coupon.max_uses && <span className="text-gray-500"> / {coupon.max_uses}</span>}
                                    </td>
                                    <td className="py-4">
                                        <button
                                            onClick={() => toggleStatus(coupon.id, coupon.is_active)}
                                            className={`px-2 py-1 rounded text-xs font-bold ${coupon.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                                        >
                                            {coupon.is_active ? 'ACTIVE' : 'INACTIVE'}
                                        </button>
                                    </td>
                                    <td className="py-4 text-right pr-4">
                                        <button
                                            onClick={() => deleteCoupon(coupon.id)}
                                            className="p-2 text-gray-500 hover:text-red-400 transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CouponManager;
