'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Ripple {
  x: number;
  y: number;
  id: number;
}

interface RippleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  rippleColor?: string;
}

export const RippleButton = React.forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({ children, className, rippleColor = 'rgba(255,255,255,0.2)', onClick, ...props }, ref) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const id = Date.now();

        setRipples((prev) => [...prev, { x, y, id }]);
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 600);

        onClick?.(e);
      },
      [onClick]
    );

    return (
      <button
        ref={ref}
        onClick={handleClick}
        className={cn('relative overflow-hidden', className)}
        {...props}
      >
        <AnimatePresence>
          {ripples.map((ripple) => (
            <motion.span
              key={ripple.id}
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: 4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: ripple.x,
                top: ripple.y,
                width: 20,
                height: 20,
                marginLeft: -10,
                marginTop: -10,
                backgroundColor: rippleColor,
              }}
            />
          ))}
        </AnimatePresence>
        <span className="relative z-10">{children}</span>
      </button>
    );
  }
);
RippleButton.displayName = 'RippleButton';
