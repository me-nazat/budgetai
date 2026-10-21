'use client';

/**
 * @fileoverview Minimalist Unobtrusive Floating Action Button (Batch 8 Part 4).
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
    <motion.button
      type="button"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={handleClick}
      aria-label="Quick Add Transaction"
      className="fixed bottom-24 right-5 lg:bottom-8 lg:right-8 z-40 w-12 h-12 rounded-full bg-primary hover:bg-primary-hover text-white shadow-xl shadow-primary/30 flex items-center justify-center transition-all border border-primary/40 hover:scale-105 active:scale-95 cursor-pointer"
    >
      <span className="material-symbols-outlined text-2xl font-bold">add</span>
    </motion.button>
  );
}
