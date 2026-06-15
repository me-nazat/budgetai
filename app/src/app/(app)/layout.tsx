import Sidebar from '@/components/Sidebar';
import CurrencySelector from '@/components/CurrencySelector';
import MobileTabBar from '@/components/MobileTabBar';
import SWRProvider from '@/components/SWRProvider';
import AppRouteTransition from '@/components/AppRouteTransition';
import CommandPalette from '@/components/CommandPalette';
import PageTransition from '@/components/PageTransition';
import GuestGuard from '@/components/GuestGuard';

import { CurrencyProvider } from '@/contexts/CurrencyContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SWRProvider>
            <CurrencyProvider>
                <div className="min-h-screen app-surface flex flex-col overflow-x-hidden font-sans">
                    <Sidebar />
                    <CurrencySelector />
                    <CommandPalette />
                    <AppRouteTransition />
                    <main className="lg:ml-64 flex-1 pb-28 lg:pb-0 min-h-screen pt-[env(safe-area-inset-top)] mb-[env(safe-area-inset-bottom)]">
                        <GuestGuard>
                            <PageTransition>
                                {children}
                            </PageTransition>
                        </GuestGuard>
                    </main>
                    <MobileTabBar />
                </div>
            </CurrencyProvider>
        </SWRProvider>
    );
}
