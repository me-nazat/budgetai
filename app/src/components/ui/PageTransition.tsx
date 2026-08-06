/**
 * @fileoverview Page transition wrapper using Framer Motion AnimatePresence.
 *
 * Wraps page content to animate route transitions with smooth fade
 * and slide effects. Uses the pathname as the animation key.
 *
 * @module components/ui/PageTransition
 */

'use client';

import { type ReactNode } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { EASE_LIQUID } from '@/lib/motion';

/**
 * Props for the PageTransition component.
 */
interface PageTransitionProps {
  /** Page content to animate. */
  children: ReactNode;
}

/**
 * Animation variants for page transitions.
 */
const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
    filter: 'blur(4px)',
  },
  enter: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.3,
      ease: EASE_LIQUID,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(4px)',
    transition: {
      duration: 0.2,
      ease: EASE_LIQUID,
    },
  },
};

/**
 * PageTransition — smooth route change animation wrapper.
 *
 * Wraps its own AnimatePresence so every route in the app gets a real
 * enter *and* exit crossfade from a single shared-layout edit, instead of
 * requiring every page to opt in individually. `mode="wait"` keeps the
 * swap sequential (no stacked layout during the ~200ms exit) rather than
 * overlapping two full-height pages, which is the safer default for a
 * dense data app; the top route-progress bar already covers perceived
 * loading during that gap.
 *
 * @example
 * ```tsx
 * // In layout.tsx
 * <PageTransition>
 *   {children}
 * </PageTransition>
 * ```
 */
export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        style={{ minHeight: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
