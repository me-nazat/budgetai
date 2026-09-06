'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

interface FloatingParticlesProps {
  count?: number;
  color?: string;
  className?: string;
}

function pseudoRandom(index: number, salt: number) {
  const value = Math.sin((index + 1) * (salt + 1) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function FloatingParticles({
  count = 30,
  color = 'rgba(255,255,255,0.3)',
  className = '',
}: FloatingParticlesProps) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: pseudoRandom(i, 1) * 100,
      size: pseudoRandom(i, 2) * 3 + 1,
      duration: pseudoRandom(i, 3) * 20 + 15,
      delay: pseudoRandom(i, 4) * 20,
      opacity: pseudoRandom(i, 5) * 0.3 + 0.1,
    }));
  }, [count]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`} aria-hidden="true">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            opacity: p.opacity,
          }}
          initial={{ y: '110vh' }}
          animate={{ y: '-10vh' }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}
