'use client';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export default function OfflineBanner() {
    const { isOnline } = useNetworkStatus();

    if (isOnline) return null;

    return (
        <div className="fixed top-0 left-0 lg:left-64 right-0 z-[60] flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500/95 backdrop-blur-sm text-white text-sm font-medium shadow-lg shadow-amber-500/20 animate-in slide-in-from-top-2 fade-in duration-300">
            <span className="material-symbols-outlined text-[18px]">cloud_off</span>
            <span>Offline — changes will sync when you reconnect.</span>
        </div>
    );
}
