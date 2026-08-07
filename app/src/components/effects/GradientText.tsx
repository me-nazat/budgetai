'use client';

import { motion } from 'framer-motion';

interface GradientTextProps {
  children: React.ReactNode;
  className?: string;
  gradient?: string;
  duration?: number;
}

export function GradientText({
  children,
  className = '',
  gradient = 'from-emerald-400 via-cyan-400 to-indigo-400',
  duration = 3,
}: GradientTextProps) {
  return (
    <motion.span
      className={`bg-gradient-to-r ${gradient} bg-clip-text text-transparent bg-[length:200%_auto] ${className}`}
      animate={{ backgroundPosition: ['0% center', '200% center'] }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
      style={{ backgroundSize: '200% auto' }}
    >
      {children}
    </motion.span>
  );
}
