'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Sparkle {
  id: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface SparkleEffectProps {
  children: React.ReactNode;
  className?: string;
  sparkleCount?: number;
}

export function SparkleEffect({ children, className = '', sparkleCount = 6 }: SparkleEffectProps) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  const addSparkles = useCallback(() => {
    const newSparkles: Sparkle[] = Array.from({ length: sparkleCount }, (_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      scale: Math.random() * 0.5 + 0.5,
      rotation: Math.random() * 360,
    }));
    setSparkles(newSparkles);
    setTimeout(() => setSparkles([]), 700);
  }, [sparkleCount]);

  return (
    <div className={`relative inline-block ${className}`} onClick={addSparkles}>
      {children}
      <AnimatePresence>
        {sparkles.map((sparkle) => (
          <motion.svg
            key={sparkle.id}
            initial={{ scale: 0, opacity: 1, rotate: 0 }}
            animate={{ scale: sparkle.scale, opacity: 0, rotate: sparkle.rotation }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute pointer-events-none"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              width: 16,
              height: 16,
              marginLeft: -8,
              marginTop: -8,
            }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z"
              fill="rgba(255,255,255,0.6)"
            />
          </motion.svg>
        ))}
      </AnimatePresence>
    </div>
  );
}
