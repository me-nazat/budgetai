'use client';

/**
 * @fileoverview Privacy mode toggle button for sidebar/header.
 *
 * Renders a small icon button that toggles financial data masking.
 * Shows a brief tooltip on hover with the keyboard shortcut hint.
 *
 * @module components/PrivacyToggle
 */

import { usePrivacy } from '@/contexts/PrivacyContext';

export default function PrivacyToggle() {
  const { isPrivacyMode, togglePrivacy } = usePrivacy();

  return (
    <button
      onClick={togglePrivacy}
      className={`p-2 rounded-xl transition-all ${
        isPrivacyMode
          ? 'bg-accent-amber/10 text-accent-amber'
          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-hover'
      }`}
      title={`${isPrivacyMode ? 'Disable' : 'Enable'} Privacy Mode (⌘⇧P)`}
      aria-label={isPrivacyMode ? 'Disable privacy mode' : 'Enable privacy mode'}
    >
      <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: isPrivacyMode ? "'FILL' 1" : "'FILL' 0" }}>
        {isPrivacyMode ? 'visibility_off' : 'visibility'}
      </span>
    </button>
  );
}
