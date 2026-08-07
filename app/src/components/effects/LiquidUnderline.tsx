'use client';

import React, { useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

interface LiquidUnderlineProps {
  children: React.ReactNode;
  className?: string;
}

export function LiquidUnderline({ children, className = '' }: LiquidUnderlineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const left = useMotionValue(0);
  const width = useMotionValue(0);

  const springLeft = useSpring(left, { stiffness: 400, damping: 30 });
  const springWidth = useSpring(width, { stiffness: 400, damping: 30 });

  const handleMouseEnter = useCallback((index: number, el: HTMLElement) => {
    setHoveredIndex(index);
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    left.set(elRect.left - containerRect.left);
    width.set(elRect.width);
  }, [left, width]);

  const handleMouseLeave = useCallback(() => {
    setHoveredIndex(null);
    width.set(0);
  }, [width]);

  const childrenArray = React.Children.toArray(children);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center gap-1 ${className}`}
      onMouseLeave={handleMouseLeave}
    >
      {childrenArray.map((child, index) => (
        <div
          key={index}
          onMouseEnter={(e) => handleMouseEnter(index, e.currentTarget)}
          className="relative z-10"
        >
          {child}
        </div>
      ))}

      {/* Liquid underline */}
      <motion.div
        className="absolute bottom-0 h-0.5 rounded-full bg-accent-emerald"
        style={{
          left: springLeft,
          width: springWidth,
          opacity: hoveredIndex !== null ? 1 : 0,
        }}
        transition={{ opacity: { duration: 0.2 } }}
      />
    </div>
  );
}
