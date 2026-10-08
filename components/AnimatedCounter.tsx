import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
    end: number;
    duration?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    className?: string;
}

export const AnimatedCounter = ({
    end,
    duration = 2000,
    prefix = '',
    suffix = '',
    decimals = 0,
    className = ''
}: AnimatedCounterProps) => {
    const [count, setCount] = useState(0);
    const countRef = useRef(0);
    const requestRef = useRef<number | undefined>(undefined);
    const startTimeRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        const animate = (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const progress = timestamp - startTimeRef.current;
            const percentage = Math.min(progress / duration, 1);

            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - percentage, 3);
            const currentCount = easeOut * end;

            countRef.current = currentCount;
            setCount(currentCount);

            if (percentage < 1) {
                requestRef.current = requestAnimationFrame(animate);
            }
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [end, duration]);

    const formatNumber = (num: number) => {
        if (decimals > 0) {
            return num.toFixed(decimals);
        }
        return Math.floor(num).toLocaleString();
    };

    // Pre-render a hidden span with the final value to reserve exact width,
    // preventing CLS as the counter animates from 0 → target.
    const finalFormatted = formatNumber(end);

    return (
        <span className={`${className} relative inline-block`}>
            {/* Hidden final value reserves the exact pixel width from mount */}
            <span aria-hidden="true" className="invisible tabular-nums">{prefix}{finalFormatted}{suffix}</span>
            <span className="absolute inset-0 text-left tabular-nums">{prefix}{formatNumber(count)}{suffix}</span>
        </span>
    );
};

export default AnimatedCounter;
