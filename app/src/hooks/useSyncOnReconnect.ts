'use client';

import { useEffect, useRef } from 'react';
import {
    getPendingTransactions,
    deleteSyncedTransaction,
    incrementRetryCount,
} from '@/lib/offlineDb';
import { invalidateFinancialData } from '@/hooks/useApi';

const MAX_RETRIES = 3;

export function useSyncOnReconnect() {
    const isSyncing = useRef(false);

    useEffect(() => {
        const syncPending = async () => {
            if (isSyncing.current) return;
            isSyncing.current = true;

            try {
                const pending = await getPendingTransactions();
                if (pending.length === 0) {
                    isSyncing.current = false;
                    return;
                }

                const payloads = pending.map((p) => p.payload);

                const res = await fetch('/api/transactions/batch-sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transactions: payloads }),
                });

                if (res.ok) {
                    // Successfully synced — remove all from IndexedDB
                    for (const record of pending) {
                        await deleteSyncedTransaction(record.id);
                    }
                    // Revalidate SWR caches to replace optimistic data with server data
                    await invalidateFinancialData();
                } else {
                    // Sync failed — increment retry counts
                    for (const record of pending) {
                        if (record.retryCount >= MAX_RETRIES) {
                            console.error(
                                `[Sync] Permanently abandoning transaction after ${MAX_RETRIES} retries:`,
                                record.payload
                            );
                            await deleteSyncedTransaction(record.id);
                        } else {
                            await incrementRetryCount(record.id);
                        }
                    }
                }
            } catch (err) {
                console.error('[Sync] Error during background sync:', err);
            } finally {
                isSyncing.current = false;
            }
        };

        window.addEventListener('online', syncPending);

        // Also attempt sync on mount in case we came back online
        // while the component wasn't mounted
        if (navigator.onLine) {
            syncPending();
        }

        return () => {
            window.removeEventListener('online', syncPending);
        };
    }, []);
}
