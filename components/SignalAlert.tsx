import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell,
    X,
    AlertCircle,
    CheckCircle2,
    Zap,
    ArrowRight,
    Info,
    Megaphone
} from 'lucide-react';
import { useApp } from '../context/AppContext';

const SignalAlert: React.FC = () => {
    const { signals } = useApp();
    const [dismissedIds, setDismissedIds] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Filter out dismissed signals
    const activeSignals = signals.filter(s => !dismissedIds.includes(s.id));

    useEffect(() => {
        if (activeSignals.length > 1) {
            const timer = setInterval(() => {
                setCurrentIndex(prev => (prev + 1) % activeSignals.length);
            }, 8000);
            return () => clearInterval(timer);
        } else {
            setCurrentIndex(0);
        }
    }, [activeSignals.length]);

    if (activeSignals.length === 0) return null;

    const currentSignal = activeSignals[currentIndex] || activeSignals[0];

    const typeStyles = {
        info: 'from-blue-900/40 to-blue-800/20 border-blue-500/30 text-blue-200 icon-blue-400',
        alert: 'from-amber-900/40 to-amber-800/20 border-amber-500/30 text-amber-200 icon-amber-400',
        success: 'from-emerald-900/40 to-emerald-800/20 border-emerald-500/30 text-emerald-200 icon-emerald-400',
        process: 'from-purple-900/40 to-purple-800/20 border-purple-500/30 text-purple-200 icon-purple-400',
        urgent: 'from-red-900/60 to-red-800/40 border-red-500/50 text-white icon-red-400 animate-pulse-subtle'
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'alert': return <AlertCircle className="w-5 h-5" />;
            case 'success': return <CheckCircle2 className="w-5 h-5" />;
            case 'process': return <Zap className="w-5 h-5" />;
            case 'urgent': return <Megaphone className="w-5 h-5 font-bold" />;
            default: return <Info className="w-5 h-5" />;
        }
    };

    const handleDismiss = (id: string) => {
        setDismissedIds(prev => [...prev, id]);
        if (currentIndex >= activeSignals.length - 1) {
            setCurrentIndex(0);
        }
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={currentSignal.id}
                initial={{ height: 0, opacity: 0, y: -20 }}
                animate={{ height: 'auto', opacity: 1, y: 0 }}
                exit={{ height: 0, opacity: 0, y: -20 }}
                transition={{ duration: 0.5, ease: "circOut" }}
                className="relative z-[60] overflow-hidden"
            >
                <div className={`bg-gradient-to-r ${typeStyles[currentSignal.type] || typeStyles.info} border-b backdrop-blur-md`}>
                    <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`p-1.5 rounded-lg bg-white/10 shrink-0`}>
                                    {getIcon(currentSignal.type)}
                                </div>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 min-w-0">
                                    <span className="font-display font-black uppercase text-[10px] tracking-widest whitespace-nowrap opacity-80">
                                        Signal: {currentSignal.title}
                                    </span>
                                    <p className="text-sm font-medium truncate opacity-90">
                                        {currentSignal.message}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                {currentSignal.action_url && (
                                    <a
                                        href={currentSignal.action_url}
                                        className="hidden sm:flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all h-8"
                                    >
                                        {currentSignal.action_label || 'Launch'} <ArrowRight className="w-3 h-3" />
                                    </a>
                                )}

                                {activeSignals.length > 1 && (
                                    <div className="flex items-center gap-1 text-[10px] font-mono opacity-50 px-2 py-1 bg-black/20 rounded">
                                        {currentIndex + 1}/{activeSignals.length}
                                    </div>
                                )}

                                <button
                                    onClick={() => handleDismiss(currentSignal.id)}
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors opacity-60 hover:opacity-100"
                                    aria-label="Dismiss Signal"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
};

export default SignalAlert;
