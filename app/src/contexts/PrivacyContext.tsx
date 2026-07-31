'use client';

/**
 * @fileoverview Privacy Mode context provider with per-field granularity.
 *
 * When privacy mode is active, currency formatting functions
 * return masked values (••••) instead of real amounts.
 *
 * Scope options:
 * - 'all' (default): masks everything — balances and transaction details
 * - 'balances_only': masks account balances, net worth; leaves transaction descriptions visible
 * - 'transactions_only': masks transaction amounts/descriptions; leaves balance summaries visible
 *
 * Toggle via:
 * - PrivacyToggle button in sidebar
 * - Keyboard shortcut Ctrl/Cmd+Shift+P
 * - Command Palette
 *
 * @module contexts/PrivacyContext
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

/** The field category being masked */
export type PrivacyFieldScope = 'balance' | 'transaction';

/** User-configurable masking scope */
export type PrivacyMaskScope = 'all' | 'balances_only' | 'transactions_only';

interface PrivacyContextValue {
  /** Whether privacy mode is currently active */
  isPrivacyMode: boolean;
  /** Current masking scope */
  maskScope: PrivacyMaskScope;
  /** Toggle privacy mode on/off */
  togglePrivacy: () => void;
  /** Update masking scope */
  setMaskScope: (scope: PrivacyMaskScope) => void;
  /**
   * Mask a string value if privacy mode is active.
   * @param value - The value to potentially mask
   * @param fieldScope - Optional: which field category ('balance' | 'transaction').
   *   If omitted, masks whenever privacy mode is on (backward compatible).
   */
  mask: (value: string, fieldScope?: PrivacyFieldScope) => string;
  /**
   * Mask a numeric value if privacy mode is active.
   * @param value - The value to potentially mask
   * @param fieldScope - Optional: which field category ('balance' | 'transaction').
   *   If omitted, masks whenever privacy mode is on (backward compatible).
   */
  maskNumber: (value: number | string, fieldScope?: PrivacyFieldScope) => string;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  isPrivacyMode: false,
  maskScope: 'all',
  togglePrivacy: () => {},
  setMaskScope: () => {},
  mask: (v) => v,
  maskNumber: () => '••••',
});

export function usePrivacy() {
  return useContext(PrivacyContext);
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [maskScope, setMaskScopeState] = useState<PrivacyMaskScope>('all');

  // Persist across page navigations within session
  useEffect(() => {
    const stored = sessionStorage.getItem('privacyMode');
    if (stored === 'true') setIsPrivacyMode(true);

    const storedScope = sessionStorage.getItem('privacyMaskScope') as PrivacyMaskScope | null;
    if (storedScope && ['all', 'balances_only', 'transactions_only'].includes(storedScope)) {
      setMaskScopeState(storedScope);
    }
  }, []);

  const togglePrivacy = useCallback(() => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      sessionStorage.setItem('privacyMode', String(next));
      return next;
    });
  }, []);

  const setMaskScope = useCallback((scope: PrivacyMaskScope) => {
    setMaskScopeState(scope);
    sessionStorage.setItem('privacyMaskScope', scope);
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

  /**
   * Determines if a specific field scope should be masked given the current settings.
   */
  const shouldMask = useCallback((fieldScope?: PrivacyFieldScope): boolean => {
    if (!isPrivacyMode) return false;
    if (!fieldScope || maskScope === 'all') return true;
    if (maskScope === 'balances_only' && fieldScope === 'balance') return true;
    if (maskScope === 'transactions_only' && fieldScope === 'transaction') return true;
    return false;
  }, [isPrivacyMode, maskScope]);

  const mask = useCallback((value: string, fieldScope?: PrivacyFieldScope) => {
    if (!shouldMask(fieldScope)) return value;
    return '••••';
  }, [shouldMask]);

  const maskNumber = useCallback((value: number | string, fieldScope?: PrivacyFieldScope) => {
    if (!shouldMask(fieldScope)) return String(value);
    return '••••';
  }, [shouldMask]);

  return (
    <PrivacyContext.Provider value={{ isPrivacyMode, maskScope, togglePrivacy, setMaskScope, mask, maskNumber }}>
      {children}
    </PrivacyContext.Provider>
  );
}
