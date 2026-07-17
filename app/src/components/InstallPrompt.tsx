'use client';

/**
 * @fileoverview PWA Install Prompt component.
 *
 * Shows a custom install banner using the `beforeinstallprompt` API.
 * Automatically registers the service worker on mount.
 * Respects "don't ask again for 30 days" via localStorage.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DAYS = 30;

export default function InstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  const isDismissed = useCallback(() => {
    if (typeof window === 'undefined') return true;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return false;
    const days = (Date.now() - Number(dismissed)) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  }, []);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service worker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service worker registration failed:', err);
        });
    }

    // Listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      if (!isDismissed()) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isDismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') {
      setShowBanner(false);
    }
    deferredPrompt.current = null;
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-24 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:max-w-sm z-[9999]"
        >
          <div className="rounded-2xl border border-white/10 bg-[#0E1420]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">install_mobile</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white">Install Wealth AI</h3>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  Add to your home screen for faster access, offline mode, and push notifications.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 p-1 text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Dismiss"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleInstall}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 active:scale-[0.97] transition-all"
              >
                Install App
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs font-semibold hover:bg-white/10 transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
