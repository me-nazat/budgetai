'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const resolveTheme = useCallback((t: Theme): 'dark' | 'light' => {
    if (t === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return t;
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('wealthai-theme') as Theme | null;
    const initial = saved || 'dark';
    setThemeState(initial);
    setResolvedTheme(resolveTheme(initial));
  }, [resolveTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setIsTransitioning(true);
    localStorage.setItem('wealthai-theme', newTheme);
    setTimeout(() => {
      setThemeState(newTheme);
      const resolved = resolveTheme(newTheme);
      setResolvedTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
      setTimeout(() => setIsTransitioning(false), 600);
    }, 50);
  }, [resolveTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  useEffect(() => { document.documentElement.setAttribute('data-theme', resolvedTheme); }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ clipPath: 'circle(0% at calc(100% - 40px) 40px)' }}
            animate={{ clipPath: 'circle(150% at calc(100% - 40px) 40px)' }}
            exit={{ clipPath: 'circle(0% at calc(100% - 40px) 40px)' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[9999] pointer-events-none"
            style={{ backgroundColor: resolvedTheme === 'dark' ? '#F8FAFC' : '#090D16' }}
          />
        )}
      </AnimatePresence>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
