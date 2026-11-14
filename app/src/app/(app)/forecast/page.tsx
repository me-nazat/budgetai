'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface BillOccurrence {
  id: string;
  name: string;
  amount: number;
  type: 'expense' | 'earning';
  date: string;
  source: 'subscription' | 'recurring' | 'debt';
  daysLeft: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  fmt: (v: number) => string;
}

function CustomTooltip({ active, payload, label, fmt }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white/90 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/90 text-xs text-gray-900 dark:text-white">
      <p className="font-bold mb-1">{label}</p>
      <p className="font-black text-primary text-sm">{fmt(payload[0].value)}</p>
    </div>
  );
}

export default function CashFlowForecastPage() {
  const { fmt } = useCurrency();
  const [loading, setLoading] = useState(true);

  // Data sources
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [recurring, setRecurring] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);

  // User input settings (persisted in localStorage)
  const [startingBalance, setStartingBalance] = useState<number>(50000);
  const [minThreshold, setMinThreshold] = useState<number>(10000);
  const [forecastDays, setForecastDays] = useState<number>(30);

  // Load localStorage preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedStart = localStorage.getItem('forecast-starting-balance');
      const savedMin = localStorage.getItem('forecast-min-threshold');
      const savedDays = localStorage.getItem('forecast-days-window');

      if (savedStart) setStartingBalance(parseFloat(savedStart));
      if (savedMin) setMinThreshold(parseFloat(savedMin));
      if (savedDays) setForecastDays(parseInt(savedDays, 10));
    }
  }, []);

  const saveSettings = (startVal: number, minVal: number, daysVal: number) => {
    setStartingBalance(startVal);
    setMinThreshold(minVal);
    setForecastDays(daysVal);

    if (typeof window !== 'undefined') {
      localStorage.setItem('forecast-starting-balance', String(startVal));
      localStorage.setItem('forecast-min-threshold', String(minVal));
      localStorage.setItem('forecast-days-window', String(daysVal));
    }
  };

  // Load all sources
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [subsRes, recurRes, debtsRes] = await Promise.all([
          fetch('/api/subscriptions'),
          fetch('/api/recurring'),
          fetch('/api/debts'),
        ]);

        const subsData = await subsRes.json();
        const recurData = await recurRes.json();
        const debtsData = await debtsRes.json();

        setSubscriptions(subsData.subscriptions || []);
        setRecurring(recurData.items || []);
        setDebts(debtsData.debts || []);
      } catch (err) {
        console.error('Failed to load forecast inputs:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  // Compute all scheduled occurrences in selected window
  const occurrences = useMemo(() => {
    const list: BillOccurrence[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date(start.getTime() + forecastDays * 24 * 60 * 60 * 1000);

    // 1. Subscriptions
    subscriptions.forEach(sub => {
      if (!sub.is_active && sub.is_active !== undefined) return;
      let nextDate = new Date(sub.next_renewal_date);
      nextDate.setHours(0, 0, 0, 0);

      // Loop forward to find all renewals in window
      while (nextDate <= end) {
        if (nextDate >= start) {
          list.push({
            id: `sub-${sub.id}-${nextDate.getTime()}`,
            name: sub.name,
            amount: sub.amount,
            type: 'expense',
            date: nextDate.toISOString().slice(0, 10),
            source: 'subscription',
            daysLeft: Math.ceil((nextDate.getTime() - start.getTime()) / 86400000),
          });
        }
        if (sub.billing_cycle === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (sub.billing_cycle === 'yearly') {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
      }
    });

    // 2. Recurring Transactions
    recurring.forEach(item => {
      if (item.active === 0) return;
      let nextDate = new Date(item.next_date);
      nextDate.setHours(0, 0, 0, 0);

      while (nextDate <= end) {
        if (nextDate >= start) {
          list.push({
            id: `recur-${item.id}-${nextDate.getTime()}`,
            name: item.name,
            amount: item.amount,
            type: item.type === 'earning' ? 'earning' : 'expense',
            date: nextDate.toISOString().slice(0, 10),
            source: 'recurring',
            daysLeft: Math.ceil((nextDate.getTime() - start.getTime()) / 86400000),
          });
        }
        if (item.frequency === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (item.frequency === 'yearly') {
          nextDate.setFullYear(nextDate.getFullYear() + 1);
        } else {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
      }
    });

    // 3. Debts (Projected minimum payments)
    debts.forEach(debt => {
      if (debt.balance <= 0 || !debt.dueDayOfMonth) return;

      const year = start.getFullYear();
      const month = start.getMonth();

      // We project for 4 months out to cover any 90-day window safely
      for (let i = 0; i < 4; i++) {
        let targetMonth = month + i;
        let targetYear = year;
        if (targetMonth > 11) {
          targetMonth -= 12;
          targetYear += 1;
        }

        const dueDate = new Date(targetYear, targetMonth, debt.dueDayOfMonth);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate >= start && dueDate <= end) {
          list.push({
            id: `debt-${debt.id}-${dueDate.getTime()}`,
            name: `Min Payment: ${debt.name}`,
            amount: debt.minimumPayment,
            type: 'expense',
            date: dueDate.toISOString().slice(0, 10),
            source: 'debt',
            daysLeft: Math.ceil((dueDate.getTime() - start.getTime()) / 86400000),
          });
        }
      }
    });

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [subscriptions, recurring, debts, forecastDays]);

  // Compute daily balance points projection
  const dailyProjections = useMemo(() => {
    const points: Array<{ date: string; balance: number }> = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    let runningBalance = startingBalance;

    // Group occurrences by day
    const occurrencesByDay: Record<string, BillOccurrence[]> = {};
    occurrences.forEach(occ => {
      occurrencesByDay[occ.date] = occurrencesByDay[occ.date] || [];
      occurrencesByDay[occ.date].push(occ);
    });

    for (let i = 0; i <= forecastDays; i++) {
      const currentDay = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = currentDay.toISOString().slice(0, 10);

      // Process all events on this day
      const dayEvents = occurrencesByDay[dateStr] || [];
      dayEvents.forEach(occ => {
        if (occ.type === 'earning') {
          runningBalance += occ.amount;
        } else {
          runningBalance -= occ.amount;
        }
      });

      // Format simple label e.g. "Jul 15"
      const label = currentDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      points.push({
        date: label,
        balance: runningBalance,
      });
    }

    return points;
  }, [startingBalance, occurrences, forecastDays]);

  // Check if balance dips below threshold and locate first bottleneck date
  const bottleneck = useMemo(() => {
    const dip = dailyProjections.find(p => p.balance < minThreshold);
    if (!dip) return null;

    const lowest = [...dailyProjections].sort((a, b) => a.balance - b.balance)[0];
    return {
      firstDipDate: dip.date,
      lowestBalance: lowest.balance,
    };
  }, [dailyProjections, minThreshold]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-bg-dark text-gray-900 dark:text-white px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Cash Flow Forecast</h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium mt-1">
              Project daily balance fluctuations forward to anticipate potential financial bottlenecks.
            </p>
          </div>
          
          {/* Day Window Selector */}
          <div className="flex gap-1.5 bg-gray-150 dark:bg-white/5 p-1 rounded-2xl sm:self-start border border-gray-250 dark:border-white/5">
            {[30, 60, 90].map(days => (
              <button
                key={days}
                onClick={() => saveSettings(startingBalance, minThreshold, days)}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all ${
                  forecastDays === days
                    ? 'bg-white dark:bg-[#151926] text-primary shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                {days} Days
              </button>
            ))}
          </div>
        </div>

        {/* Bottleneck Alert Banner */}
        {bottleneck && (
          <div className="mb-6 rounded-3xl border border-rose-200/50 bg-rose-50/60 dark:bg-rose-950/10 p-5 backdrop-blur-md animate-fade-in flex items-start gap-4">
            <span className="material-symbols-outlined text-rose-500 text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              warning
            </span>
            <div>
              <h4 className="text-sm font-black text-rose-800 dark:text-rose-400">Cash Flow Alert: Danger Zone Approaching</h4>
              <p className="text-xs font-bold text-rose-700/90 dark:text-rose-300/80 mt-1">
                Your projected balance will drop below your minimum threshold ({fmt(minThreshold)}) on{' '}
                <span className="underline font-black">{bottleneck.firstDipDate}</span>. 
                The lowest projected point is{' '}
                <span className="font-black">{fmt(bottleneck.lowestBalance)}</span>.
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left/Main Column: Settings & Projection Chart */}
            <div className="lg:col-span-2 space-y-6">
              {/* Settings configuration block */}
              <div className="glass-panel rounded-3xl p-6 border border-gray-150 dark:border-white/5">
                <h3 className="text-md font-black text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-[20px]">settings_input_component</span>
                  Forecast Variables
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                      Starting Liquid Cash Balance
                    </label>
                    <input
                      type="number"
                      value={startingBalance}
                      onChange={e => saveSettings(parseFloat(e.target.value) || 0, minThreshold, forecastDays)}
                      placeholder="e.g. 50000"
                      className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-1.5">
                      Minimum Safe Threshold
                    </label>
                    <input
                      type="number"
                      value={minThreshold}
                      onChange={e => saveSettings(startingBalance, parseFloat(e.target.value) || 0, forecastDays)}
                      placeholder="e.g. 10000"
                      className="w-full rounded-xl bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm font-bold text-gray-900 dark:text-white outline-none border border-gray-150 dark:border-white/5 focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* Chart projection */}
              <div className="card-premium rounded-3xl p-5 lg:p-6">
                <div className="flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    analytics
                  </span>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white">Cash Balance Timeline Projections</h3>
                </div>

                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyProjections} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#136dec" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#136dec" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 9, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                      />
                      <Tooltip content={<CustomTooltip fmt={fmt} />} />
                      <ReferenceLine y={minThreshold} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="3 3" label={{ value: 'Safe Limit', fill: '#ef4444', fontSize: 9, fontWeight: 'bold', position: 'top' }} />
                      <Area type="monotone" dataKey="balance" stroke="#136dec" strokeWidth={2.5} fill="url(#forecastGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right Column: Unified Bill calendar list */}
            <div className="space-y-6">
              <div className="glass-panel rounded-3xl p-6 border border-gray-150 dark:border-white/5 flex flex-col h-[520px]">
                <div className="mb-4 shrink-0">
                  <h3 className="text-md font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">event_note</span>
                    Bill Calendar & Timeline
                  </h3>
                  <p className="text-xs font-medium text-gray-500 mt-1">
                    Sorted chronologically for the next {forecastDays} days.
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                  {occurrences.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <span className="material-symbols-outlined text-3xl mb-2 opacity-50">calendar_today</span>
                      <p className="text-xs font-bold">No recurring bills or debts scheduled in this window.</p>
                    </div>
                  ) : (
                    occurrences.map(occ => {
                      const isEarning = occ.type === 'earning';
                      const isUrgent = occ.daysLeft <= 3;

                      return (
                        <div
                          key={occ.id}
                          className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                            isUrgent
                              ? 'border-rose-200 bg-rose-50/40 dark:border-rose-500/20 dark:bg-rose-500/5'
                              : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50 dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Icon based on source */}
                            <div
                              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                                isUrgent
                                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                                  : 'bg-primary/10 text-primary border border-primary/20'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                {occ.source === 'subscription'
                                  ? 'card_membership'
                                  : occ.source === 'debt'
                                  ? 'credit_card'
                                  : 'repeat'}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <h4 className="text-xs font-black truncate text-gray-900 dark:text-white leading-tight">
                                {occ.name}
                              </h4>
                              <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                                {occ.date} • {occ.daysLeft === 0 ? 'Today' : `${occ.daysLeft} days`}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isUrgent && (
                              <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md bg-rose-500 text-white animate-pulse">
                                Due
                              </span>
                            )}
                            <span className={`text-xs font-black ${isEarning ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {isEarning ? '+' : '-'}{fmt(occ.amount)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
