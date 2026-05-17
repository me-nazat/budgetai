'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Minimal route transition — shows a thin progress bar at the top
 * instead of a heavy blur overlay that blocks UI.
 */
export default function AppRouteTransition() {
    const pathname = usePathname();
    const firstPath = useRef(pathname);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (firstPath.current === pathname) return;

        setVisible(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setVisible(false), 400);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [pathname]);

    if (!visible) return null;

    return (
        <div className="pointer-events-none fixed top-0 left-0 lg:left-64 right-0 z-[45] h-0.5">
            <div
                className="h-full bg-gradient-to-r from-primary via-emerald-400 to-primary rounded-full"
                style={{
                    animation: 'routeProgress 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                }}
            />
        </div>
    );
}
