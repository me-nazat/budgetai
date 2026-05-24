'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { useDashboard, useTransactions } from '@/hooks/useApi';
import { getCategoryHex } from '@/lib/categoryUtils';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import DayDetailPopup from '@/components/DayDetailPopup';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import QuickAddModal from '@/components/QuickAddModal';
import { motion } from 'framer-motion';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';

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
    const [popupAnchor, setPopupAnchor] = useState<HTMLElement | null>(null);
    const [selectedTx, setSelectedTx] = useState<any | null>(null);
    const [recurring, setRecurring] = useState<RecurringItem[]>([]);
    const { fmt } = useCurrency();
    const { categories: customCategories } = useCustomCategories('all');
    const { data } = useDashboard(selectedMonth, 'all');
    const { transactions, isLoading } = useTransactions(range.start, range.end, 'all', 500);
    const activeSelectedDay = selectedDay.startsWith(selectedMonth) ? selectedDay : range.start;
    const invalidateData = useInvalidateFinancialData();

    // QuickAddModal states
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [formModalDate, setFormModalDate] = useState<string | undefined>(undefined);
    const [formModalTx, setFormModalTx] = useState<any | null>(null);

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
        <div className="grid min-h-screen grid-cols-1">
            <section className="border-r border-gray-200/70 p-4 lg:p-8 dark:border-[#30363d]">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary">Monthly command center</p>
                        <h1 className="mt-2 text-4xl lg:text-6xl font-black uppercase tracking-tight text-gray-900 dark:text-white">
                            {new Date(range.year, range.month - 1).toLocaleDateString('en-US', { month: 'long' })}
                        </h1>
                        <p className="mt-1 text-2xl font-light tracking-[0.35em] text-gray-400">{range.year}</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={() => { setFormModalDate(undefined); setFormModalTx(null); setIsFormModalOpen(true); }}
                            className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                            <span className="hidden sm:inline">Add Transaction</span>
                        </button>
                        
                        <label className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm dark:border-[#30363d] dark:bg-[#0d1117]/80 dark:text-gray-200 cursor-pointer hover:border-primary/50 transition-colors">
                            <span className="material-symbols-outlined text-primary">calendar_month</span>
                            <select value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="bg-transparent outline-none cursor-pointer">
                                {monthOptions.map(option => <option key={option.value} value={option.value} className="bg-white dark:bg-surface-dark">{option.label}</option>)}
                            </select>
                        </label>
                    </div>
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
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.2, delay: index * 0.01 }}
                                    key={item.date}
                                    onClick={(e) => {
                                        setSelectedDay(item.date);
                                        setPopupAnchor(e.currentTarget);
                                    }}
                                    className={`min-h-[132px] border-b border-r border-gray-200/80 p-3 text-left transition-all hover:bg-primary/5 dark:border-white/10 dark:hover:bg-primary/10 ${isSelected ? 'bg-primary/10 text-primary hover:bg-primary/20 dark:bg-primary/20' : 'bg-white/55 dark:bg-transparent'} ${isToday && !isSelected ? 'ring-2 ring-inset ring-primary/40' : ''}`}
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
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {popupAnchor && (
                <DayDetailPopup
                    date={selectedDay}
                    anchorEl={popupAnchor}
                    transactions={selectedTransactions}
                    recurringItems={selectedRecurring}
                    customCategories={customCategories}
                    onClose={() => setPopupAnchor(null)}
                    onTransactionClick={(tx) => { setPopupAnchor(null); setSelectedTx(tx); }}
                    onAddClick={(date) => { setFormModalDate(date); setFormModalTx(null); setIsFormModalOpen(true); }}
                />
            )}
            
            {selectedTx && (
                <TransactionDetailModal
                    transaction={selectedTx}
                    customCategories={customCategories}
                    onClose={() => setSelectedTx(null)}
                    onEdit={(tx) => { setFormModalDate(undefined); setFormModalTx(tx); setIsFormModalOpen(true); }}
                    onDuplicate={(tx) => {
                        const duplicateTx = { ...tx, id: undefined, date: new Date().toISOString().split('T')[0] };
                        setFormModalDate(undefined); setFormModalTx(duplicateTx); setIsFormModalOpen(true);
                    }}
                    onDelete={async (tx) => { 
                        if (confirm('Are you sure you want to delete this transaction?')) {
                            await fetch(`/api/transactions?id=${tx.id}`, { method: 'DELETE' });
                            invalidateData();
                        }
                    }}
                    onNotesChange={(id, notes) => {
                        invalidateData();
                    }}
                />
            )}
            
            {/* Unified Add / Edit Form Modal */}
            <QuickAddModal 
                isOpen={isFormModalOpen}
                onClose={() => { setIsFormModalOpen(false); setFormModalTx(null); setFormModalDate(undefined); }}
                initialTransaction={formModalTx}
                initialDate={formModalDate}
                onSaveSuccess={() => { invalidateData(); }}
            />
        </div>
    );
}
