import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IntroScreen: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [shouldRender, setShouldRender] = useState(true);

    useEffect(() => {
        // Check session storage to show once per session (easier for testing)
        const hasSeenIntro = sessionStorage.getItem('coalition_intro_seen');

        if (!hasSeenIntro) {
            setIsVisible(true);
            sessionStorage.setItem('coalition_intro_seen', 'true');
        } else {
            setShouldRender(false);
        }
    }, []);

    const handleComplete = () => {
        setIsVisible(false);
        setTimeout(() => setShouldRender(false), 1000);
    };

    if (!shouldRender) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    className="fixed inset-0 z-[100] bg-[#050505] flex flex-col items-center justify-center overflow-hidden"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
                >
                    {/* Background Effects */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
                    <div className="absolute inset-0 bg-radial-gradient from-blue-900/10 via-black to-black" />

                    {/* Logo Container */}
                    <div className="relative mb-12">
                        {/* Rotating Chrome Ring */}
                        <motion.div
                            className="absolute inset-[-30px] border border-white/10 rounded-full"
                            animate={{
                                rotate: 360,
                                scale: [1, 1.05, 1],
                            }}
                            transition={{
                                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                                scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                            }}
                        />

                        {/* Inner Blue Glow Ring */}
                        <motion.div
                            className="absolute inset-[-15px] border border-blue-500/30 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.2)]"
                            animate={{
                                rotate: -360,
                                opacity: [0.5, 0.8, 0.5],
                            }}
                            transition={{
                                rotate: { duration: 15, repeat: Infinity, ease: "linear" },
                                opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                            }}
                        />

                        {/* Logo */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, filter: "blur(10px)" }}
                            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                            className="relative z-10 w-40 h-40 bg-black rounded-full flex items-center justify-center border border-white/10 shadow-[0_0_50px_rgba(59,130,246,0.15)]"
                        >
                            <img
                                src="/images/logo.png"
                                alt="Coalition Logo"
                                className="w-28 h-28 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#E5E5E5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>';
                                }}
                            />
                        </motion.div>
                    </div>

                    {/* Text Animation */}
                    <div className="text-center z-10 space-y-2">
                        <div className="overflow-hidden">
                            <motion.h1
                                initial={{ y: 50 }}
                                animate={{ y: 0 }}
                                transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
                                className="font-display text-7xl font-bold tracking-[0.2em] text-white uppercase"
                            >
                                Coalition
                            </motion.h1>
                        </div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8, duration: 0.8 }}
                            className="flex items-center justify-center gap-4"
                        >
                            <div className="h-[1px] w-12 bg-blue-500/50" />
                            <p className="text-gray-400 text-sm tracking-[0.3em] uppercase font-medium">
                                Crafted in Baltimore
                            </p>
                            <div className="h-[1px] w-12 bg-blue-500/50" />
                        </motion.div>
                    </div>

                    {/* Loading Bar */}
                    <div className="mt-16 w-48 h-[2px] bg-white/10 rounded-full overflow-hidden relative z-10">
                        <motion.div
                            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2.5, ease: "easeInOut", delay: 0.5 }}
                            onAnimationComplete={handleComplete}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default IntroScreen;
