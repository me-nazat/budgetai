import Sidebar from '@/components/Sidebar';
import CurrencySelector from '@/components/CurrencySelector';

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-bg-light dark:bg-bg-dark">
            <Sidebar />
            <CurrencySelector />
            <main className="lg:ml-64 min-h-screen">
                {children}
            </main>
        </div>
    );
}
