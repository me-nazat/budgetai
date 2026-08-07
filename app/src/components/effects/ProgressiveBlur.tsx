'use client';

interface ProgressiveBlurProps {
  direction?: 'top' | 'bottom' | 'left' | 'right';
  height?: number;
  className?: string;
}

export function ProgressiveBlur({
  direction = 'bottom',
  height = 80,
  className = '',
}: ProgressiveBlurProps) {
  const gradientMap = {
    top: `linear-gradient(to bottom, var(--bg-base), transparent)`,
    bottom: `linear-gradient(to top, var(--bg-base), transparent)`,
    left: `linear-gradient(to right, var(--bg-base), transparent)`,
    right: `linear-gradient(to left, var(--bg-base), transparent)`,
  };

  const positionMap = {
    top: { top: 0, left: 0, right: 0, height },
    bottom: { bottom: 0, left: 0, right: 0, height },
    left: { top: 0, bottom: 0, left: 0, width: height },
    right: { top: 0, bottom: 0, right: 0, width: height },
  };

  return (
    <div
      className={`absolute pointer-events-none z-10 ${className}`}
      style={{
        ...positionMap[direction],
        background: gradientMap[direction],
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        maskImage: gradientMap[direction],
        WebkitMaskImage: gradientMap[direction],
      }}
    />
  );
}
