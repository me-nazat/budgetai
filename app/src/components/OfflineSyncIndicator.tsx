'use client';

/**
 * @fileoverview Network Connectivity and Background Sync Banner.
 *
 * Provides real-time feedback when network connectivity drops or recovers,
 * assuring users that their local mutations are safely persisted.
 *
 * @module components/OfflineSyncIndicator
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';

export default function OfflineSyncIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);
  const invalidateData = useInvalidateFinancialData();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      invalidateData();
      const timer = setTimeout(() => setShowReconnected(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [invalidateData]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2.5 rounded-full border border-amber-300/30 bg-amber-500/90 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md"
        >
          <span className="flex h-2 w-2 rounded-full bg-white animate-ping" />
          <span>Offline Mode — Transactions are cached locally</span>
        </motion.div>
      )}

      {showReconnected && isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2.5 rounded-full border border-emerald-300/30 bg-emerald-500/90 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md"
        >
          <span className="material-symbols-outlined text-base">cloud_done</span>
          <span>Back Online — Data Synchronized</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
