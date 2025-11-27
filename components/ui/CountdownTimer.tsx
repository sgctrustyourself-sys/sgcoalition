import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getTimeRemaining } from '../../utils/urgencyUtils';

interface CountdownTimerProps {
    endDate: string;
    onExpire?: () => void;
    className?: string;
    showIcon?: boolean;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({
    endDate,
    onExpire,
    className = '',
    showIcon = true
}) => {
    const [timeLeft, setTimeLeft] = useState(getTimeRemaining(endDate));

    useEffect(() => {
        const timer = setInterval(() => {
            const remaining = getTimeRemaining(endDate);
            setTimeLeft(remaining);

            if (remaining.total <= 0) {
                clearInterval(timer);
                onExpire?.();
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [endDate, onExpire]);

    if (timeLeft.total <= 0) {
        return null;
    }

    const { days, hours, minutes, seconds } = timeLeft;

    return (
        <div className={`inline-flex items-center gap-2 ${className}`}>
            {showIcon && <Clock className="w-4 h-4" />}
            <div className="flex items-center gap-1 font-mono font-bold">
                {days > 0 && (
                    <>
                        <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded">
                            {String(days).padStart(2, '0')}
                        </span>
                        <span className="text-gray-400">:</span>
                    </>
                )}
                <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded">
                    {String(hours).padStart(2, '0')}
                </span>
                <span className="text-gray-400">:</span>
                <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded">
                    {String(minutes).padStart(2, '0')}
                </span>
                <span className="text-gray-400">:</span>
                <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded">
                    {String(seconds).padStart(2, '0')}
                </span>
            </div>
        </div>
    );
};

export default CountdownTimer;
