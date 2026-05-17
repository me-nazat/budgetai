import Sidebar from '@/components/Sidebar';
import CurrencySelector from '@/components/CurrencySelector';
import MobileTabBar from '@/components/MobileTabBar';
import SWRProvider from '@/components/SWRProvider';
import OfflineBanner from '@/components/pwa/OfflineBanner';
import SyncOnReconnect from '@/components/pwa/SyncOnReconnect';
import AppRouteTransition from '@/components/AppRouteTransition';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <SWRProvider>
            <div className="min-h-screen app-surface flex flex-col">
                <Sidebar />
                <CurrencySelector />
                <OfflineBanner />
                <SyncOnReconnect />
                <AppRouteTransition />
                <main className="lg:ml-64 flex-1 pb-28 lg:pb-0 min-h-screen pt-[env(safe-area-inset-top)] mb-[env(safe-area-inset-bottom)]">
                    {children}
                </main>
                <MobileTabBar />
            </div>
        </SWRProvider>
    );
}
