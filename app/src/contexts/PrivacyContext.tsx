'use client';

/**
 * @fileoverview Privacy Mode context provider with per-field granularity (Module 14).
 *
 * Implements:
 * - Persistent toggle synchronized with /api/settings/privacy (maskAccountNumbers)
 * - App-wide fetch wrapper attaching 'X-Privacy-Mode: 1'
 * - Mobile deliberate shake-to-hide gesture via devicemotion
 * - Skeleton-shaped placeholder masking ("৳••,•••") preventing layout shift and DOM leaks
 * - Inactivity tracking state for auto-lock timeout
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
   * Format or mask amount string with skeleton placeholder.
   */
  formatAmount: (amount: number, formattedStr: string) => string;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  isPrivacyMode: false,
  isPrivate: false,
  maskScope: 'all',
  autoLockTimeoutMinutes: 5,
  shakeToHideEnabled: true,
  togglePrivacy: () => {},
  setMaskScope: () => {},
  mask: (v) => v,
  maskNumber: () => '••••',
  formatAmount: (amount, formattedStr) => formattedStr,
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
      init = init || {};
      const headers = new Headers(init.headers || {});
      if (!headers.has('X-Privacy-Mode')) {
        headers.set('X-Privacy-Mode', '1');
      }
      init.headers = headers;
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
        if (typeof data.maskAccountNumbers === 'boolean') {
          const stored = sessionStorage.getItem('privacyMode');
          if (stored === null) {
            setIsPrivacyMode(data.maskAccountNumbers);
            sessionStorage.setItem('privacyMode', String(data.maskAccountNumbers));
          }
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

  // Keyboard shortcut: Ctrl/Cmd + Shift + P
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

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
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
    const SHAKE_THRESHOLD = 24.0; // Acceleration magnitude m/s^2

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
    return '৳••,•••';
  }, [shouldMask]);

  const formatAmount = useCallback((amount: number, formattedStr: string) => {
    if (isPrivacyMode) {
      // Skeleton placeholder preserving layout width
      return '৳••,•••';
    }
    return formattedStr;
  }, [isPrivacyMode]);

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyMode,
        isPrivate: isPrivacyMode,
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
      {children}
    </PrivacyContext.Provider>
  );
}
