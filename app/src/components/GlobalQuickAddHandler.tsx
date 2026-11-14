'use client';

/**
 * @fileoverview Global Quick Add Transaction Handler.
 *
 * Listens for 'open-quick-add' window event dispatched from FloatingActionButton,
 * keyboard shortcut 'C' or 'N', Command Palette, or mobile header.
 *
 * @module components/GlobalQuickAddHandler
 */

import React, { useState, useEffect } from 'react';
import { QuickAddTransactionModal } from '@/components/transactions/QuickAddTransactionModal';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';

export default function GlobalQuickAddHandler() {
  const [isOpen, setIsOpen] = useState(false);
  const [initialDate, setInitialDate] = useState<string | undefined>(undefined);
  const invalidateData = useInvalidateFinancialData();

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent<{ date?: string }>;
      if (customEvent.detail?.date) {
        setInitialDate(customEvent.detail.date);
      } else {
        setInitialDate(undefined);
      }
      setIsOpen(true);
    };

    window.addEventListener('open-quick-add', handleOpen);
    return () => {
      window.removeEventListener('open-quick-add', handleOpen);
    };
  }, []);

  return (
    <QuickAddTransactionModal
      isOpen={isOpen}
      onClose={() => {
        setIsOpen(false);
        setInitialDate(undefined);
      }}
      initialDate={initialDate}
      onSaveSuccess={() => {
        invalidateData();
      }}
    />
  );
}
