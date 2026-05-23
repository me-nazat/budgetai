'use client';

import { useEffect, useRef } from 'react';
import { useInView, useMotionValue, useSpring } from 'framer-motion';

export default function AnimatedCounter({
    value,
    direction = 'up',
    delay = 0,
    className = '',
}: {
    value: number;
    direction?: 'up' | 'down';
    delay?: number;
    className?: string;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(direction === 'down' ? value : 0);
    const springValue = useSpring(motionValue, {
        damping: 30,
        stiffness: 100,
        restDelta: 0.001
    });
    const isInView = useInView(ref, { once: true, margin: '-50px' });

    useEffect(() => {
        if (isInView) {
            setTimeout(() => {
                motionValue.set(direction === 'down' ? 0 : value);
            }, delay * 1000);
        }
    }, [motionValue, isInView, delay, value, direction]);

    useEffect(() => {
        return springValue.on('change', (latest) => {
            if (ref.current) {
                ref.current.textContent = Intl.NumberFormat('en-US', {
                    maximumFractionDigits: 0
                }).format(latest.toFixed(0));
            }
        });
    }, [springValue]);

    return <span ref={ref} className={className}>{value}</span>;
}
