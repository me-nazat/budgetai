'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePrivacy } from '@/contexts/PrivacyContext';

export interface AnimatedCounterProps {
  /** Target number to animate to. */
  value: number;
  /** Direction of animation: 'up' (0 -> value) or 'down' (value -> 0). Default: 'up' */
  direction?: 'up' | 'down';
  /** Delay before animation starts in seconds. Default: 0 */
  delay?: number;
  /** Duration in seconds. Default: 0.8 */
  duration?: number;
  /** Optional custom CSS classes. */
  className?: string;
  /** Optional custom value formatter function. */
  formatter?: (value: number) => string;
  /** Prefix string (e.g. '$', '৳'). Default: '' */
  prefix?: string;
  /** Suffix string (e.g. '%', '+', '/mo'). Default: '' */
  suffix?: string;
  /** Number of decimal places. Default: 0 */
  decimals?: number;
  /** Whether to format integer part with commas. Default: true */
  formatCommas?: boolean;
  /** Whether to respect privacy mode masking. Default: true */
  maskPrivacy?: boolean;
}

/**
 * AnimatedCounter — high performance number counter using requestAnimationFrame.
 * Supports direction, formatting, decimals, prefixes, suffixes, and privacy mode masking.
 */
export function AnimatedCounter({
  value,
  direction = 'up',
  delay = 0,
  duration = 0.8,
  className = '',
  formatter,
  prefix = '',
  suffix = '',
  decimals = 0,
  formatCommas = true,
  maskPrivacy = true,
}: AnimatedCounterProps) {
  const { isPrivacyMode } = usePrivacy();
  const [displayValue, setDisplayValue] = useState<number>(() => (direction === 'down' ? value : 0));
  const [isInView, setIsInView] = useState(() => typeof IntersectionObserver === 'undefined');
  const containerRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);

  // IntersectionObserver to start animation only when visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '20px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const formatNumber = useCallback(
    (num: number): string => {
      if (formatter) {
        return formatter(num);
      }
      const fixed = num.toFixed(decimals);
      if (!formatCommas) {
        return `${prefix}${fixed}${suffix}`;
      }
      const [intPart, decPart] = fixed.split('.');
      const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const formattedNum = decPart ? `${withCommas}.${decPart}` : withCommas;
      return `${prefix}${formattedNum}${suffix}`;
    },
    [decimals, formatCommas, formatter, prefix, suffix]
  );

  useEffect(() => {
    if (!isInView) return;

    // Check for prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const startVal = direction === 'down' ? value : 0;
    const endVal = direction === 'down' ? 0 : value;

    if (prefersReducedMotion || duration <= 0) {
      const frame = requestAnimationFrame(() => setDisplayValue(endVal));
      return () => cancelAnimationFrame(frame);
    }

    let startTime: number | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const easeOutExpo = (t: number): number => {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    };

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      const current = startVal + (endVal - startVal) * easedProgress;
      setDisplayValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endVal);
      }
    };

    if (delay > 0) {
      timeoutId = setTimeout(() => {
        rafRef.current = requestAnimationFrame(animate);
      }, delay * 1000);
    } else {
      rafRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isInView, value, direction, delay, duration]);

  if (maskPrivacy && isPrivacyMode) {
    return (
      <span ref={containerRef} className={`tracking-widest tabular-nums font-mono ${className}`} data-numeric="true">
        ••••••
      </span>
    );
  }

  return (
    <span ref={containerRef} className={`tabular-nums ${className}`} data-numeric="true">
      {formatNumber(displayValue)}
    </span>
  );
}

export default AnimatedCounter;
