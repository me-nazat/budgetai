/**
 * @fileoverview Animated counter component using Framer Motion spring physics.
 *
 * Smoothly animates a number from 0 to its target value with spring-based
 * easing. Used for hero stats on the landing page and dashboard KPIs.
 *
 * @module components/landing/AnimatedCounter
 */

'use client';

import { useEffect, useRef } from 'react';
import {
  useMotionValue,
  useSpring,
  useInView,
  useTransform,
  motion,
} from 'framer-motion';

/**
 * Props for the AnimatedCounter component.
 */
interface AnimatedCounterProps {
  /** Target number to animate to. */
  value: number;
  /** Prefix string (e.g., '$', '€'). */
  prefix?: string;
  /** Suffix string (e.g., '%', '+', 'K'). */
  suffix?: string;
  /** Number of decimal places to display. */
  decimals?: number;
  /** Animation duration factor (higher = slower). Default: 0.8. */
  duration?: number;
  /** CSS class name for the container. */
  className?: string;
  /** Whether to format with commas (e.g., 1,000,000). */
  formatCommas?: boolean;
}

/**
 * AnimatedCounter — smoothly animates a number value with spring physics.
 *
 * Uses Framer Motion's `useSpring` for natural, physics-based animation
 * that triggers when the element scrolls into view.
 *
 * @example
 * ```tsx
 * <AnimatedCounter value={1000000} prefix="$" suffix="+" formatCommas />
 * // Renders: $1,000,000+
 * ```
 */
export default function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 0.8,
  className = '',
  formatCommas = true,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    stiffness: 100,
    damping: 30,
    mass: duration,
  });
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  /**
   * Formats a number with commas and decimal places.
   */
  const formatNumber = (num: number): string => {
    const fixed = num.toFixed(decimals);
    if (!formatCommas) return fixed;

    const [intPart, decPart] = fixed.split('.');
    const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decPart ? `${withCommas}.${decPart}` : withCommas;
  };

  const displayValue = useTransform(springValue, (latest) => {
    return `${prefix}${formatNumber(latest)}${suffix}`;
  });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  return (
    <motion.span ref={ref} className={className}>
      {displayValue}
    </motion.span>
  );
}
