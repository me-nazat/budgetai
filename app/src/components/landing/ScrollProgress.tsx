/**
 * @fileoverview Scroll progress indicator component.
 *
 * Renders a thin animated bar at the top of the viewport that
 * fills as the user scrolls down the page. Uses Framer Motion's
 * `useScroll` for buttery smooth tracking.
 *
 * @module components/landing/ScrollProgress
 */

'use client';

import { motion, useScroll, useSpring } from 'framer-motion';

/**
 * Props for the ScrollProgress component.
 */
interface ScrollProgressProps {
  /** Bar color (CSS value). Default: gradient. */
  color?: string;
  /** Bar height in pixels. Default: 3. */
  height?: number;
}

/**
 * ScrollProgress — animated scroll position indicator.
 *
 * @example
 * ```tsx
 * <ScrollProgress />
 * ```
 */
export default function ScrollProgress({
  color,
  height = 3,
}: ScrollProgressProps) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height,
        background: color || 'linear-gradient(90deg, #6366f1, #06b6d4, #10b981)',
        transformOrigin: '0%',
        scaleX,
        zIndex: 9999,
      }}
    />
  );
}
