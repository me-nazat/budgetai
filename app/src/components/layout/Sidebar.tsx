'use client';

import React, { useState } from 'react';
import { PrefetchLink } from '@/components/ui/PrefetchLink';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { AnimatedIcon } from '@/components/effects/AnimatedIcon';

interface NavItem { label: string; href: string; iconName: keyof typeof Icons; badge?: number; }

const navItems: NavItem[] = [
  { label: 'Overview', href: '/overview', iconName: 'LayoutDashboard' },
  { label: 'My Month', href: '/my-month', iconName: 'CalendarDays' },
  { label: 'Transactions', href: '/transactions', iconName: 'Wallet' },
  { label: 'Budgets', href: '/budget', iconName: 'Target' },
  { label: 'Net Worth', href: '/wealth-goals', iconName: 'TrendingUp' },
  { label: 'FIRE', href: '/fire', iconName: 'Flame' },
  { label: 'Tours', href: '/tours', iconName: 'Plane' },
  { label: 'AI Coach', href: '/coach', iconName: 'MessageSquare' },
  { label: 'Achievements', href: '/achievements', iconName: 'Sparkles' },
  { label: 'Settings', href: '/settings', iconName: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { toggleTheme, resolvedTheme } = useTheme();
  const activeIndex = navItems.findIndex((item) => pathname.startsWith(item.href));

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="relative hidden md:flex flex-col h-screen glass-strong border-r border-border-subtle z-[100]"
    >
      <div className="flex items-center h-16 px-5 border-b border-border-subtle shrink-0">
        <PrefetchLink href="/overview" className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shrink-0 shadow-glow-emerald">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}
                className="font-serif text-lg font-semibold text-primary whitespace-nowrap">Wealth AI</motion.span>
            )}
          </AnimatePresence>
        </PrefetchLink>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item, index) => {
          const isActive = activeIndex === index;
          const isHovered = hoveredIndex === index;
          return (
            <PrefetchLink key={item.href} href={item.href}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group"
              onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
              {isActive && (
                <motion.div layoutId="active-pill" className="absolute inset-0 rounded-xl bg-accent-emerald/10 border border-accent-emerald/20"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }} style={{ zIndex: 0 }} />
              )}
              {!isActive && isHovered && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 rounded-xl bg-white/[0.03]" style={{ zIndex: 0 }} />
              )}
              <div className="relative z-10 shrink-0">
                <AnimatedIcon name={item.iconName} size={20} className={`transition-colors duration-200 ${isActive ? 'text-accent-emerald' : 'text-text-secondary group-hover:text-text-primary'}`} />
              </div>
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.2 }}
                    className={`relative z-10 text-sm font-medium whitespace-nowrap overflow-hidden ${isActive ? 'text-text-primary' : 'text-text-secondary group-hover:text-text-primary'}`}>
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {item.badge && !isCollapsed && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="relative z-10 ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent-rose/20 text-[10px] font-semibold text-accent-rose px-1.5">
                  {item.badge}
                </motion.span>
              )}
            </PrefetchLink>
          );
        })}
      </nav>

      <div className="shrink-0 p-3 border-t border-border-subtle space-y-2">
        <button onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group">
          <motion.div animate={{ rotate: resolvedTheme === 'dark' ? 0 : 180 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
            {resolvedTheme === 'dark' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-500">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </motion.div>
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-sm text-text-secondary group-hover:text-text-primary">
                {resolvedTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-white/[0.03] transition-colors">
          <motion.div animate={{ rotate: isCollapsed ? 180 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
            {isCollapsed ? <ChevronRight size={18} className="text-text-tertiary" /> : <ChevronLeft size={18} className="text-text-tertiary" />}
          </motion.div>
        </button>
      </div>
    </motion.aside>
  );
}
