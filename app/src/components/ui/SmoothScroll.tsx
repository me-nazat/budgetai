'use client';

import { ReactNode } from 'react';

export interface SmoothScrollProps {
  children: ReactNode;
}

/**
 * SmoothScroll — Pass-through wrapper.
 * Pure native hardware-accelerated OS scrolling preserves trackpad momentum,
 * eliminates input lag, and supports native browser search (Cmd+F).
 */
export function SmoothScroll({ children }: SmoothScrollProps) {
  return <>{children}</>;
}

export default SmoothScroll;
