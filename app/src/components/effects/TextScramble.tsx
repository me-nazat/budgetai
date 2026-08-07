'use client';

import { useEffect, useState, useRef } from 'react';
import { useInView } from 'framer-motion';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$€£¥';

interface TextScrambleProps {
  text: string;
  className?: string;
  duration?: number;
  trigger?: 'inView' | 'mount';
}

export function TextScramble({ text, className = '', duration = 1.5, trigger = 'inView' }: TextScrambleProps) {
  const [display, setDisplay] = useState(text);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (trigger === 'inView' && !isInView) return;
    if (hasAnimated) return;
    setHasAnimated(true);

    const length = text.length;
    const iterations = duration * 60; // 60fps
    let frame = 0;

    const animate = () => {
      const progress = frame / iterations;
      const resolvedCount = Math.floor(progress * length);

      let result = '';
      for (let i = 0; i < length; i++) {
        if (text[i] === ' ') {
          result += ' ';
        } else if (i < resolvedCount) {
          result += text[i];
        } else {
          result += CHARS[Math.floor(Math.random() * CHARS.length)];
        }
      }

      setDisplay(result);
      frame++;

      if (frame <= iterations) {
        requestAnimationFrame(animate);
      } else {
        setDisplay(text);
      }
    };

    requestAnimationFrame(animate);
  }, [isInView, text, duration, trigger, hasAnimated]);

  return (
    <span ref={ref} className={`font-mono ${className}`}>
      {display}
    </span>
  );
}
