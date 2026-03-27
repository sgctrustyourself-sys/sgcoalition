import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Timer, Users, Zap, ChevronRight } from 'lucide-react';

const DropCountdown = () => {
    // Target Date: 3 days from now (Simulated for demo)
    const [timeLeft, setTimeLeft] = useState({ days: 3, hours: 14, minutes: 22, seconds: 45 });
    // Participation Count (Simulated)
    const [joinedCount, setJoinedCount] = useState(1420);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                let { days, hours, minutes, seconds } = prev;
                if (seconds > 0) {
                    seconds--;
                } else {
                    seconds = 59;
                    if (minutes > 0) {
                        minutes--;
                    } else {
                        minutes = 59;
                        if (hours > 0) {
                            hours--;
                        } else {
                            hours = 23;
                            if (days > 0) days--;
                        }
                    }
                }
                return { days, hours, minutes, seconds };
            });
        }, 1000);

        // Simulate random joins
        const joiner = setInterval(() => {
            if (Math.random() > 0.7) {
                setJoinedCount(prev => prev + 1);
            }
        }, 2000);

        return () => {
            clearInterval(timer);
            clearInterval(joiner);
        };
    }, []);

    // Format helper
    const pad = (n: number) => n.toString().padStart(2, '0');

    return (
        <div className="bg-black border border-gray-800 rounded-3xl p-6 relative overflow-hidden group">
            {/* Background Effects */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 blur-[50px] rounded-full group-hover:bg-purple-600/20 transition duration-700" />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">Next Drop Incoming</span>
                        </div>
                        <h2 className="font-display text-2xl font-black uppercase italic tracking-tighter text-white">
                            "Quantum Drift"
                        </h2>
                    </div>
                </div>

                {/* Cyber Timer */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                    {[
                        { label: 'DAYS', val: timeLeft.days },
                        { label: 'HRS', val: timeLeft.hours },
                        { label: 'MINS', val: timeLeft.minutes },
                        { label: 'SECS', val: timeLeft.seconds },
                    ].map((item, i) => (
                        <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-center">
                            <div className="font-mono text-xl md:text-2xl font-bold text-white leading-none mb-1">
                                {pad(item.val)}
                            </div>
                            <div className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">
                                {item.label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Participation Meter */}
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Joined Waitlist</span>
                        <span className="text-white">{joinedCount.toLocaleString()}</span>
                    </div>

                    {/* Progress Bar container */}
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden relative">
                        {/* Fill */}
                        <motion.div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-600 to-blue-500"
                            initial={{ width: "40%" }}
                            animate={{ width: "72%" }} // Mock percentage
                            transition={{ duration: 2, ease: "easeOut" }}
                        />
                        {/* Shimmer effect */}
                        <motion.div
                            className="absolute top-0 left-0 w-full h-full bg-white/20 skew-x-[-20deg]"
                            initial={{ x: "-100%" }}
                            animate={{ x: "200%" }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                        />
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className="text-[8px] text-gray-600 uppercase">Target: 2,000</span>
                        <span className="text-[8px] text-purple-400 uppercase font-bold animate-pulse">Filling Fast</span>
                    </div>
                </div>

                {/* CTA */}
                <button className="w-full bg-white text-black font-bold uppercase tracking-wider py-3 rounded-xl hover:bg-gray-200 transition flex items-center justify-center gap-2 group/btn">
                    <Zap className="w-4 h-4 fill-black" />
                    Join The List
                    <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition" />
                </button>
            </div>
        </div>
    );
};

export default DropCountdown;
