import React, { useState } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Product } from '../types';
import { submitCustomInquiry } from '../services/customInquiry';

interface Props {
    product: Product;
    onClose: () => void;
}

const RequestSimilarModal: React.FC<Props> = ({ product, onClose }) => {
    const [form, setForm] = useState({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        description: '',
        budgetRange: '',
        timeline: '',
    });
    const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('sending');
        setErrorMsg('');

        // 1. Save to Supabase Database via the existing service
        try {
            // Map the product category to the expected types, or fallback to 'other'
            const categoryRaw = product.category?.toLowerCase() || '';
            let mappedType: 'apparel-pants' | 'apparel-shirt' | '3d-printed' | 'other' = 'other';
            if (categoryRaw.includes('pant') || categoryRaw.includes('denim') || categoryRaw.includes('jean')) mappedType = 'apparel-pants';
            else if (categoryRaw.includes('shirt') || categoryRaw.includes('tee') || categoryRaw.includes('hoodie')) mappedType = 'apparel-shirt';
            else if (categoryRaw.includes('3d')) mappedType = '3d-printed';

            await submitCustomInquiry({
                customerName: form.customerName,
                customerEmail: form.customerEmail,
                customerPhone: form.customerPhone || undefined,
                productType: mappedType,
                title: `Similar Style Request: ${product.name}`,
                description: `Reference Product: ${product.name} ($${product.price})\n\nCustomer's Request:\n${form.description}`,
                referenceImages: product.images,
                budgetRange: (form.budgetRange || 'flexible') as any,
                timeline: (form.timeline || 'flexible') as any
            });
        } catch (dbError) {
            console.error('Error saving inquiry to database:', dbError);
            // We don't throw here to ensure the email still attempts to send as a fallback
        }

        try {
            // 2. Send Email via Resend API
            const res = await fetch('/api/notify-inquiry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: form.customerName,
                    customerEmail: form.customerEmail,
                    customerPhone: form.customerPhone || undefined,
                    productType: product.category,
                    title: `Similar Style Request: ${product.name}`,
                    description: `Reference Product: ${product.name} ($${product.price})\n\nCustomer's Request:\n${form.description}`,
                    budgetRange: form.budgetRange || 'Flexible',
                    timeline: form.timeline || 'Flexible',
                    referenceImages: product.images,
                }),
            });

            if (!res.ok) throw new Error('Failed to send');
            setStatus('success');
        } catch (err: any) {
            setStatus('error');
            setErrorMsg('Something went wrong. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-[#111] border border-white/10 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Request Similar Style</h2>
                        <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-widest">{product.name}</p>
                    </div>
                    <button onClick={onClose} title="Close" className="p-1.5 hover:bg-white/10 transition-colors rounded-sm">
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                {status === 'success' ? (
                    <div className="px-6 py-12 text-center">
                        <div className="text-3xl mb-4">✅</div>
                        <h3 className="text-white font-bold uppercase tracking-widest text-sm mb-2">Request Sent!</h3>
                        <p className="text-gray-400 text-xs leading-relaxed">
                            We received your request and will reach out to <span className="text-white">{form.customerEmail}</span> shortly.
                        </p>
                        <button
                            onClick={onClose}
                            className="mt-8 px-8 py-3 bg-white text-black text-xs font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                        {/* Product Reference */}
                        <div className="flex gap-3 p-3 bg-white/5 border border-white/10">
                            <img src={product.images[0]} alt={product.name} className="w-14 h-14 object-cover grayscale opacity-60" />
                            <div className="flex flex-col justify-center">
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Reference</p>
                                <p className="text-xs text-white font-bold uppercase">{product.name}</p>
                                <p className="text-[10px] text-gray-500">${product.price} original</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Name *</label>
                                <input
                                    required
                                    value={form.customerName}
                                    onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                                    placeholder="Your name"
                                    className="bg-white/5 border border-white/10 text-white text-xs px-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Email *</label>
                                <input
                                    required
                                    type="email"
                                    value={form.customerEmail}
                                    onChange={e => setForm(f => ({ ...f, customerEmail: e.target.value }))}
                                    placeholder="your@email.com"
                                    className="bg-white/5 border border-white/10 text-white text-xs px-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Budget</label>
                                <select
                                    value={form.budgetRange}
                                    onChange={e => setForm(f => ({ ...f, budgetRange: e.target.value }))}
                                    title="Budget range"
                                    className="bg-[#111] border border-white/10 text-white text-xs px-3 py-2.5 focus:outline-none focus:border-white/30 transition-colors"
                                >
                                    <option value="">Flexible</option>
                                    <option value="Under $100">Under $100</option>
                                    <option value="$100 - $250">$100 – $250</option>
                                    <option value="$250 - $500">$250 – $500</option>
                                    <option value="$500+">$500+</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Timeline</label>
                                <select
                                    value={form.timeline}
                                    onChange={e => setForm(f => ({ ...f, timeline: e.target.value }))}
                                    title="Timeline"
                                    className="bg-[#111] border border-white/10 text-white text-xs px-3 py-2.5 focus:outline-none focus:border-white/30 transition-colors"
                                >
                                    <option value="">Flexible</option>
                                    <option value="ASAP">ASAP</option>
                                    <option value="1-2 weeks">1–2 weeks</option>
                                    <option value="1 month">1 month</option>
                                    <option value="No rush">No rush</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Describe what you want *</label>
                            <textarea
                                required
                                rows={4}
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Colors, materials, design details, sizing, any modifications from the original..."
                                className="bg-white/5 border border-white/10 text-white text-xs px-3 py-2.5 placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors resize-none"
                            />
                        </div>

                        {status === 'error' && (
                            <p className="text-red-400 text-xs text-center">{errorMsg}</p>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'sending'}
                            className="w-full bg-white text-black py-3.5 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-accent hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'sending' ? (
                                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
                            ) : (
                                <><Send className="w-3.5 h-3.5" /> Send Request</>
                            )}
                        </button>
                        <p className="text-[10px] text-gray-600 text-center">
                            Sent directly to sgctrustyourself@gmail.com
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
};

export default RequestSimilarModal;
