'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center p-0 lg:p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Bottom Sheet Drawer on Mobile / Centered Glass Card on Desktop */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="relative w-full max-w-xl bg-slate-900/95 border border-white/10 backdrop-blur-xl rounded-t-2xl lg:rounded-2xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col z-10 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            {/* Top drag handle indicator for mobile touch ergonomics */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4 lg:hidden" />

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
                <button
                  onClick={onClose}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  aria-label="Close sheet"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
