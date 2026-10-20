/**
 * @fileoverview Performance-tuned surface card component.
 *
 * Replaces heavy 3D perspective transforms and mouse-tracking calculations
 * with a clean 1px border highlight and hover elevation shift via pure CSS transitions.
 *
 * @module components/landing/FeatureCard3D
 */

'use client';

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * Props for the FeatureCard3D component.
 */
export interface FeatureCard3DProps {
  /** Card content (icon, title, description). */
  children: ReactNode;
  /** Additional CSS class names. */
  className?: string;
  /** Maximum tilt angle in degrees (preserved for API compatibility). */
  maxTilt?: number;
  /** Whether to add a glare effect (preserved for API compatibility). */
  glare?: boolean;
  /** Delay before the whileInView animation starts (seconds). */
  delay?: number;
}

/**
 * FeatureCard3D — institutional surface card with subtle hover elevation.
 *
 * 3D perspective tilting has been replaced with a crisp 1px border highlight
 * and translateY(-1px) hover elevation to ensure 60fps locked rendering.
 */
export default function FeatureCard3D({
  children,
  className = '',
  maxTilt: _maxTilt = 15,
  glare: _glare = true,
  delay = 0,
}: FeatureCard3DProps) {
  return (
    <motion.div
      className={`feature-card-3d relative rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors transition-transform duration-150 ease-out hover:-translate-y-[1px] hover:border-[var(--border-strong)] ${className}`}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration: 0.3,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div className="relative z-10 w-full h-full p-6">
        {children}
      </div>
    </motion.div>
  );
}
