'use client';

import { motion } from 'framer-motion';

interface OrbConfig {
  color: string;
  size: number;
  x: string;
  y: string;
  duration: number;
  delay: number;
}

const orbs: OrbConfig[] = [
  { color: 'rgba(16,185,129,0.08)', size: 600, x: '10%', y: '20%', duration: 20, delay: 0 },
  { color: 'rgba(99,102,241,0.06)', size: 500, x: '70%', y: '60%', duration: 25, delay: 2 },
  { color: 'rgba(245,158,11,0.05)', size: 400, x: '40%', y: '80%', duration: 22, delay: 4 },
  { color: 'rgba(16,185,129,0.04)', size: 700, x: '80%', y: '10%', duration: 28, delay: 1 },
];

export function MeshGradient() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1]" aria-hidden="true">
      {orbs.map((orb, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full blur-[100px]"
          style={{
            width: orb.size,
            height: orb.size,
            backgroundColor: orb.color,
            left: orb.x,
            top: orb.y,
          }}
          animate={{
            x: [0, 60, -40, 20, 0],
            y: [0, -50, 30, -20, 0],
            scale: [1, 1.1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: orb.duration,
            delay: orb.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}
