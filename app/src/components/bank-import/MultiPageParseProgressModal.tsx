'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MultiPageParseProgressModalProps {
  isOpen: boolean;
  fileName: string;
  pageCount: number;
  pagesParsed: number;
  percentage: number;
  status: string;
  onDismiss?: () => void;
}

/**
 * Module 16.1: Multi-Page Statement Parsing Progress Indicator.
 * Full-screen or modal backdrop with live percentage, page counter,
 * and slow-network persistence indicator.
 */
export function MultiPageParseProgressModal({
  isOpen,
  fileName,
  pageCount,
  pagesParsed,
  percentage,
  status,
  onDismiss,
}: MultiPageParseProgressModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6"
        >
          {/* Animated Spinner & Icon */}
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="8"
                className="text-gray-100 dark:text-slate-800 fill-none"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={264}
                strokeDashoffset={264 - (264 * Math.max(5, percentage)) / 100}
                strokeLinecap="round"
                className="text-primary fill-none transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-gray-900 dark:text-white">
                {Math.round(percentage)}%
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Parsing Financial Statement
            </h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate max-w-xs mx-auto">
              {fileName}
            </p>
          </div>

          {/* Page Counter Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
            <span>
              {pagesParsed > 0 ? `${pagesParsed} of ${pageCount} pages parsed` : `Preparing ${pageCount} pages...`}
            </span>
          </div>

          {/* Slow network explanation banner */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-amber-500 text-lg shrink-0 mt-0.5">
                info
              </span>
              <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                Large statements are analyzed server-side with Gemini AI. On 3G or slower connections, parsing continues autonomously. You can minimize this window anytime.
              </p>
            </div>
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className="w-full min-h-[44px] py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Run in Background
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
