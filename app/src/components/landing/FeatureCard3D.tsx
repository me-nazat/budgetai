/**
 * @fileoverview 3D tilt card component with perspective transforms.
 *
 * Creates a premium card effect that responds to mouse movement with
 * 3D rotation and dynamic lighting. Uses Framer Motion's `useMotionValue`
 * and `useTransform` for GPU-accelerated transforms.
 *
 * @module components/landing/FeatureCard3D
 */

'use client';

import { useRef, type ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';

/**
 * Props for the FeatureCard3D component.
 */
interface FeatureCard3DProps {
  /** Card content (icon, title, description). */
  children: ReactNode;
  /** Additional CSS class names. */
  className?: string;
  /** Maximum tilt angle in degrees. Default: 15. */
  maxTilt?: number;
  /** Whether to add a glare effect. Default: true. */
  glare?: boolean;
  /** Delay before the whileInView animation starts (seconds). */
  delay?: number;
}

/**
 * FeatureCard3D — interactive card with mouse-tracking 3D perspective.
 *
 * The card tilts toward the user's cursor position, creating a premium
 * 3D effect. A glare overlay follows the cursor for added realism.
 *
 * @example
 * ```tsx
 * <FeatureCard3D delay={0.2}>
 *   <h3>AI Analysis</h3>
 *   <p>Smart financial insights powered by AI.</p>
 * </FeatureCard3D>
 * ```
 */
export default function FeatureCard3D({
  children,
  className = '',
  maxTilt = 15,
  glare = true,
  delay = 0,
}: FeatureCard3DProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Raw motion values for cursor position
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Spring-smoothed rotation
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [maxTilt, -maxTilt]), {
    stiffness: 300,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-maxTilt, maxTilt]), {
    stiffness: 300,
    damping: 30,
  });

  // Glare position
  const glareX = useTransform(mouseX, [-0.5, 0.5], ['0%', '100%']);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ['0%', '100%']);
  const glareOpacity = useSpring(0, { stiffness: 300, damping: 30 });

  /**
   * Handles mouse move over the card.
   * Calculates normalized cursor position (-0.5 to 0.5).
   */
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Normalize to -0.5 to 0.5
    mouseX.set((e.clientX - centerX) / rect.width);
    mouseY.set((e.clientY - centerY) / rect.height);
    glareOpacity.set(0.15);
  };

  /**
   * Resets the card to its neutral position on mouse leave.
   */
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
    glareOpacity.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      className={`feature-card-3d ${className}`}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
        perspective: 1000,
      }}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, transform: 'translateZ(20px)' }}>
        {children}
      </div>

      {/* Glare overlay */}
      {glare && (
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            background: useTransform(
              [glareX, glareY],
              ([x, y]) =>
                `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.15), transparent 60%)`
            ),
            opacity: glareOpacity,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      )}
    </motion.div>
  );
}
