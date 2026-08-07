'use client';

import { motion } from 'framer-motion';

interface DotGridProps {
  spacing?: number;
  dotSize?: number;
  className?: string;
}

export function DotGrid({ spacing = 40, dotSize = 1, className = '' }: DotGridProps) {
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dotPattern" width={spacing} height={spacing} patternUnits="userSpaceOnUse">
            <circle cx={spacing / 2} cy={spacing / 2} r={dotSize} fill="rgba(255,255,255,0.04)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotPattern)" />
      </svg>
    </div>
  );
}
