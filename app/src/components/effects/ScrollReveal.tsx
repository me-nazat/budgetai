'use client';

import { useRef } from 'react';
import { motion, useInView, Variants } from 'framer-motion';

type RevealType = 'fadeUp' | 'fadeDown' | 'fadeLeft' | 'fadeRight' | 'scale' | 'blur' | 'slideUp';

interface ScrollRevealProps {
  children: React.ReactNode;
  type?: RevealType;
  delay?: number;
  duration?: number;
  once?: boolean;
  margin?: string;
  className?: string;
  staggerChildren?: number;
}

const variants: Record<RevealType, Variants> = {
  fadeUp: {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0 },
  },
  fadeDown: {
    hidden: { opacity: 0, y: -40 },
    visible: { opacity: 1, y: 0 },
  },
  fadeLeft: {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0 },
  },
  fadeRight: {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1 },
  },
  blur: {
    hidden: { opacity: 0, filter: 'blur(10px)' },
    visible: { opacity: 1, filter: 'blur(0px)' },
  },
  slideUp: {
    hidden: { opacity: 0, y: 60, skewY: 2 },
    visible: { opacity: 1, y: 0, skewY: 0 },
  },
};

export function ScrollReveal({
  children,
  type = 'fadeUp',
  delay = 0,
  duration = 0.6,
  once = true,
  margin = '-80px',
  className = '',
  staggerChildren = 0,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: margin as any });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={{
        hidden: variants[type].hidden,
        visible: {
          ...variants[type].visible,
          transition: {
            duration,
            delay,
            ease: [0.16, 1, 0.3, 1],
            staggerChildren: staggerChildren || undefined,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Child item for staggered reveals
export function ScrollRevealItem({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
