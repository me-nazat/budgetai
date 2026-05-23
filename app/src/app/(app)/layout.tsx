import Sidebar from '@/components/Sidebar';
import CurrencySelector from '@/components/CurrencySelector';
import MobileTabBar from '@/components/MobileTabBar';
import SWRProvider from '@/components/SWRProvider';
import AppRouteTransition from '@/components/AppRouteTransition';
import CommandPalette from '@/components/CommandPalette';
import PageTransition from '@/components/PageTransition';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SWRProvider>
            <div className="min-h-screen app-surface flex flex-col overflow-x-hidden">
                <Sidebar />
                <CurrencySelector />
                <CommandPalette />
                <AppRouteTransition />
                <main className="lg:ml-64 flex-1 pb-28 lg:pb-0 min-h-screen pt-[env(safe-area-inset-top)] mb-[env(safe-area-inset-bottom)]">
                    <PageTransition>
                        {children}
                    </PageTransition>
                </main>
                <MobileTabBar />
            </div>
        </SWRProvider>
    );
}
