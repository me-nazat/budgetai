'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { useDashboard, useTransactions } from '@/hooks/useApi';
import { getCategoryHex } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';

interface RecurringItem {
    id: number;
    name: string;
    type: 'expense' | 'earning' | string;
    amount: number;
    category: string;
    frequency: string;
    next_date: string;
    active: number;
}

function monthRange(monthValue: string) {
    const [year, month] = monthValue.split('-').map(Number);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
    return { year, month, start, end, endDay };
}

function isoDate(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MyMonthPage() {
    const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const range = useMemo(() => monthRange(selectedMonth), [selectedMonth]);
    const [selectedDay, setSelectedDay] = useState(new Date().toISOString().split('T')[0]);
    const [recurring, setRecurring] = useState<RecurringItem[]>([]);
    const { fmt } = useCurrency();
    const { categories: customCategories } = useCustomCategories('all');
    const { data } = useDashboard(selectedMonth, 'all');
    const { transactions, isLoading } = useTransactions(range.start, range.end, 'all', 500);
    const activeSelectedDay = selectedDay.startsWith(selectedMonth) ? selectedDay : range.start;

    useEffect(() => {
        let cancelled = false;
        fetch('/api/recurring')
            .then(res => res.json())
            .then(payload => {
                if (!cancelled) setRecurring(payload.items || []);
            })
            .catch(() => {
                if (!cancelled) setRecurring([]);
            });
        return () => { cancelled = true; };
    }, []);

    const monthOptions = useMemo(() => Array.from({ length: 12 }).map((_, index) => {
        const date = new Date();
        date.setMonth(date.getMonth() - index);
        return {
            value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
            label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        };
    }), []);

    const days = useMemo(() => {
        const first = new Date(range.year, range.month - 1, 1);
        const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
        return [
            ...Array.from({ length: offset }).map(() => null),
            ...Array.from({ length: range.endDay }).map((_, index) => {
                const day = index + 1;
                const date = isoDate(range.year, range.month, day);
                return { day, date };
            }),
        ];
    }, [range.endDay, range.month, range.year]);

    const transactionsByDate = useMemo(() => transactions.reduce<Record<string, typeof transactions>>((map, tx) => {
        if (!map[tx.date]) map[tx.date] = [];
        map[tx.date].push(tx);
        return map;
    }, {}), [transactions]);

    const recurringThisMonth = recurring.filter(item => item.next_date >= range.start && item.next_date <= range.end);
    const selectedTransactions = transactionsByDate[activeSelectedDay] || [];
    const selectedRecurring = recurringThisMonth.filter(item => item.next_date === activeSelectedDay);
    const selectedExpense = selectedTransactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const selectedIncome = selectedTransactions.filter(tx => tx.type === 'earning').reduce((sum, tx) => sum + tx.amount, 0);
    const monthExpense = data?.expenses.current || 0;
    const monthIncome = data?.earnings.current || 0;
    const riskAlerts = data?.budgetAlerts.filter(alert => alert.percentage >= 80) || [];

    const upcoming = [
        ...recurringThisMonth.map(item => ({
            id: `recurring-${item.id}`,
            date: item.next_date,
            title: item.name,
            subtitle: `${item.category} - ${item.frequency}`,
            amount: item.amount,
            type: item.type,
            icon: item.type === 'expense' ? 'event_busy' : 'event_available',
        })),
        ...riskAlerts.map(alert => ({
            id: `budget-${alert.category}`,
            date: range.end,
            title: alert.percentage >= 100 ? `Over Budget: ${alert.category}` : `Budget Watch: ${alert.category}`,
            subtitle: `${alert.percentage}% used`,
            amount: alert.spent,
            type: 'expense',
            icon: alert.percentage >= 100 ? 'error' : 'warning',
        })),
    ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);

    const miniDays = Array.from({ length: 14 }).map((_, index) => {
        const day = Math.min(range.endDay, index + 1);
        return isoDate(range.year, range.month, day);
    });

    return (
        <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[1fr_360px]">
            <section className="border-r border-gray-200/70 p-4 lg:p-8 dark:border-white/10">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Monthly command center</p>
                        <h1 className="mt-2 text-4xl lg:text-6xl font-black uppercase tracking-tight text-gray-900 dark:text-white">
                            {new Date(range.year, range.month - 1).toLocaleDateString('en-US', { month: 'long' })}
                        </h1>
                        <p className="mt-1 text-2xl font-light tracking-[0.35em] text-gray-400">{range.year}</p>
                    </div>
                    <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                        <span className="material-symbols-outlined text-primary">calendar_month</span>
                        <select value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="bg-transparent outline-none">
                            {monthOptions.map(option => <option key={option.value} value={option.value} className="bg-white dark:bg-surface-dark">{option.label}</option>)}
                        </select>
                    </label>
                </div>

                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="card-premium rounded-2xl p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Income</p>
                        <p className="mt-3 text-3xl font-black text-emerald-600">{fmt(monthIncome)}</p>
                    </div>
                    <div className="card-premium rounded-2xl p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Expenses</p>
                        <p className="mt-3 text-3xl font-black text-rose-600">{fmt(monthExpense)}</p>
                    </div>
                    <div className="card-premium rounded-2xl p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">Net</p>
                        <p className={`mt-3 text-3xl font-black ${monthIncome - monthExpense >= 0 ? 'text-primary' : 'text-rose-600'}`}>{fmt(monthIncome - monthExpense)}</p>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/5">
                    <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/80 dark:border-white/10 dark:bg-white/5">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <div key={day} className="px-3 py-4 text-center text-xs font-black uppercase tracking-[0.25em] text-gray-500 dark:text-text-muted">{day}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {days.map((item, index) => {
                            if (!item) return <div key={`blank-${index}`} className="min-h-[132px] border-b border-r border-gray-200/80 bg-gray-50/35 dark:border-white/10 dark:bg-white/[0.02]" />;
                            const dayTx = transactionsByDate[item.date] || [];
                            const expense = dayTx.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
                            const income = dayTx.filter(tx => tx.type === 'earning').reduce((sum, tx) => sum + tx.amount, 0);
                            const recurringCount = recurringThisMonth.filter(rec => rec.next_date === item.date).length;
                            const isSelected = activeSelectedDay === item.date;
                            const isToday = item.date === new Date().toISOString().split('T')[0];
                            return (
                                <button
                                    key={item.date}
                                    onClick={() => setSelectedDay(item.date)}
                                    className={`min-h-[132px] border-b border-r border-gray-200/80 p-3 text-left transition-all hover:bg-primary/5 dark:border-white/10 dark:hover:bg-primary/10 ${isSelected ? 'bg-primary text-white hover:bg-primary' : 'bg-white/55 dark:bg-transparent'} ${isToday && !isSelected ? 'ring-2 ring-inset ring-primary/40' : ''}`}
                                >
                                    <div className="mb-3 flex items-center justify-between">
                                        <span className={`text-2xl font-bold ${isSelected ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{String(item.day).padStart(2, '0')}</span>
                                        {recurringCount > 0 && <span className={`material-symbols-outlined text-[17px] ${isSelected ? 'text-white' : 'text-primary'}`}>repeat</span>}
                                    </div>
                                    <div className="space-y-1">
                                        {income > 0 && <p className={`truncate text-xs font-bold ${isSelected ? 'text-emerald-100' : 'text-emerald-600'}`}>+{fmt(income)}</p>}
                                        {expense > 0 && <p className={`truncate text-xs font-bold ${isSelected ? 'text-rose-100' : 'text-rose-600'}`}>-{fmt(expense)}</p>}
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {dayTx.slice(0, 4).map(tx => (
                                                <span key={tx.id} className="h-2 w-2 rounded-full" style={{ backgroundColor: getCategoryHex(tx.category, customCategories) }} />
                                            ))}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <aside className="bg-white/65 p-4 lg:p-8 dark:bg-white/[0.02]">
                <div className="mb-8">
                    <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-gray-500 dark:text-text-muted">Mini view</p>
                    <div className="grid grid-cols-7 gap-2 text-center text-xs">
                        {miniDays.map(date => {
                            const active = activeSelectedDay === date;
                            const hasData = Boolean(transactionsByDate[date]?.length || recurringThisMonth.some(item => item.next_date === date));
                            return (
                                <button key={date} onClick={() => setSelectedDay(date)} className={`rounded-lg px-1 py-2 font-bold ${active ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : hasData ? 'bg-primary/10 text-primary' : 'text-gray-400'}`}>
                                    {Number(date.slice(-2))}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mb-8">
                    <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-gray-500 dark:text-text-muted">Selected day</p>
                    <div className="card-premium rounded-2xl p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-white">{new Date(activeSelectedDay).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-text-muted">{selectedTransactions.length} transaction{selectedTransactions.length === 1 ? '' : 's'}, {selectedRecurring.length} recurring</p>
                            </div>
                            <span className="material-symbols-outlined rounded-2xl bg-primary/10 p-3 text-primary">event_note</span>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-emerald-500/10 p-3">
                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Income</p>
                                <p className="mt-1 text-lg font-black text-emerald-600">{fmt(selectedIncome)}</p>
                            </div>
                            <div className="rounded-xl bg-rose-500/10 p-3">
                                <p className="text-xs font-bold text-rose-700 dark:text-rose-300">Expenses</p>
                                <p className="mt-1 text-lg font-black text-rose-600">{fmt(selectedExpense)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-8">
                    <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-gray-500 dark:text-text-muted">Day details</p>
                    <div className="space-y-3">
                        {isLoading ? <div className="text-sm text-gray-400">Loading...</div> : null}
                        {selectedTransactions.map(tx => (
                            <div key={tx.id} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: getCategoryHex(tx.category, customCategories) }} />
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{tx.description || tx.category}</p>
                                            <p className="text-xs text-gray-400">{tx.category}</p>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-black ${tx.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>{tx.type === 'expense' ? '-' : '+'}{fmt(tx.amount)}</span>
                                </div>
                            </div>
                        ))}
                        {selectedRecurring.map(item => (
                            <div key={item.id} className="rounded-2xl border border-primary/15 bg-primary/10 p-4 dark:bg-primary/10">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{item.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-text-muted">{item.frequency} recurring - {item.category}</p>
                                    </div>
                                    <span className={`text-sm font-black ${item.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>{item.type === 'expense' ? '-' : '+'}{fmt(item.amount)}</span>
                                </div>
                            </div>
                        ))}
                        {!isLoading && selectedTransactions.length === 0 && selectedRecurring.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400 dark:border-white/10">No activity on this day.</div>
                        )}
                    </div>
                </div>

                <div>
                    <p className="mb-4 text-xs font-black uppercase tracking-[0.24em] text-gray-500 dark:text-text-muted">Upcoming</p>
                    <div className="space-y-4">
                        {upcoming.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400 dark:border-white/10">No upcoming recurring items or budget risks.</div>
                        ) : upcoming.map(item => (
                            <div key={item.id} className="relative border-l-2 border-gray-200 pl-5 dark:border-white/10">
                                <span className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ${item.type === 'expense' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400">{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                <p className="mt-1 text-sm font-black text-gray-900 dark:text-white">{item.title}</p>
                                <div className="mt-1 flex items-center justify-between gap-3">
                                    <span className="text-xs text-gray-500 dark:text-text-muted">{item.subtitle}</span>
                                    <span className={`text-xs font-black ${item.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt(item.amount)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </aside>
        </div>
    );
}
