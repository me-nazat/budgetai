import Sidebar from '@/components/Sidebar';
import CurrencySelector from '@/components/CurrencySelector';
import MobileTabBar from '@/components/MobileTabBar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-bg-light dark:bg-bg-dark flex flex-col">
            <Sidebar />
            <CurrencySelector />
            <main className="lg:ml-64 flex-1 pb-16 lg:pb-0 min-h-screen">
                {children}
            </main>
            <MobileTabBar />
        </div>
    );
}
