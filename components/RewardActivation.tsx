import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, X, Zap, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';

const RewardActivation = () => {
    const { user, login } = useApp();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Show only if user is NOT connected and hasn't dismissed it
        const hasDismissed = sessionStorage.getItem('dismissed_reward_widget');
        if (!user && !hasDismissed) {
            const timer = setTimeout(() => setIsVisible(true), 3000); // Delay appearance
            return () => clearTimeout(timer);
        }
    }, [user]);

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('dismissed_reward_widget', 'true');
    };

    const handleConnect = async () => {
        await login();
        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, x: 20 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-6 right-6 z-50 w-full max-w-sm"
                >
                    <div className="bg-black/80 backdrop-blur-xl border border-purple-500/30 p-5 rounded-2xl shadow-2xl relative overflow-hidden group">

                        {/* Glow Effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 blur-[50px] rounded-full translate-x-1/2 -translate-y-1/2" />

                        <button
                            onClick={handleDismiss}
                            className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors"
                            aria-label="Dismiss Reward Widget"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl shadow-lg shrink-0">
                                <CreditCard className="text-white w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-lg leading-tight mb-1">
                                    Shop & Earn Crypto
                                </h3>
                                <p className="text-xs text-gray-300 leading-relaxed mb-3">
                                    Did you know? You earn <span className="text-purple-400 font-bold">SGCOIN</span> rewards on every purchase, even with credit cards.
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleConnect}
                                        className="bg-white text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-purple-500 hover:text-white transition-all flex items-center gap-2"
                                    >
                                        <Wallet size={12} />
                                        Activate Rewards
                                    </button>
                                    <button
                                        onClick={handleDismiss}
                                        className="text-gray-400 text-xs font-bold px-2 py-2 hover:text-white transition-colors"
                                    >
                                        Maybe Later
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default RewardActivation;
