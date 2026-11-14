'use client';

/**
 * @fileoverview Keyboard Shortcuts Cheat Sheet Modal.
 *
 * Provides a sleek, Bloomberg- / Linear-grade keyboard shortcut overlay
 * accessible via '?' or 'Shift + /' from anywhere in the application.
 *
 * @module components/KeyboardShortcutsModal
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { usePrivacy } from '@/contexts/PrivacyContext';

interface ShortcutItem {
  keys: string[];
  description: string;
  action?: () => void;
  category: 'Navigation' | 'Actions' | 'View & Privacy';
}

export default function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { togglePrivacy } = usePrivacy();

  useEffect(() => {
    setMounted(true);

    let keySeq = '';
    let keySeqTimeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in form controls
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Check for '?' (Shift + /)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }

      // Close modal on Escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        return;
      }

      // Single-key shortcuts when modal is NOT open
      if (!isOpen && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'n') {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('open-quick-add'));
          return;
        }

        if (e.key.toLowerCase() === 'p') {
          e.preventDefault();
          togglePrivacy();
          return;
        }

        if (e.key.toLowerCase() === 't') {
          e.preventDefault();
          const isDark = document.documentElement.classList.contains('dark');
          const next = !isDark;
          localStorage.setItem('budget-ai-theme', next ? 'dark' : 'light');
          document.documentElement.classList.add('theme-transitioning');
          document.documentElement.classList.toggle('dark', next);
          setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
          return;
        }

        // Two-key chord navigation: G then X
        keySeq += e.key.toLowerCase();
        clearTimeout(keySeqTimeout);
        keySeqTimeout = setTimeout(() => {
          keySeq = '';
        }, 1000);

        if (keySeq === 'gd') {
          router.push('/dashboard');
          keySeq = '';
        } else if (keySeq === 'gm') {
          router.push('/my-month');
          keySeq = '';
        } else if (keySeq === 'gt') {
          router.push('/transactions');
          keySeq = '';
        } else if (keySeq === 'ga') {
          router.push('/accounts');
          keySeq = '';
        } else if (keySeq === 'gb') {
          router.push('/budget');
          keySeq = '';
        } else if (keySeq === 'gh') {
          router.push('/household');
          keySeq = '';
        } else if (keySeq === 'gw') {
          router.push('/wealth-goals');
          keySeq = '';
        } else if (keySeq === 'gi') {
          router.push('/insights');
          keySeq = '';
        } else if (keySeq === 'gs') {
          router.push('/settings');
          keySeq = '';
        }
      }
    };

    const handleCustomOpen = () => setIsOpen(true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-keyboard-shortcuts', handleCustomOpen);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-keyboard-shortcuts', handleCustomOpen);
      clearTimeout(keySeqTimeout);
    };
  }, [isOpen, router, togglePrivacy]);

  const shortcuts: ShortcutItem[] = [
    // Navigation Chords
    {
      category: 'Navigation',
      keys: ['G', 'D'],
      description: 'Go to Command Center (Dashboard)',
      action: () => {
        setIsOpen(false);
        router.push('/dashboard');
      },
    },
    {
      category: 'Navigation',
      keys: ['G', 'M'],
      description: 'Go to My Month (Monthly Command Center)',
      action: () => {
        setIsOpen(false);
        router.push('/my-month');
      },
    },
    {
      category: 'Navigation',
      keys: ['G', 'T'],
      description: 'Go to Transactions Ledger',
      action: () => {
        setIsOpen(false);
        router.push('/transactions');
      },
    },
    {
      category: 'Navigation',
      keys: ['G', 'A'],
      description: 'Go to Accounts & Cards',
      action: () => {
        setIsOpen(false);
        router.push('/accounts');
      },
    },
    {
      category: 'Navigation',
      keys: ['G', 'B'],
      description: 'Go to Budget & Envelopes',
      action: () => {
        setIsOpen(false);
        router.push('/budget');
      },
    },
    {
      category: 'Navigation',
      keys: ['G', 'H'],
      description: 'Go to Collaborative Wealth (Household)',
      action: () => {
        setIsOpen(false);
        router.push('/household');
      },
    },
    {
      category: 'Navigation',
      keys: ['G', 'W'],
      description: 'Go to Wealth Goals & Net Worth',
      action: () => {
        setIsOpen(false);
        router.push('/wealth-goals');
      },
    },
    {
      category: 'Navigation',
      keys: ['G', 'I'],
      description: 'Go to Intelligence & Reports',
      action: () => {
        setIsOpen(false);
        router.push('/insights');
      },
    },

    // Global Actions
    {
      category: 'Actions',
      keys: ['⌘', 'K'],
      description: 'Open Command Palette',
      action: () => {
        setIsOpen(false);
        window.dispatchEvent(new CustomEvent('open-command-palette'));
      },
    },
    {
      category: 'Actions',
      keys: ['C'],
      description: 'Quick Add New Transaction',
      action: () => {
        setIsOpen(false);
        window.dispatchEvent(new CustomEvent('open-quick-add'));
      },
    },
    {
      category: 'Actions',
      keys: ['Esc'],
      description: 'Close active modal / popup / drawer',
      action: () => setIsOpen(false),
    },

    // View & Privacy
    {
      category: 'View & Privacy',
      keys: ['P'],
      description: 'Toggle Privacy Mode (Mask/Reveal Balances)',
      action: () => {
        togglePrivacy();
        setIsOpen(false);
      },
    },
    {
      category: 'View & Privacy',
      keys: ['T'],
      description: 'Toggle Dark / Light Theme',
      action: () => {
        const isDark = document.documentElement.classList.contains('dark');
        const next = !isDark;
        localStorage.setItem('budget-ai-theme', next ? 'dark' : 'light');
        document.documentElement.classList.add('theme-transitioning');
        document.documentElement.classList.toggle('dark', next);
        setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
      },
    },
    {
      category: 'View & Privacy',
      keys: ['?'],
      description: 'Toggle this Shortcuts Cheat Sheet',
      action: () => setIsOpen(false),
    },
  ];

  if (!mounted || !isOpen) return null;

  const categories = ['Navigation', 'Actions', 'View & Privacy'] as const;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-surface-dark/95 z-10 max-h-[85vh] overflow-y-auto custom-scrollbar"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-white/10 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-2xl">keyboard</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Keyboard Shortcuts</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Power-user key combinations for Wealth AI</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Categorized Shortcuts */}
          <div className="space-y-6">
            {categories.map((cat) => (
              <div key={cat}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">{cat}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {shortcuts
                    .filter((s) => s.category === cat)
                    .map((item, idx) => (
                      <div
                        key={idx}
                        onClick={item.action}
                        className="flex items-center justify-between p-2.5 rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02] hover:bg-primary/5 hover:border-primary/20 transition-all cursor-pointer group"
                      >
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">
                          {item.description}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {item.keys.map((k, kIdx) => (
                            <kbd
                              key={kIdx}
                              className="px-2 py-1 text-[11px] font-mono font-bold rounded-lg border border-slate-300 bg-white text-slate-800 shadow-xs dark:border-white/15 dark:bg-white/10 dark:text-slate-200"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>Press <kbd className="px-1.5 py-0.5 font-mono text-[10px] rounded border border-slate-300 dark:border-white/15">?</kbd> anywhere to toggle this guide</span>
            <span>Wealth AI v1.5</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
