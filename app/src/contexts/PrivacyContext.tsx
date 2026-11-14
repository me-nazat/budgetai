'use client';

/**
 * @fileoverview Privacy Mode context provider.
 *
 * When privacy mode is active, all currency formatting functions
 * return masked values (••••) instead of real amounts.
 *
 * Toggle via:
 * - PrivacyToggle button in sidebar
 * - Keyboard shortcut Ctrl/Cmd+Shift+P
 * - Command Palette
 *
 * @module contexts/PrivacyContext
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface PrivacyContextValue {
  /** Whether privacy mode is currently active */
  isPrivacyMode: boolean;
  /** Toggle privacy mode on/off */
  togglePrivacy: () => void;
  /** Mask a string value if privacy mode is active */
  mask: (value: string) => string;
  /** Mask a numeric value if privacy mode is active */
  maskNumber: (value: number | string) => string;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  isPrivacyMode: false,
  togglePrivacy: () => {},
  mask: (v) => v,
  maskNumber: () => '••••',
});

export function usePrivacy() {
  return useContext(PrivacyContext);
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);

  // Persist across page navigations within session
  useEffect(() => {
    const stored = sessionStorage.getItem('privacyMode');
    if (stored === 'true') setIsPrivacyMode(true);
  }, []);

  const togglePrivacy = useCallback(() => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      sessionStorage.setItem('privacyMode', String(next));
      return next;
    });
  }, []);

  // Keyboard shortcut: Ctrl/Cmd + Shift + P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        togglePrivacy();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePrivacy]);

  const mask = useCallback((value: string) => {
    if (!isPrivacyMode) return value;
    return '••••';
  }, [isPrivacyMode]);

  const maskNumber = useCallback((value: number | string) => {
    if (!isPrivacyMode) return String(value);
    return '••••';
  }, [isPrivacyMode]);

  return (
    <PrivacyContext.Provider value={{ isPrivacyMode, togglePrivacy, mask, maskNumber }}>
      {children}
    </PrivacyContext.Provider>
  );
}
