'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ShimmerBorderProps {
  children: React.ReactNode;
  className?: string;
  borderWidth?: number;
  duration?: number;
}

export function ShimmerBorder({
  children,
  className = '',
  borderWidth = 1,
  duration = 4,
}: ShimmerBorderProps) {
  return (
    <div className={cn('relative rounded-xl', className)}>
      {/* Animated border */}
      <motion.div
        className="absolute -inset-[1px] rounded-xl overflow-hidden"
        style={{ padding: borderWidth }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'conic-gradient(from 0deg, transparent, rgba(16,185,129,0.4), rgba(99,102,241,0.4), transparent)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-[1px] rounded-xl bg-background" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
