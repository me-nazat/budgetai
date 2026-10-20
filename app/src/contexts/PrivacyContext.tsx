'use client';

/**
 * @fileoverview Privacy Mode context provider with per-field granularity (Module 14 / Part 2).
 *
 * Implements:
 * - Persistent toggle synchronized with /api/settings/privacy (maskAccountNumbers)
 * - App-wide fetch wrapper attaching 'X-Privacy-Mode: 1'
 * - Mobile deliberate shake-to-hide gesture via devicemotion
 * - Zero-layout-shift tabular placeholder masking ("••••••") and CSS blur on .currency-value, .stat-value, [data-private="true"]
 * - Keyboard shortcuts: Alt+P and Cmd+Shift+P / Ctrl+Shift+P
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
  /** Alias for isPrivacyMode */
  isPrivate: boolean;
  /** Alias for isPrivacyMode */
  isMasked: boolean;
  /** Current masking scope */
  maskScope: PrivacyMaskScope;
  /** Auto-lock timeout in minutes (0 = disabled) */
  autoLockTimeoutMinutes: number;
  /** Whether shake-to-hide gesture is enabled */
  shakeToHideEnabled: boolean;
  /** Toggle privacy mode on/off */
  togglePrivacy: () => void;
  /** Update masking scope */
  setMaskScope: (scope: PrivacyMaskScope) => void;
  /**
   * Mask a string value if privacy mode is active.
   */
  mask: (value: string, fieldScope?: PrivacyFieldScope) => string;
  /**
   * Mask a numeric value if privacy mode is active.
   */
  maskNumber: (value: number | string, fieldScope?: PrivacyFieldScope) => string;
  /**
   * Format or mask amount string with fixed-width placeholder.
   */
  formatAmount: (amount: number, formattedStr: string) => string;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  isPrivacyMode: false,
  isPrivate: false,
  isMasked: false,
  maskScope: 'all',
  autoLockTimeoutMinutes: 5,
  shakeToHideEnabled: true,
  togglePrivacy: () => {},
  setMaskScope: () => {},
  mask: (v) => v,
  maskNumber: () => '••••••',
  formatAmount: (_amount, formattedStr) => formattedStr,
});

export function usePrivacy() {
  return useContext(PrivacyContext);
}

// ── App-Wide Global Fetch Interceptor for X-Privacy-Mode ──
if (typeof window !== 'undefined' && !(window as any)._waiPrivacyFetchPatched) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const isPrivacy = sessionStorage.getItem('privacyMode') === 'true';
    if (isPrivacy) {
      const urlStr = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request)?.url || '';

      if (urlStr.includes('/api/accounts') || urlStr.includes('/api/bank-import')) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has('X-Privacy-Mode')) {
          headers.set('X-Privacy-Mode', '1');
        }
        init.headers = headers;
      }
    }
    return originalFetch(input, init);
  };
  (window as any)._waiPrivacyFetchPatched = true;
}

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('privacyMode') === 'true';
  });

  const [autoLockTimeoutMinutes, setAutoLockTimeoutMinutes] = useState(5);
  const [shakeToHideEnabled, setShakeToHideEnabled] = useState(true);

  const [maskScope, setMaskScopeState] = useState<PrivacyMaskScope>(() => {
    if (typeof window === 'undefined') return 'all';
    const storedScope = sessionStorage.getItem('privacyMaskScope') as PrivacyMaskScope | null;
    return (storedScope && ['all', 'balances_only', 'transactions_only'].includes(storedScope)) ? storedScope : 'all';
  });

  // Apply global zero-layout-shift blur to document.body
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('privacy-mode-active', isPrivacyMode);
    }
  }, [isPrivacyMode]);

  // Sync settings with /api/settings/privacy on mount
  useEffect(() => {
    let isMounted = true;
    fetch('/api/settings/privacy')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!isMounted || !json?.data) return;
        const data = json.data;
        if (typeof data.autoLockTimeoutMinutes === 'number') {
          setAutoLockTimeoutMinutes(data.autoLockTimeoutMinutes);
        }
        if (typeof data.shakeToHideEnabled === 'boolean') {
          setShakeToHideEnabled(data.shakeToHideEnabled);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const togglePrivacy = useCallback(() => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      sessionStorage.setItem('privacyMode', String(next));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('privacy-mode-change', { detail: { isPrivacyMode: next } }));
      }
      // Persist setting to server asynchronously
      fetch('/api/settings/privacy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maskAccountNumbers: next }),
      }).catch(() => {});

      return next;
    });
  }, []);

  const setMaskScope = useCallback((scope: PrivacyMaskScope) => {
    setMaskScopeState(scope);
    sessionStorage.setItem('privacyMaskScope', scope);
  }, []);

  // Keyboard shortcut: Alt+P or Ctrl/Cmd + Shift + P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isAltP = e.altKey && (e.key === 'p' || e.key === 'P');
      const isCmdShiftP = (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P');

      if (isAltP || isCmdShiftP) {
        e.preventDefault();
        togglePrivacy();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePrivacy]);

  // Mobile Shake-to-Hide Detection via devicemotion
  useEffect(() => {
    if (!shakeToHideEnabled || typeof window === 'undefined') return;

    let lastShakeTime = 0;
    const SHAKE_THRESHOLD = 24.0;

    const handleMotion = (event: DeviceMotionEvent) => {
      const current = event.accelerationIncludingGravity || event.acceleration;
      if (!current || current.x === null || current.y === null || current.z === null) return;

      const magnitude = Math.sqrt(
        (current.x || 0) ** 2 +
        (current.y || 0) ** 2 +
        (current.z || 0) ** 2
      );

      const now = Date.now();
      if (magnitude > SHAKE_THRESHOLD && now - lastShakeTime > 1200) {
        lastShakeTime = now;
        togglePrivacy();
      }
    };

    window.addEventListener('devicemotion', handleMotion, { passive: true });
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [shakeToHideEnabled, togglePrivacy]);

  /**
   * Determines if a specific field scope should be masked given current settings.
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
    return '••••••';
  }, [shouldMask]);

  const maskNumber = useCallback((value: number | string, fieldScope?: PrivacyFieldScope) => {
    if (!shouldMask(fieldScope)) return String(value);
    return '••••••';
  }, [shouldMask]);

  const formatAmount = useCallback((_amount: number, formattedStr: string) => {
    if (isPrivacyMode) {
      return '••••••';
    }
    return formattedStr;
  }, [isPrivacyMode]);

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyMode,
        isPrivate: isPrivacyMode,
        isMasked: isPrivacyMode,
        maskScope,
        autoLockTimeoutMinutes,
        shakeToHideEnabled,
        togglePrivacy,
        setMaskScope,
        mask,
        maskNumber,
        formatAmount,
      }}
    >
      {/* Global CSS injection for zero-layout-shift blur */}
      <style jsx global>{`
        body.privacy-mode-active .currency-value,
        body.privacy-mode-active .stat-value,
        body.privacy-mode-active [data-private="true"] {
          filter: blur(6px) !important;
          user-select: none !important;
          transition: filter 0.2s ease-in-out !important;
        }
      `}</style>
      {children}
    </PrivacyContext.Provider>
  );
}
