'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { useCurrency } from '@/hooks/useCurrency';

interface CalendarEvent {
  id: number;
  title: string;
  amount: number;
  due_date: string;
  reminder_days: number;
}

export default function UpcomingBillsWidget() {
  const { fmtRaw } = useCurrency();
  const { data, isLoading } = useSWR<{ events: CalendarEvent[] }>('/api/calendar/sync');

  if (isLoading) {
    return (
      <div className="glass-panel p-5 animate-pulse">
        <div className="h-4 w-32 bg-gray-200 dark:bg-white/10 rounded-full mb-3" />
        <div className="h-10 w-full bg-gray-200 dark:bg-white/10 rounded-xl" />
      </div>
    );
  }

  const events = data?.events || [];

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">event</span>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Upcoming Bills</h3>
        </div>
        <Link href="/recurring-subscriptions" className="text-xs font-bold text-primary hover:underline">
          Manage
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-4 text-gray-400 text-xs">
          No calendar synced bills yet. Sync your subscriptions!
        </div>
      ) : (
        <div className="space-y-2">
          {events.slice(0, 3).map(event => (
            <div key={event.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 dark:bg-surface-dark">
              <div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{event.title}</p>
                <p className="text-[10px] text-gray-400">Due {new Date(event.due_date).toLocaleDateString()}</p>
              </div>
              <span className="text-xs font-black text-gray-900 dark:text-white">{fmtRaw(event.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
