'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> { children: React.ReactNode; className?: string; tiltAmount?: number; tiltIntensity?: number; glare?: boolean; style?: React.CSSProperties; }

export function TiltCard({ children, className, tiltAmount, tiltIntensity, glare = true, style, ...rest }: TiltCardProps) {
  const actualTilt = tiltAmount ?? tiltIntensity ?? 8;
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const springConfig = { stiffness: 150, damping: 20 };
  const rotateX = useSpring(useTransform(y, [0, 1], [actualTilt, -actualTilt]), springConfig);
  const rotateY = useSpring(useTransform(x, [0, 1], [-actualTilt, actualTilt]), springConfig);
  const glareX = useTransform(x, [0, 1], ['0%', '100%']);
  const glareY = useTransform(y, [0, 1], ['0%', '100%']);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width);
    y.set((e.clientY - rect.top) / rect.height);
  };

  return (
    <motion.div ref={ref} style={{ ...style, rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 1000 }}
      onMouseMove={handleMouseMove} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => { setIsHovered(false); x.set(0.5); y.set(0.5); }}
      className={cn('relative', className)} {...rest as any}>
      {children}
      {glare && isHovered && (
        <motion.div style={{ x: glareX, y: glareY }} className="absolute inset-0 pointer-events-none rounded-inherit opacity-20">
          <div className="absolute -inset-[100%] bg-gradient-radial from-white/20 to-transparent" />
        </motion.div>
      )}
    </motion.div>
  );
}
