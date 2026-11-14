'use client';

/**
 * @fileoverview Minimalist Unobtrusive Floating Action Button with Keycap Badge.
 * Safely positioned above mobile bottom bars and desktop margins, never obstructing
 * table pagination or modal bottom sheets.
 *
 * @module components/FloatingActionButton
 */

import React from 'react';
import { motion } from 'framer-motion';

export default function FloatingActionButton() {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('open-quick-add'));
  };

  return (
    <div className="fixed bottom-24 right-5 lg:bottom-8 lg:right-8 z-40 group">
      {/* Tooltip on hover (desktop) */}
      <div className="hidden lg:flex pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-3 opacity-0 group-hover:opacity-100 transition-opacity items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white/95 text-xs font-bold text-slate-800 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-surface-dark/95 dark:text-white whitespace-nowrap">
        <span>Quick Add</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10">C</kbd>
      </div>

      <motion.button
        type="button"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.92, y: 0 }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
        onClick={handleClick}
        aria-label="Quick Add Transaction"
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary via-[#136DEC] to-blue-700 hover:brightness-110 text-white shadow-[0_10px_30px_rgba(19,109,236,0.45)] hover:shadow-[0_16px_36px_rgba(19,109,236,0.6)] flex items-center justify-center border border-white/25 cursor-pointer select-none"
      >
        <span className="material-symbols-outlined text-2xl font-bold transition-transform duration-300 group-hover:rotate-90">add</span>
      </motion.button>
    </div>
  );
}
