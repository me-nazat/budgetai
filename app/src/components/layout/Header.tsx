'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Command } from 'lucide-react';
import { useCommandPalette } from '@/hooks/useCommandPalette';

export function Header() {
  const [notifOpen, setNotifOpen] = useState(false);
  const { open } = useCommandPalette();

  return (
    <header className="sticky top-0 z-[90] h-16 glass-strong border-b border-border-subtle flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button onClick={open}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-border-subtle hover:border-border-default transition-colors text-sm text-text-tertiary hover:text-text-secondary">
          <Search size={14} />
          <span className="hidden sm:inline">Search or jump to...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/[0.05] text-[10px] font-mono text-text-muted">
            <Command size={10} />K
          </kbd>
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
            <Bell size={18} className="text-text-secondary" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent-rose animate-pulse" />
          </button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="absolute right-0 top-full mt-2 w-80 glass-strong rounded-xl border border-border-default shadow-xl overflow-hidden">
                <div className="p-3 border-b border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-primary">Notifications</h3>
                </div>
                <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                  <div className="p-3 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer">
                    <p className="text-sm text-text-primary">Budget alert: Dining at 85%</p>
                    <p className="text-xs text-text-tertiary mt-0.5">2 minutes ago</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold cursor-pointer hover:ring-2 hover:ring-accent-emerald/30 transition-all">
          NA
        </div>
      </div>
    </header>
  );
}
