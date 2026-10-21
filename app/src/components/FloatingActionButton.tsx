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
      className="fixed bottom-24 right-5 lg:bottom-8 lg:right-8 z-40 w-13 h-13 rounded-full bg-gradient-to-br from-primary via-[#136DEC] to-blue-700 hover:brightness-110 text-white shadow-[0_10px_30px_rgba(19,109,236,0.45)] flex items-center justify-center transition-all border border-white/25 cursor-pointer group"
    >
      <span className="material-symbols-outlined text-2xl font-bold transition-transform group-hover:rotate-90">add</span>
    </motion.button>
  );
}
