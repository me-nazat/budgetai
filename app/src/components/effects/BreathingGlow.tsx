'use client';

import { motion } from 'framer-motion';

interface BreathingGlowProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  intensity?: number;
}

export function BreathingGlow({
  children,
  className = '',
  color = 'rgba(16,185,129,0.3)',
  intensity = 1,
}: BreathingGlowProps) {
  return (
    <motion.div
      className={`relative ${className}`}
      animate={{
        boxShadow: [
          `0 0 ${10 * intensity}px ${color}`,
          `0 0 ${25 * intensity}px ${color}`,
          `0 0 ${10 * intensity}px ${color}`,
        ],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}
