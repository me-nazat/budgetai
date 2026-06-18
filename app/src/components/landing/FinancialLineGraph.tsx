'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

const GRAPH_PATH =
  'M 10,168 C 55,162 95,148 125,132 S 185,98 250,78 S 330,48 375,38 S 430,26 475,18';

const DRAW_MS = 1000;
const HOLD_MS = 2000;
const COOLDOWN_MS = 500;

/**
 * Scroll-triggered financial line graph with a precise 3.5s animation loop:
 * 1s draw-in → 2s hold → instant reset → 0.5s cooldown.
 */
export default function FinancialLineGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const glowRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'draw' | 'hold' | 'cooldown'>('idle');
  const [dashOffset, setDashOffset] = useState(0);
  const [visible, setVisible] = useState(false);
  const [inView, setInView] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      setPathLength(len);
      setDashOffset(len);
    }
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.25, rootMargin: '0px 0px -10% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    if (!inView || pathLength === 0) {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setPhase('idle');
        setVisible(false);
        setDashOffset(pathLength);
      }, 0);
      return () => {
        cancelled = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
      };
    }

    if (prefersReducedMotion) {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setPhase('hold');
        setVisible(true);
        setDashOffset(0);
      }, 0);
      return () => {
        cancelled = true;
        if (timeoutId !== null) clearTimeout(timeoutId);
      };
    }

    const runLoop = () => {
      if (cancelled) return;

      // Phase 3 & 4 Reset / Cooldown: instant disappear without transition
      setPhase('idle');
      setDashOffset(pathLength);
      setVisible(false);

      // Force layout calculation / render tick before starting drawing transition
      timeoutId = setTimeout(() => {
        if (cancelled) return;

        // Phase 1: Draw-In (1.0s)
        setPhase('draw');
        setDashOffset(0);
        setVisible(true);

        timeoutId = setTimeout(() => {
          if (cancelled) return;

          // Phase 2: Hold (2.0s)
          setPhase('hold');

          timeoutId = setTimeout(() => {
            if (cancelled) return;

            // Phase 3 & 4 Reset: instantly set offsets
            setVisible(false);
            setPhase('cooldown');
            setDashOffset(pathLength);

            timeoutId = setTimeout(() => {
              if (!cancelled) runLoop();
            }, COOLDOWN_MS);
          }, HOLD_MS);
        }, DRAW_MS);
      }, 50);
    };

    runLoop();

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [inView, pathLength, prefersReducedMotion]);

  return (
    <div ref={containerRef} className="financial-graph-canvas relative h-full w-full min-h-[220px]">
      <div className="absolute inset-0 flex flex-col justify-between pt-4 pb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="financial-graph-grid h-px w-full" />
        ))}
      </div>

      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 500 200"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="financial-graph-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--graph-gradient-start)" />
            <stop offset="100%" stopColor="var(--graph-gradient-end)" />
          </linearGradient>
          <linearGradient id="financial-graph-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--graph-gradient-start)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--graph-gradient-end)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path
          d={`${GRAPH_PATH} L 475,200 L 10,200 Z`}
          fill="url(#financial-graph-fill)"
          style={{
            opacity: visible ? 1 : 0,
            transition: 'opacity 75ms linear',
          }}
        />

        <path
          ref={glowRef}
          d={GRAPH_PATH}
          fill="none"
          stroke="url(#financial-graph-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="financial-graph-glow"
          style={{
            opacity: visible ? 0.35 : 0,
            strokeDasharray: pathLength || undefined,
            strokeDashoffset: dashOffset,
            transition: phase === 'draw'
              ? 'stroke-dashoffset 1000ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 75ms linear'
              : 'opacity 75ms linear',
          }}
        />

        <path
          ref={pathRef}
          d={GRAPH_PATH}
          fill="none"
          stroke="url(#financial-graph-gradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="financial-graph-stroke"
          style={{
            opacity: visible ? 1 : 0,
            strokeDasharray: pathLength || undefined,
            strokeDashoffset: dashOffset,
            transition: phase === 'draw'
              ? 'stroke-dashoffset 1000ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 75ms linear'
              : 'opacity 75ms linear',
          }}
        />

        {visible && phase === 'hold' && (
          <circle
            cx="475"
            cy="18"
            r="5"
            fill="var(--graph-gradient-end)"
            className="financial-graph-endpoint animate-fade-in"
          />
        )}
      </svg>

      <div className="absolute right-[4%] top-[6%] z-10 hidden rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-xl dark:border-white/10 dark:bg-slate-900 sm:block pointer-events-none">
        <div className="mb-0.5 text-[9px] font-bold uppercase text-gray-400 dark:text-slate-500">Current Status</div>
        <div className="text-sm font-bold text-gray-900 dark:text-white">$2,845,910</div>
        <div className="mt-0.5 flex items-center gap-0.5 text-[10px] font-bold text-emerald-500">
          <span className="material-symbols-outlined text-xs">trending_up</span>
          <span>+18.4% vs S&P 500</span>
        </div>
      </div>

      <div className="financial-graph-axis absolute inset-x-0 bottom-0 flex justify-between px-2 pt-2 text-[10px] font-bold">
        <span>Q1</span>
        <span>Q2</span>
        <span>Q3</span>
        <span>Q4</span>
        <span>Current</span>
      </div>
    </div>
  );
}
