'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import useSWR from 'swr';

export default function GuestGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { data: userData, error, isLoading } = useSWR('/api/auth/me');

    useEffect(() => {
        if (!isLoading && (error || !userData?.user)) {
            // Unauthenticated client state — redirect to login cleanly
            router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        if (userData?.user?.isGuest) {
            const allowed = pathname === '/tours' || pathname?.startsWith('/tours/') || pathname === '/settings';
            if (!allowed) {
                router.replace('/tours');
            }
        }
    }, [userData, error, isLoading, pathname, router]);

    return <>{children}</>;
}
