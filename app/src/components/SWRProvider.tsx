'use client';

import { SWRConfig } from 'swr';

const fetcher = (url: string) => fetch(url).then(r => {
    if (!r.ok) throw new Error('API error');
    return r.json();
});

export default function SWRProvider({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig value={{
            fetcher,
            revalidateOnFocus: false,
            revalidateOnReconnect: true,
            shouldRetryOnError: false,
            dedupingInterval: 5000,
            keepPreviousData: true,
            errorRetryCount: 2,
        }}>
            {children}
        </SWRConfig>
    );
}
