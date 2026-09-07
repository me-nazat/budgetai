/**
 * @fileoverview Centralized motion variants and reduced-motion utilities.
 *
 * Single source of truth for all Framer Motion animation presets.
 * Components should import from here instead of defining inline variants.
 *
 * Respects `prefers-reduced-motion` via the `useMotionSafe` hook,
 * which returns either full animation variants or opacity-only fallbacks.
 *
 * @module lib/motion
 */

import { useReducedMotion, type Variants, type Transition } from 'framer-motion';
import { useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════════
   TRANSITION PRESETS
   ═══════════════════════════════════════════════════════════════ */

/** Default spring transition used across most components */
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 24,
};

/** Smooth spring for bottom sheets and large surfaces */
export const sheetSpring: Transition = {
  type: 'spring',
  damping: 25,
  stiffness: 250,
};

/** Quick snap for micro-interactions (toggles, pills, badges) */
export const snapTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

/** Gentle ease for opacity-dominant transitions */
export const gentleEase: Transition = {
  duration: 0.2,
  ease: [0.32, 0.72, 0, 1],
};

/* ═══════════════════════════════════════════════════════════════
   ANIMATION VARIANTS
   ═══════════════════════════════════════════════════════════════ */

/** Fade in from transparent to opaque */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** Slide up from 20px below — the most common entry pattern */
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
};

/** Slide down from 20px above */
export const slideDown: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
};

/** Scale up from 90% — used for modals and overlays */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { ...springTransition, delay: 0.1 },
  },
};

/** Bottom sheet entry — slides from below the viewport */
export const bottomSheetVariants: Variants = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: sheetSpring,
  },
  exit: { y: '100%', opacity: 0 },
};

/** Stagger container — orchestrates children with sequential delays */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

/** Stagger item — child variant for stagger containers */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
};

/** Fast stagger container — tighter timing for dense lists */
export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

/** Backdrop overlay fade */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/* ═══════════════════════════════════════════════════════════════
   REDUCED MOTION FALLBACKS
   ═══════════════════════════════════════════════════════════════ */

/** Opacity-only variant for users who prefer reduced motion */
const reducedMotionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Returns motion-safe variants based on `prefers-reduced-motion`.
 *
 * When the user has reduced motion enabled, returns opacity-only variants
 * regardless of what's passed in. Otherwise, returns the original variants.
 *
 * @param variants - The full animation variants
 * @returns The variants to use (full or reduced)
 *
 * @example
 * ```tsx
 * const variants = useMotionSafe(slideUp);
 * return <motion.div variants={variants} initial="hidden" animate="visible" />;
 * ```
 */
export function useMotionSafe(variants: Variants): Variants {
  const shouldReduce = useReducedMotion();

  return useMemo(
    () => (shouldReduce ? reducedMotionVariants : variants),
    [shouldReduce, variants]
  );
}

/**
 * Returns a boolean indicating whether motion should be reduced.
 *
 * Wraps Framer Motion's `useReducedMotion` with a fallback for SSR.
 *
 * @returns `true` if the user prefers reduced motion
 */
export function useIsReducedMotion(): boolean {
  return useReducedMotion() ?? false;
}

/**
 * Generates motion props for a component, respecting reduced motion preferences.
 *
 * When reduced motion is active, collapses all transforms to opacity-only
 * with a 100ms transition (per the spec in Section 2.4).
 *
 * @param reduce - Whether to use reduced motion
 * @param variants - The full animation variants
 * @returns Props to spread onto a `motion.*` component
 *
 * @example
 * ```tsx
 * const reduce = useIsReducedMotion();
 * return <motion.div {...motionProps(reduce, slideUp)} />;
 * ```
 */
export function motionProps(
  reduce: boolean,
  variants: Variants
): { variants: Variants; initial: string; animate: string } {
  return {
    variants: reduce ? reducedMotionVariants : variants,
    initial: 'hidden',
    animate: 'visible',
  };
}
