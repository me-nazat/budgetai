import { Suspense } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { AppSkeleton } from '@/components/ui/AppSkeleton';
import { CustomCursor } from '@/components/effects/CustomCursor';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { BottomNav } from '@/components/mobile/BottomNav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
          <div className="mx-auto max-w-[1600px] p-6 pb-24">
            <CurrencyProvider>
              <Suspense fallback={<AppSkeleton />}>
                {children}
              </Suspense>
            </CurrencyProvider>
          </div>
        </main>
      </div>
      <CommandPalette />
      <CustomCursor />
      <BottomNav />
    </div>
  );
}
