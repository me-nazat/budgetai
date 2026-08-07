'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, HTMLMotionProps } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 rounded-xl font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent-emerald text-white hover:bg-emerald-600 shadow-glow-emerald',
        secondary: 'bg-white/[0.06] text-text-primary border border-border-default hover:bg-white/[0.09] hover:border-border-strong',
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-white/[0.03]',
        danger: 'bg-accent-rose/10 text-accent-rose border border-accent-rose/20 hover:bg-accent-rose/20',
        glass: 'glass text-text-primary hover:bg-white/[0.06]',
      },
      size: { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4', lg: 'h-12 px-6 text-base', icon: 'h-10 w-10' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

interface FluidButtonProps extends HTMLMotionProps<"button">, VariantProps<typeof buttonVariants> { magnetic?: boolean; }

export const FluidButton = React.forwardRef<HTMLButtonElement, FluidButtonProps>(
  ({ className, variant, size, magnetic = true, children, ...props }, ref) => {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [isPressed, setIsPressed] = useState(false);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springConfig = { stiffness: 300, damping: 20 };
    const springX = useSpring(x, springConfig);
    const springY = useSpring(y, springConfig);

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!magnetic || !buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      x.set((e.clientX - rect.left - rect.width / 2) * 0.15);
      y.set((e.clientY - rect.top - rect.height / 2) * 0.15);
    };
    const handleMouseLeave = () => { x.set(0); y.set(0); };

    return (
      <motion.button ref={buttonRef} style={magnetic ? { x: springX, y: springY } : undefined}
        onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}
        onMouseDown={() => setIsPressed(true)} onMouseUp={() => setIsPressed(false)}
        animate={isPressed ? { scale: 0.96 } : { scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={cn(buttonVariants({ variant, size }), className)} {...props}>
        {children}
      </motion.button>
    );
  }
);
FluidButton.displayName = 'FluidButton';
