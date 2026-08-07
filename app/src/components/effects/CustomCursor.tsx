'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

interface CursorState {
  type: 'default' | 'pointer' | 'text' | 'drag' | 'hidden';
  label?: string;
}

export function CustomCursor() {
  const [cursorState, setCursorState] = useState<CursorState>({ type: 'default' });
  const [isVisible, setIsVisible] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  const springConfig = { damping: 25, stiffness: 400, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  // Outer ring (slower follow)
  const ringX = useSpring(cursorX, { damping: 30, stiffness: 150, mass: 1 });
  const ringY = useSpring(cursorY, { damping: 30, stiffness: 150, mass: 1 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('a, button, [role="button"], input, textarea, select, [data-cursor="pointer"]')) {
        setCursorState({ type: 'pointer' });
      } else if (target.closest('input[type="text"], textarea, [contenteditable]')) {
        setCursorState({ type: 'text' });
      } else if (target.closest('[data-cursor="drag"]')) {
        setCursorState({ type: 'drag' });
      } else if (target.closest('[data-cursor="hidden"]')) {
        setCursorState({ type: 'hidden' });
      } else {
        setCursorState({ type: 'default' });
      }
    };

    const handleMouseLeave = () => setIsVisible(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    document.body.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [cursorX, cursorY, isVisible]);

  // Hide on touch devices
  if (typeof window !== 'undefined' && 'ontouchstart' in window) return null;

  const sizeMap = {
    default: 8,
    pointer: 40,
    text: 2,
    drag: 50,
    hidden: 0,
  };

  const ringSizeMap = {
    default: 32,
    pointer: 48,
    text: 20,
    drag: 60,
    hidden: 0,
  };

  return (
    <>
      {/* Hide default cursor */}
      <style jsx global>{`
        @media (hover: hover) and (pointer: fine) {
          * { cursor: none !important; }
        }
      `}</style>

      {/* Inner dot */}
      <motion.div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          translateX: '-50%',
          translateY: '-50%',
        }}
      >
        <motion.div
          animate={{
            width: sizeMap[cursorState.type],
            height: sizeMap[cursorState.type],
            opacity: cursorState.type === 'hidden' ? 0 : 1,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="rounded-full bg-white"
        />
      </motion.div>

      {/* Outer ring */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9998]"
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
        }}
      >
        <motion.div
          animate={{
            width: ringSizeMap[cursorState.type],
            height: ringSizeMap[cursorState.type],
            opacity: cursorState.type === 'hidden' ? 0 : cursorState.type === 'pointer' ? 0.3 : 0.15,
            borderWidth: cursorState.type === 'text' ? 1 : 1.5,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="rounded-full border border-white mix-blend-difference"
        />
      </motion.div>
    </>
  );
}
