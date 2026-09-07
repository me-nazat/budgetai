'use client';

/**
 * @fileoverview LockScreen bridge component.
 *
 * Reads the user's privacy settings from `/api/settings/privacy` via SWR
 * and passes the real `timeoutMinutes` and `lockOnBackground` values
 * to the underlying `<LockScreen />` component.
 *
 * Falls back to disabled (timeout=0) while loading or if the fetch fails,
 * so the app never blocks on a failed privacy settings request.
 *
 * @module components/LockScreenBridge
 */

import useSWR from 'swr';
import LockScreen from '@/components/LockScreen';

interface PrivacySettings {
  autoLockTimeoutMinutes: number;
  lockOnBackground: boolean;
  shakeToHideEnabled: boolean;
  maskAccountNumbers: boolean;
  useBiometrics?: boolean;
}

export default function LockScreenBridge() {
  const { data } = useSWR<{ data: PrivacySettings }>('/api/settings/privacy', {
    // Refetch when window regains focus (user returns from another tab)
    revalidateOnFocus: true,
    // Don't refetch on reconnect — privacy settings rarely change
    revalidateOnReconnect: false,
    // Cache for 5 minutes
    dedupingInterval: 300_000,
  });

  const settings = data?.data;

  return (
    <LockScreen
      timeoutMinutes={settings?.autoLockTimeoutMinutes ?? 0}
      lockOnBackground={settings?.lockOnBackground ?? false}
      biometricEnabled={settings?.useBiometrics ?? true}
    />
  );
}
