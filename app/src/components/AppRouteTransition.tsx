'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function AppRouteTransition() {
    const pathname = usePathname();
    const firstPath = useRef(pathname);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (firstPath.current === pathname) return;

        const showTimer = setTimeout(() => setVisible(true), 0);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setVisible(false), 520);

        return () => {
            clearTimeout(showTimer);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [pathname]);

    if (!visible) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-[45] lg:left-64 route-blur-enter">
            <div className="absolute inset-0 bg-white/46 dark:bg-[#0d1117]/50 backdrop-blur-xl" />
            <div className="relative mx-auto mt-24 w-[min(720px,calc(100%-2rem))] rounded-2xl border border-white/55 bg-white/50 p-4 shadow-2xl shadow-slate-900/10 dark:border-white/10 dark:bg-[#161b22]/45 dark:shadow-black/30">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl shimmer-skeleton" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-44 rounded-full shimmer-skeleton" />
                        <div className="h-2.5 w-64 max-w-full rounded-full shimmer-skeleton" />
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="h-20 rounded-xl shimmer-skeleton" />
                    <div className="h-20 rounded-xl shimmer-skeleton" />
                    <div className="h-20 rounded-xl shimmer-skeleton" />
                </div>
            </div>
        </div>
    );
}
