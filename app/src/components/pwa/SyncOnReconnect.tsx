'use client';

import { useSyncOnReconnect } from '@/hooks/useSyncOnReconnect';

export default function SyncOnReconnect() {
    useSyncOnReconnect();
    return null;
}
