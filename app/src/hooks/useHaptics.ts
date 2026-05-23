'use client';

import { useCallback } from 'react';

/**
 * Provides haptic feedback via the Web Vibrate API.
 * Falls back to a no-op on unsupported devices.
 */
export function useHaptics() {
    const vibrate = useCallback((pattern: number | number[] = 10) => {
        try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(pattern);
            }
        } catch {
            // Vibrate API not supported
        }
    }, []);

    const tap = useCallback(() => vibrate(10), [vibrate]);
    const success = useCallback(() => vibrate([10, 50, 10]), [vibrate]);
    const error = useCallback(() => vibrate([30, 50, 30, 50, 30]), [vibrate]);

    return { vibrate, tap, success, error };
}
