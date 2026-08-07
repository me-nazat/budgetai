'use client';

import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<"div"> {
  hover?: boolean;
  glow?: 'none' | 'emerald' | 'indigo' | 'amber' | 'rose';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = true, glow = 'none', padding = 'md', children, ...props }, ref) => {
    const paddingMap = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' };
    const glowMap = {
      none: '', emerald: 'hover:shadow-glow-emerald', indigo: 'hover:shadow-glow-indigo', amber: 'hover:shadow-glow-amber', rose: 'hover:shadow-glow-rose'
    };

    return (
      <motion.div
        ref={ref}
        whileHover={hover ? { scale: 1.01, y: -2 } : undefined}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'glass rounded-xl border border-border-subtle transition-all duration-300',
          paddingMap[padding],
          hover && 'hover:border-border-default hover:bg-white/[0.04]',
          glowMap[glow],
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
GlassCard.displayName = 'GlassCard';
