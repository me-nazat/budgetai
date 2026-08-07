'use client';

import { motion } from 'framer-motion';

interface WaveDividerProps {
  className?: string;
  fill?: string;
  flip?: boolean;
}

export function WaveDivider({ className = '', fill = 'var(--bg-base)', flip = false }: WaveDividerProps) {
  return (
    <div className={`relative w-full overflow-hidden leading-[0] ${flip ? 'rotate-180' : ''} ${className}`}>
      <motion.svg
        viewBox="0 0 1440 120"
        className="relative block w-full h-[60px] md:h-[80px]"
        preserveAspectRatio="none"
        initial={{ y: 10 }}
        animate={{ y: 0 }}
        transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
      >
        <path
          d="M0,60 C240,120 480,0 720,60 C960,120 1200,0 1440,60 L1440,120 L0,120 Z"
          fill={fill}
          opacity="0.5"
        />
        <motion.path
          d="M0,80 C360,20 720,100 1080,40 C1260,20 1380,60 1440,80 L1440,120 L0,120 Z"
          fill={fill}
          animate={{
            d: [
              'M0,80 C360,20 720,100 1080,40 C1260,20 1380,60 1440,80 L1440,120 L0,120 Z',
              'M0,60 C360,100 720,20 1080,80 C1260,100 1380,60 1440,40 L1440,120 L0,120 Z',
              'M0,80 C360,20 720,100 1080,40 C1260,20 1380,60 1440,80 L1440,120 L0,120 Z',
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.svg>
    </div>
  );
}
