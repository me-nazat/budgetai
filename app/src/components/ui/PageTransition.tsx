'use client';

import { type ReactNode, useSyncExternalStore } from 'react';
import { motion, type Variants } from 'framer-motion';

/**
 * Props for the PageTransition component.
 */
export interface PageTransitionProps {
  /** Page content to render. */
  children: ReactNode;
  /** Optional custom class name. */
  className?: string;
}

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

/**
 * Lightweight, zero-lag route transition.
 * Renders at opacity: 1 immediately on frame 1 without blank-screen flashes,
 * using at most a subtle 100ms GPU-composited translate3d(0, 2px, 0) entrance.
 */
const pageVariants: Variants = {
  initial: {
    opacity: 1,
    transform: 'translate3d(0, 2px, 0)',
  },
  enter: {
    opacity: 1,
    transform: 'translate3d(0, 0, 0)',
    transition: {
      duration: 0.1,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

const reducedMotionVariants: Variants = {
  initial: { opacity: 1, transform: 'translate3d(0, 0, 0)' },
  enter: { opacity: 1, transform: 'translate3d(0, 0, 0)', transition: { duration: 0 } },
};

/**
 * Instant PageTransition — guarantees immediate first paint with zero pointer lag.
 */
export function PageTransition({ children, className = 'w-full h-full pointer-events-auto' }: PageTransitionProps) {
  const shouldReduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  return (
    <motion.div
      variants={shouldReduceMotion ? reducedMotionVariants : pageVariants}
      initial="initial"
      animate="enter"
      className={className}
      style={{ willChange: 'transform' }}
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
