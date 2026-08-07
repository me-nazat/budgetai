'use client';

import { useEffect, useState, useRef } from 'react';
import { useInView } from 'framer-motion';

interface AnimatedCounterProps {
  end: number; duration?: number; delay?: number; prefix?: string; suffix?: string; decimals?: number; className?: string;
}

export function AnimatedCounter({ end, duration = 2, delay = 0, prefix = '', suffix = '', decimals = 0, className = '' }: AnimatedCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;
    const startTime = performance.now() + delay * 1000;
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      if (elapsed < 0) { requestAnimationFrame(animate); return; }
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration, delay]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}{count.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </span>
  );
}
