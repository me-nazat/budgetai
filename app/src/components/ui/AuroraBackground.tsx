'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AuroraBackgroundProps {
  children: ReactNode;
  showRadialGradient?: boolean;
  className?: string;
}

/**
 * AuroraBackground — Institutional architectural surface wrapper.
 * Neutralized heavy multi-layer GPU canvas blurs and keyframe animations in favor of
 * a clean, static, hardware-accelerated ambient surface.
 */
export const AuroraBackground = ({
  className,
  children,
  showRadialGradient = true,
  ...props
}: AuroraBackgroundProps) => {
  return (
    <div
      className={cn(
        'relative flex flex-col h-full w-full items-center justify-center bg-bg-light dark:bg-bg-dark text-slate-950 dark:text-slate-50',
        className
      )}
      {...props}
    >
      {showRadialGradient && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 h-[500px] w-[1000px] max-w-full rounded-full bg-gradient-to-b from-indigo-500/[0.04] dark:from-indigo-500/[0.06] via-transparent to-transparent" />
        </div>
      )}
      <div className="relative z-10 w-full h-full">{children}</div>
    </div>
  );
};

export default AuroraBackground;
