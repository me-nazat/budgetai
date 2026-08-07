'use client';

import { motion } from 'framer-motion';

export function AuroraBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[-1]" aria-hidden="true">
      <svg
        className="absolute w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="aurora1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(16,185,129,0.15)" />
            <stop offset="50%" stopColor="rgba(99,102,241,0.08)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="aurora2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(6,182,212,0.1)" />
            <stop offset="50%" stopColor="rgba(16,185,129,0.05)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="blur">
            <feGaussianBlur stdDeviation="60" />
          </filter>
        </defs>

        <motion.path
          d="M-100,400 Q200,100 500,300 T900,200 T1300,350 T1600,150 V900 H-100 Z"
          fill="url(#aurora1)"
          filter="url(#blur)"
          animate={{
            d: [
              'M-100,400 Q200,100 500,300 T900,200 T1300,350 T1600,150 V900 H-100 Z',
              'M-100,300 Q300,200 600,400 T1000,250 T1400,400 T1600,300 V900 H-100 Z',
              'M-100,400 Q200,100 500,300 T900,200 T1300,350 T1600,150 V900 H-100 Z',
            ],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.path
          d="M-100,600 Q400,400 700,500 T1100,450 T1500,550 V900 H-100 Z"
          fill="url(#aurora2)"
          filter="url(#blur)"
          animate={{
            d: [
              'M-100,600 Q400,400 700,500 T1100,450 T1500,550 V900 H-100 Z',
              'M-100,500 Q300,600 600,450 T1000,550 T1400,400 V900 H-100 Z',
              'M-100,600 Q400,400 700,500 T1100,450 T1500,550 V900 H-100 Z',
            ],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        />
      </svg>
    </div>
  );
}
