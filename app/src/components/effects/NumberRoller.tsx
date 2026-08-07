'use client';

import { useEffect, useState, useRef } from 'react';
import { useInView } from 'framer-motion';
import { motion } from 'framer-motion';

interface NumberRollerProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
}

function DigitRoller({ target, duration = 1.5 }: { target: string; duration?: number }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    if (target === ',' || target === '.' || target === ' ' || target === '$') {
      setDisplay(target);
      return;
    }

    const targetNum = parseInt(target);
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * targetNum);
      setDisplay(current.toString());
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, target, duration]);

  return (
    <motion.span
      ref={ref}
      initial={{ y: 20, opacity: 0 }}
      animate={isInView ? { y: 0, opacity: 1 } : {}}
      transition={{ duration: 0.3 }}
      className="inline-block"
    >
      {display}
    </motion.span>
  );
}

export function NumberRoller({
  value,
  prefix = '',
  suffix = '',
  decimals = 0,
  duration = 1.5,
  className = '',
}: NumberRollerProps) {
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const chars = (prefix + formatted + suffix).split('');

  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {chars.map((char, i) => (
        <DigitRoller key={i} target={char} duration={duration + i * 0.05} />
      ))}
    </span>
  );
}
