'use client';

import React, { useEffect, useRef } from 'react';
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
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle Escape key and prevent background scroll lock leaks
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  // Trap keyboard Tab focus inside active modal dialog
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modalElement = modalRef.current;
    const focusableSelectors =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const focusableElements = Array.from(
      modalElement.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (firstElement) {
      firstElement.focus();
    }

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modalElement.addEventListener('keydown', handleTabKey);
    return () => {
      modalElement.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title || 'Modal dialog'}
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-0 md:p-4"
        >
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Centered elevated dialog on desktop / bottom-anchored sheet on mobile */}
          <motion.div
            ref={modalRef}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="relative w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-t-2xl md:rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] overflow-hidden max-h-[90vh] flex flex-col z-10 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            {/* Top drag handle indicator for mobile ergonomics */}
            <div className="w-12 h-1.5 bg-[var(--border-strong)] rounded-full mx-auto mb-4 md:hidden" />

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-subtle)]">
                <h3 className="text-[15px] font-semibold text-[var(--color-text-main)] tracking-[-0.01em]">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--bg-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/60"
                  aria-label="Close dialog"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
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

export default BottomSheetModal;
