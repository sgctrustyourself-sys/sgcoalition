import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, Loader, Ghost } from 'lucide-react';
import { supabase } from '../services/supabase';

const SmsSignup = () => {
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('+1');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phone) return;

        setStatus('loading');
        setErrorMessage('');

        try {
            const { error } = await supabase
                .from('coalition_signal_subscribers')
                .insert([{
                    subscriber_type: 'sms',
                    contact_value: phone,
                    country_code: countryCode,
                    source: 'website_home'
                }]);

            if (error) {
                // Handle duplicate phone number
                if (error.code === '23505') {
                    setErrorMessage('This number is already subscribed to Coalition Signal!');
                } else {
                    throw error;
                }
                setStatus('error');
                return;
            }

            setStatus('success');
            setPhone('');
            // Reset success message after 5 seconds
            setTimeout(() => setStatus('idle'), 5000);
        } catch (err) {
            console.error('SMS signup error:', err);
            setErrorMessage('Failed to subscribe. Please try again.');
            setStatus('error');
        }
    };

    return (
        <section className="relative py-24 overflow-hidden bg-black">
            {/* Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Ethereal Gradient */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-900/10 rounded-full blur-[100px] animate-pulse" />

                {/* Floating Particles */}
                {[...Array(5)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute bg-white/5 rounded-full"
                        initial={{
                            x: Math.random() * window.innerWidth,
                            y: Math.random() * window.innerHeight,
                            scale: Math.random() * 0.5 + 0.5,
                            opacity: 0
                        }}
                        animate={{
                            y: [null, Math.random() * -100],
                            opacity: [0, 0.5, 0]
                        }}
                        transition={{
                            duration: Math.random() * 5 + 5,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        style={{
                            width: Math.random() * 4 + 2 + 'px',
                            height: Math.random() * 4 + 2 + 'px',
                        }}
                    />
                ))}
            </div>

            <div className="max-w-4xl mx-auto px-4 relative z-10">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-12 backdrop-blur-sm relative overflow-hidden group">
                    {/* Hover Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none" />

                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        {/* Text Content */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <motion.div
                                    animate={{
                                        opacity: [0.5, 1, 0.5],
                                        scale: [1, 1.1, 1]
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                >
                                    <Ghost className="w-6 h-6 text-blue-400" />
                                </motion.div>
                                <span className="text-blue-400 font-mono text-xs tracking-[0.2em] uppercase">Coalition Signal</span>
                            </div>

                            <h2 className="font-display text-4xl md:text-5xl font-bold uppercase leading-tight">
                                Join the <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">Signal</span>
                            </h2>

                            <p className="text-gray-400 leading-relaxed">
                                Exclusive bi-weekly updates, early drops, members-only discounts, and first access to new collections.
                            </p>
                        </div>

                        {/* Form Section */}
                        <div className="relative">
                            {status === 'success' ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-green-900/20 border border-green-500/30 rounded-xl p-8 text-center"
                                >
                                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle className="w-8 h-8 text-green-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">Signal Activated</h3>
                                    <p className="text-gray-400 text-sm">You're now connected to the Coalition network.</p>
                                </motion.div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {status === 'error' && errorMessage && (
                                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
                                            {errorMessage}
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <div className="w-24">
                                            <label htmlFor="country-code" className="sr-only">Country Code</label>
                                            <select
                                                id="country-code"
                                                value={countryCode}
                                                onChange={(e) => setCountryCode(e.target.value)}
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-4 text-white focus:border-blue-500/50 focus:outline-none transition appearance-none text-center font-mono"
                                            >
                                                <option value="+1">US +1</option>
                                                <option value="+44">UK +44</option>
                                                <option value="+1">CA +1</option>
                                                <option value="+61">AU +61</option>
                                            </select>
                                        </div>
                                        <div className="flex-1">
                                            <label htmlFor="phone-number" className="sr-only">Phone Number</label>
                                            <input
                                                id="phone-number"
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="(555) 000-0000"
                                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-4 text-white placeholder-gray-600 focus:border-blue-500/50 focus:outline-none transition font-mono"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={status === 'loading'}
                                        className="w-full bg-white text-black font-bold uppercase tracking-widest py-4 rounded-lg hover:bg-blue-50 transition-all duration-300 flex items-center justify-center gap-2 group/btn relative overflow-hidden disabled:opacity-50"
                                    >
                                        <span className="relative z-10 flex items-center gap-2">
                                            {status === 'loading' ? (
                                                <>
                                                    <Loader className="w-4 h-4 animate-spin" />
                                                    Activating...
                                                </>
                                            ) : (
                                                <>
                                                    Activate Updates
                                                    <Send className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </span>
                                        {/* Button Glow */}
                                        <div className="absolute inset-0 bg-blue-400/20 blur-xl opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                    </button>

                                    <p className="text-xs text-gray-600 text-center">
                                        No spam. You can unsubscribe anytime.
                                    </p>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SmsSignup;
