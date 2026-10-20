'use client';

/**
 * @fileoverview Silent PWA Service Worker & Install Prompt Bridge.
 * Registers the service worker without popping an intrusive banner on page load.
 * Exposes a clean install trigger for use in Settings and Profile menus.
 *
 * @module components/InstallPrompt
 */

import React, { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __pwaDeferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

/**
 * Hook to check if PWA installation is available and trigger it cleanly.
 */
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePrompt = () => setCanInstall(true);
    if (window.__pwaDeferredPrompt) {
      queueMicrotask(handlePrompt);
    }

    window.addEventListener('pwa-can-install', handlePrompt);
    return () => window.removeEventListener('pwa-can-install', handlePrompt);
  }, []);

  const install = useCallback(async () => {
    if (typeof window === 'undefined' || !window.__pwaDeferredPrompt) return;
    const promptEvent = window.__pwaDeferredPrompt;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      window.__pwaDeferredPrompt = null;
      setCanInstall(false);
    }
  }, []);

  return { canInstall, install };
}

export default function InstallPrompt() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register service worker silently
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // registered
        })
        .catch((err) => {
          console.warn('[PWA] Service worker registration failed:', err);
        });
    }

    const handler = (e: Event) => {
      e.preventDefault();
      window.__pwaDeferredPrompt = e as BeforeInstallPromptEvent;
      window.dispatchEvent(new CustomEvent('pwa-can-install'));
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Returns null so no intrusive banner pops up on page load
  return null;
}
