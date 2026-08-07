'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { ArrowRight, Play, TrendingUp, Shield, Zap } from 'lucide-react';
import { FluidButton } from '@/components/ui/FluidButton';
import { AnimatedCounter } from '@/components/landing/AnimatedCounter';
import { TiltCard } from '@/components/ui/TiltCard';

export function HeroSection({ onOpenAuth }: { onOpenAuth: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);
  const springY = useSpring(y, { stiffness: 100, damping: 30 });
  const springOpacity = useSpring(opacity, { stiffness: 100, damping: 30 });

  return (
    <section ref={containerRef} className="relative min-h-screen flex items-center justify-center px-6 pt-20 pb-32 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }} />

      <motion.div style={{ y: springY, opacity: springOpacity, scale }} className="relative z-10 max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Now with AI Receipt Scanning</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
              className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold text-text-primary leading-[1.05] text-balance">
              Master your <span className="text-gradient-emerald">wealth</span> with precision.
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }}
              className="text-lg text-text-secondary max-w-lg leading-relaxed">
              Wealth AI unifies your financial life. Real-time net worth tracking, intelligent insights, and automated planning.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap items-center gap-4">
              <FluidButton size="lg" className="group" onClick={onOpenAuth}>Get Started Free<ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></FluidButton>
              <FluidButton variant="secondary" size="lg" className="group"><Play size={18} className="text-emerald-400" />Watch Demo</FluidButton>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.7 }}
              className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-3">
                {['bg-emerald-500', 'bg-indigo-500', 'bg-amber-500', 'bg-rose-500'].map((color, i) => (
                  <div key={i} className={`w-10 h-10 rounded-full ${color} border-2 border-background flex items-center justify-center text-white text-xs font-bold`}>
                    {['JD', 'AM', 'KL', 'SR'][i]}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  ))}
                </div>
                <p className="text-xs text-text-tertiary mt-1">Trusted by 10,000+ investors</p>
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, x: 60, rotateY: -5 }} animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ duration: 0.9, delay: 0.3, type: 'spring', stiffness: 100 }} className="relative perspective-1000">
            <TiltCard className="relative">
              <div className="glass-strong rounded-2xl border border-border-default p-6 shadow-2xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-text-tertiary">Net Worth</p>
                      <p className="text-2xl font-bold font-mono text-text-primary">$<AnimatedCounter end={1240500} duration={2} delay={0.8} /></p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                      <TrendingUp size={12} />+2.4%
                    </div>
                  </div>
                  <div className="flex items-end gap-1.5 h-24">
                    {[40, 55, 45, 70, 60, 85, 75, 90, 80, 95, 88, 100].map((h, i) => (
                      <motion.div key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }}
                        transition={{ duration: 0.5, delay: 0.8 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                        className="flex-1 rounded-t-sm bg-gradient-to-t from-emerald-500/40 to-emerald-400/20" />
                    ))}
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-border-subtle">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                        <Zap size={14} className="text-indigo-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-primary">AI Insight</p>
                        <p className="text-xs text-text-tertiary mt-0.5">Your savings rate increased 12.5% this month. Keep it up!</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TiltCard>
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-6 -right-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-transparent border border-emerald-500/10 flex items-center justify-center">
              <Shield size={24} className="text-emerald-400" />
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
