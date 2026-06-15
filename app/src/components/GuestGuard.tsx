'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import useSWR from 'swr';

export default function GuestGuard({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { data: userData } = useSWR('/api/auth/me');

    useEffect(() => {
        if (userData?.user?.isGuest) {
            const allowed = pathname === '/tours' || pathname?.startsWith('/tours/') || pathname === '/settings';
            if (!allowed) {
                router.replace('/tours');
            }
        }
    }, [userData, pathname, router]);

    return <>{children}</>;
}
