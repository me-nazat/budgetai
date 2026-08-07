'use client';

import { useState, useEffect } from 'react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import Link from 'next/link';
import { FluidButton } from '@/components/ui/FluidButton';

export function LandingHeader({ onOpenAuth }: { onOpenAuth: () => void }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 50);
  });

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, type: 'spring', stiffness: 100, damping: 20 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'py-4 backdrop-blur-md bg-background/60 border-b border-border-subtle shadow-sm' : 'py-6 bg-transparent border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <span className="font-serif text-xl font-bold text-text-primary">Wealth AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="#features" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">Features</Link>
          <Link href="#how-it-works" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">How it works</Link>
          <Link href="#testimonials" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">Testimonials</Link>
        </nav>

        <div className="flex items-center gap-4">
          <button onClick={onOpenAuth} className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors hidden sm:block">
            Log in
          </button>
          <FluidButton onClick={onOpenAuth} size="sm">
            Sign Up
          </FluidButton>
        </div>
      </div>
    </motion.header>
  );
}
