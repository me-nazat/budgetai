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
    const frameRef = useRef<number | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (firstPath.current === pathname) return;

        frameRef.current = requestAnimationFrame(() => setVisible(true));
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setVisible(false), 400);

        return () => {
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [pathname]);

    if (!visible) return null;

    return (
        <div className="pointer-events-none fixed top-0 left-0 lg:left-64 right-0 z-[45] h-1">
            <div
                className="h-full bg-gradient-to-r from-[#136dec] via-[#06b6d4] to-[#10b981] rounded-full shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                style={{
                    backgroundSize: '200% 100%',
                    animation: 'routeProgress 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards, progressGradient 2s linear infinite',
                }}
            />
        </div>
    );
}
