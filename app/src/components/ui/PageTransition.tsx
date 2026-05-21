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
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    filter: 'blur(4px)',
    transition: {
      duration: 0.2,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

/**
 * PageTransition — smooth route change animation wrapper.
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
