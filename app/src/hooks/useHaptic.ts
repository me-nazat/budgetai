'use client';

export function useHaptic() {
  const isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;

  const trigger = (pattern: number | number[]) => {
    if (isSupported && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  return {
    light: () => trigger(10),
    medium: () => trigger(20),
    heavy: () => trigger([0, 30, 50, 30]),
    success: () => trigger([0, 20, 50, 20]),
    error: () => trigger([0, 30, 50, 30, 50, 30]),
    isSupported,
  };
}
