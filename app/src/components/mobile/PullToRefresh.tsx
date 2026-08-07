'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pullY = useMotionValue(0);
  const springY = useSpring(pullY, { stiffness: 300, damping: 30 });

  const rotate = useTransform(springY, [0, 100], [0, 360]);
  const opacity = useTransform(springY, [0, 50, 100], [0, 1, 1]);

  const handleTouchStart = useCallback(() => {
    if (containerRef.current?.scrollTop === 0) {
      pullY.set(0);
    }
  }, [pullY]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (containerRef.current?.scrollTop === 0 && !isRefreshing) {
        const touchY = e.touches[0].clientY;
        const startY = (e as any)._startY || touchY;
        (e as any)._startY = startY;
        const diff = touchY - startY;
        if (diff > 0) {
          pullY.set(Math.min(diff * 0.5, 120));
        }
      }
    },
    [pullY, isRefreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    const currentY = pullY.get();
    if (currentY > 80 && !isRefreshing) {
      setIsRefreshing(true);
      pullY.set(80);
      await onRefresh();
      setIsRefreshing(false);
    }
    pullY.set(0);
  }, [pullY, isRefreshing, onRefresh]);

  return (
    <div className={`relative ${className}`}>
      {/* Refresh indicator */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none"
        style={{ y: springY, opacity }}
      >
        <motion.div
          style={{ rotate: isRefreshing ? 360 : rotate }}
          animate={isRefreshing ? { rotate: 360 } : {}}
          transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        >
          <RefreshCw size={20} className="text-accent-emerald" />
        </motion.div>
      </motion.div>

      {/* Content */}
      <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="overflow-y-auto h-full"
      >
        {children}
      </div>
    </div>
  );
}
