'use client';

import { Toaster } from 'sonner';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster
                position="top-right"
                toastOptions={{
                    className: 'font-[Inter,sans-serif]',
                    style: {
                        borderRadius: '14px',
                        fontSize: '13px',
                        fontWeight: 600,
                        padding: '12px 16px',
                    },
                }}
                theme="system"
                richColors
                closeButton
            />
        </>
    );
}
