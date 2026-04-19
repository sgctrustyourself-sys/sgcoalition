import React, { useState, useEffect } from 'react';
import { Clock, Lock, ShieldCheck, Trophy } from 'lucide-react';

interface GiveawayCountdownProps {
    startDate: string;
    endDate: string;
    onStatusChange?: (status: 'upcoming' | 'active' | 'ended') => void;
}

const GiveawayCountdown: React.FC<GiveawayCountdownProps> = ({ startDate, endDate, onStatusChange }) => {
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0
    });
    const [status, setStatus] = useState<'upcoming' | 'active' | 'ended'>('upcoming');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const start = new Date(startDate).getTime();
            const end = new Date(endDate).getTime();
            
            let target = end;
            let currentStatus: 'upcoming' | 'active' | 'ended' = 'active';

            if (now < start) {
                target = start;
                currentStatus = 'upcoming';
            } else if (now > end) {
                currentStatus = 'ended';
            }

            if (status !== currentStatus) {
                setStatus(currentStatus);
                onStatusChange?.(currentStatus);
            }

            const difference = target - now;

            if (difference > 0) {
                setTimeLeft({
                    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((difference / 1000 / 60) % 60),
                    seconds: Math.floor((difference / 1000) % 60)
                });
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            }
        };

        const timer = setInterval(calculateTimeLeft, 1000);
        calculateTimeLeft(); // Initial call

        return () => clearInterval(timer);
    }, [startDate, endDate, status, onStatusChange]);

    if (status === 'ended') {
        return (
            <div className="bg-white/5 border border-white/10 p-8 rounded-3xl text-center backdrop-blur-md animate-in fade-in duration-700">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <Trophy className="w-8 h-8 text-yellow-500" />
                </div>
                <h3 className="font-display font-black uppercase text-2xl tracking-tighter mb-2 italic">Access Closed</h3>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em]">The winner will be announced shortly.</p>
            </div>
        );
    }

    return (
        <div className="relative group">
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-white/10 to-transparent blur-xl opacity-0 group-hover:opacity-100 transition duration-1000" />
            
            <div className="relative bg-white/5 border border-white/10 p-6 md:p-8 rounded-3xl backdrop-blur-xl">
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10">
                            {status === 'upcoming' ? <Lock className="w-6 h-6 text-gray-400" /> : <Clock className="w-6 h-6 text-white animate-pulse" />}
                        </div>
                        <div>
                            <h3 className="font-display font-black uppercase text-xl tracking-tighter italic">
                                {status === 'upcoming' ? 'Portal Opening' : 'Portal Closing'}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                                <ShieldCheck className="w-3 h-3 text-white/40" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">
                                    {status === 'upcoming' ? 'Waiting for block time' : 'Automatic Secure Lock'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 md:gap-8">
                        <TimeUnit value={timeLeft.days} label="Days" />
                        <TimeUnit value={timeLeft.hours} label="Hours" />
                        <TimeUnit value={timeLeft.minutes} label="Mins" />
                        <TimeUnit value={timeLeft.seconds} label="Secs" isLast />
                    </div>
                </div>
            </div>
        </div>
    );
};

const TimeUnit = ({ value, label, isLast = false }: { value: number, label: string, isLast?: boolean }) => (
    <div className="flex items-center gap-4">
        <div className="text-center min-w-[50px]">
            <div className="font-mono font-black text-3xl md:text-4xl tracking-tighter text-white tabular-nums">
                {String(value).padStart(2, '0')}
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-1">{label}</div>
        </div>
        {!isLast && <div className="h-8 w-px bg-white/10 hidden md:block" />}
    </div>
);

export default GiveawayCountdown;
