'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { generateMonthOptions } from '@/lib/dateUtils';
import { useDashboard, useUser, useMarketNews, useExchangeRates, useLayout, DashboardData } from '@/hooks/useApi';
import { useSWRConfig } from 'swr';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement } from 'chart.js';
import dynamic from 'next/dynamic';
import React from 'react';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME, getCategoryIcon, getCategoryHex } from '@/lib/categoryUtils';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import AnimatedCounter from '@/components/AnimatedCounter';

// Dynamically import charts and predictive cashflow to eliminate heavy main-thread blocking
const Bar = dynamic(() => import('react-chartjs-2').then(mod => mod.Bar), { ssr: false });
const Doughnut = dynamic(() => import('react-chartjs-2').then(mod => mod.Doughnut), { ssr: false });
const PredictiveCashflow = dynamic(() => import('@/components/charts/PredictiveCashflow'), { ssr: false });
import { TiltCard } from '@/components/ui/TiltCard';
import FinancialMandala from '@/components/generative/FinancialMandala';
import { ShimmerBorder } from '@/components/effects/ShimmerBorder';
import { ProgressiveBlur } from '@/components/effects/ProgressiveBlur';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement);

interface DashboardTransaction {
    id: number;
    type: 'expense' | 'earning';
    amount: number;
    category: string;
    description: string;
    date: string;
}

interface EditableDashboardTransaction extends Omit<DashboardTransaction, 'amount'> {
    amount: number | string;
}

function DashboardSkeleton() {
    return (
        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto page-enter">
            <div className="mb-8 flex items-center justify-between gap-4">
                <div className="space-y-3">
                    <div className="h-5 w-56 rounded-full shimmer-skeleton" />
                    <div className="h-3 w-72 max-w-full rounded-full shimmer-skeleton" />
                </div>
                <div className="hidden h-10 w-52 rounded-xl shimmer-skeleton sm:block" />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map(item => (
                    <div key={item} className="skeleton-panel p-5">
                        <div className="mb-6 h-10 w-10 rounded-xl shimmer-skeleton" />
                        <div className="h-3 w-24 rounded-full shimmer-skeleton" />
                        <div className="mt-3 h-7 w-36 rounded-full shimmer-skeleton" />
                    </div>
                ))}
            </div>
            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="skeleton-panel h-[360px] lg:col-span-2" />
                <div className="skeleton-panel h-[360px]" />
            </div>
            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="skeleton-panel h-[340px] lg:col-span-2" />
                <div className="skeleton-panel h-[340px]" />
            </div>
        </div>
    );
}

function HubSkeleton({ rows = 4 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, index) => (
                <div key={index} className="rounded-xl border border-gray-100 bg-gray-50/70 p-3 dark:border-white/10 dark:bg-white/5">
                    <div className="mb-3 h-3 w-24 rounded-full shimmer-skeleton" />
                    <div className="h-3 w-full rounded-full shimmer-skeleton" />
                    <div className="mt-2 h-2.5 w-2/3 rounded-full shimmer-skeleton" />
                </div>
            ))}
        </div>
    );
}

export default function DashboardPage() {
    const chartRef = useRef(null);
    const { currency, fmt } = useCurrency();
    const router = useRouter();
    const { mutate } = useSWRConfig();

    const [selectedMonth, setSelectedMonth] = useState<string>(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    );
    const [selectedWeek, setSelectedWeek] = useState<string>('all');

    // SWR hooks — cached, stale-while-revalidate
    const { data: swrData, isLoading, isValidating } = useDashboard(selectedMonth, selectedWeek);

    // Synchronously read from localStorage cache for instant render (no flash)
    const cacheKey = `/api/dashboard?month=${selectedMonth}&week=${selectedWeek}`;
    const localCacheData = (() => {
      if (typeof window === 'undefined') return null;
      try {
        const raw = localStorage.getItem('wealth-ai-swr-cache-v1');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const entry = parsed[cacheKey];
        if (entry && entry.value && entry.value.data) {
          return entry.value.data as DashboardData;
        }
      } catch {
        // Ignore parse errors
      }
      return null;
    })();

    const data = swrData || localCacheData;
    const dashboardKey = `/api/dashboard?month=${selectedMonth}&week=${selectedWeek}`;
    const { user } = useUser();
    const marketNews = useMarketNews();
    const exchangeRates = useExchangeRates(currency);
    const { categories: customCats } = useCustomCategories('all');

    // Layout Personalization (Module 7)
    const { layout: layoutData, mutate: mutateLayout } = useLayout();
    const [isLayoutOpen, setIsLayoutOpen] = useState(false);
    const [layoutTab, setLayoutTab] = useState<'desktop' | 'mobile'>('desktop');
    const [tempDesktopLayout, setTempDesktopLayout] = useState<string[]>([]);
    const [tempMobileLayout, setTempMobileLayout] = useState<string[]>([]);
    const [layoutSubmitting, setLayoutSubmitting] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const desktopLayout = layoutData?.dashboardLayout || [
        'net_worth',
        'spending_trends',
        'predictive',
        'top_categories',
        'recent_activity',
        'budget_alerts',
        'intel_hub',
    ];

    const mobileLayout = layoutData?.mobileWidgetOrder || [
        'net_worth',
        'quick_stats',
        'ai_insight',
        'recent_activity',
        'budget_alerts',
        'intel_hub',
    ];

    useEffect(() => {
        if (layoutData) {
            setTempDesktopLayout(layoutData.dashboardLayout);
            setTempMobileLayout(layoutData.mobileWidgetOrder);
        }
    }, [layoutData]);

    const handleMoveDesktop = (index: number, direction: 'up' | 'down') => {
        const nextLayout = [...tempDesktopLayout];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= nextLayout.length) return;
        const temp = nextLayout[index];
        nextLayout[index] = nextLayout[targetIndex];
        nextLayout[targetIndex] = temp;
        setTempDesktopLayout(nextLayout);
    };

    const handleMoveMobile = (index: number, direction: 'up' | 'down') => {
        const nextLayout = [...tempMobileLayout];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= nextLayout.length) return;
        const temp = nextLayout[index];
        nextLayout[index] = nextLayout[targetIndex];
        nextLayout[targetIndex] = temp;
        setTempMobileLayout(nextLayout);
    };

    const handleToggleDesktop = (widgetId: string) => {
        if (tempDesktopLayout.includes(widgetId)) {
            setTempDesktopLayout(tempDesktopLayout.filter(w => w !== widgetId));
        } else {
            setTempDesktopLayout([...tempDesktopLayout, widgetId]);
        }
    };

    const handleToggleMobile = (widgetId: string) => {
        if (tempMobileLayout.includes(widgetId)) {
            setTempMobileLayout(tempMobileLayout.filter(w => w !== widgetId));
        } else {
            setTempMobileLayout([...tempMobileLayout, widgetId]);
        }
    };

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
    };

    const handleDrop = (index: number) => {
        if (draggedIndex === null || draggedIndex === index) return;
        const nextLayout = [...tempDesktopLayout];
        const item = nextLayout.splice(draggedIndex, 1)[0];
        nextLayout.splice(index, 0, item);
        setTempDesktopLayout(nextLayout);
        setDraggedIndex(null);
    };

    const saveLayout = async () => {
        setLayoutSubmitting(true);
        try {
            const res = await fetch('/api/settings/layout', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dashboardLayout: tempDesktopLayout,
                    mobileWidgetOrder: tempMobileLayout,
                }),
            });
            if (!res.ok) throw new Error();
            await mutateLayout();
            toast.success('Layout saved successfully!');
            setIsLayoutOpen(false);
        } catch (err) {
            console.error(err);
            toast.error('Failed to save layout');
        } finally {
            setLayoutSubmitting(false);
        }
    };

    const [selectedDetailTx, setSelectedDetailTx] = useState<any | null>(null);
    const [editingTx, setEditingTx] = useState<EditableDashboardTransaction | null>(null);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [deletingTxId, setDeletingTxId] = useState<number | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Intelligence Hub — default to 'news' tab (Task 2)
    const [chartTimeframe, setChartTimeframe] = useState<'30D' | '90D' | 'YTD'>('30D');
    const invalidateFinancialData = useInvalidateFinancialData();
    const [activeTab, setActiveTab] = useState<'currency' | 'news' | 'calculator'>('news');
    const [calcAmount, setCalcAmount] = useState<number>(500);
    const [calcYears, setCalcYears] = useState<number>(10);
    const [calcRate, setCalcRate] = useState<number>(7);

    useEffect(() => {
        setTimeout(() => setMounted(true), 0);
    }, []);

    // Generate last 12 months for the dropdown without 31st overflow bugs
    const monthOptions = React.useMemo(() => generateMonthOptions(12), []);

    const weekOptions = [
        { value: 'all', label: 'Full Month' },
        { value: '1', label: 'Week 1 (1st-7th)' },
        { value: '2', label: 'Week 2 (8th-14th)' },
        { value: '3', label: 'Week 3 (15th-21st)' },
        { value: '4', label: 'Week 4 (22nd-End)' },
    ];



    const userName = user?.name || '';
    const sym = CURRENCIES[currency].symbol;
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const gridColor = isDark ? '#21262d' : '#e5e7eb';
    const tickColor = isDark ? '#8b949e' : '#6b7280';

    // Memoize heavy chart data objects to prevent unnecessary React re-renders when other states change
    const barData = React.useMemo(() => data ? ({
        labels: data.dailySpending.map((d: any) => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [
            { label: 'Expenses', data: data.dailySpending.map((d: any) => d.expenses), backgroundColor: isDark ? 'rgba(19, 109, 236, 0.6)' : 'rgba(19, 109, 236, 0.7)', borderRadius: 6, borderSkipped: false as const },
            { label: 'Earnings', data: data.dailySpending.map((d: any) => d.earnings), backgroundColor: isDark ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.7)', borderRadius: 6, borderSkipped: false as const },
        ],
    }) : null, [data, isDark]);

    const doughnutData = React.useMemo(() => data ? ({
        labels: data.categorySpending.map((c: any) => c.category.charAt(0).toUpperCase() + c.category.slice(1).toLowerCase()),
        datasets: [{
            data: data.categorySpending.map((c: any) => c.total),
            backgroundColor: data.categorySpending.map((c: any) => {
                const cat = c.category.charAt(0).toUpperCase() + c.category.slice(1).toLowerCase();
                return getCategoryHex(cat, customCats);
            }),
            borderWidth: 0,
            spacing: 2,
        }],
    }) : null, [data, customCats]);

    // Only show full spinner on very first load (no cached data at all)
    if (!data && isLoading) {
        return <DashboardSkeleton />;
    }

    if (!data) return <div className="p-8 text-gray-500">Failed to load dashboard</div>;

    const stats = [
        { label: 'Total Balance', value: fmt(data.balance), change: data.earnings.change, icon: 'account_balance', color: 'text-primary', gradient: 'stat-gradient-blue' },
        { label: 'Monthly Earnings', value: fmt(data.earnings.current), change: data.earnings.change, icon: 'payments', color: 'text-emerald-500', gradient: 'stat-gradient-emerald' },
        { label: 'Monthly Expenses', value: fmt(data.expenses.current), change: data.expenses.change, icon: 'shopping_cart', color: 'text-orange-500', gradient: 'stat-gradient-orange', negative: true },
        { label: 'Net Savings', value: fmt(data.netSavings), change: data.netSavings > 0 ? 8.1 : -5, icon: 'savings', color: 'text-blue-500', gradient: 'stat-gradient-blue' },
    ];

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const dashboardCategoryOptions = editingTx?.type === 'earning' ? CATEGORIES_INCOME : CATEGORIES_EXPENSE;

    const finishMutation = async () => {
        await invalidateFinancialData();
        router.refresh();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
    };

    const submitDashboardEdit = async () => {
        if (editSubmitting) return;
        if (!editingTx) return;

        const parsed = parseFloat(String(editingTx.amount));
        if (!editingTx.amount || isNaN(parsed) || parsed <= 0 || !editingTx.category) return;
        setEditSubmitting(true);

        try {
            // Optimistic update
            mutate(
                dashboardKey,
                (current: any) => {
                    if (!current) return current;
                    const oldTx = current.recentTransactions.find((t: any) => t.id === editingTx.id);
                    if (!oldTx) return current;
                    const diff = parsed - oldTx.amount;
                    
                    const updatedTransactions = current.recentTransactions.map((t: any) =>
                        t.id === editingTx.id ? { ...t, amount: parsed, category: editingTx.category, description: editingTx.description || editingTx.category, date: editingTx.date } : t
                    );
                    
                    let newExpenses = current.expenses.current;
                    let newEarnings = current.earnings.current;
                    if (editingTx.type === 'expense') {
                        newExpenses += diff;
                    } else {
                        newEarnings += diff;
                    }
                    const newBalance = current.balance + (editingTx.type === 'earning' ? diff : -diff);
                    const newNetSavings = newEarnings - newExpenses;

                    return {
                        ...current,
                        recentTransactions: updatedTransactions,
                        expenses: { ...current.expenses, current: newExpenses },
                        earnings: { ...current.earnings, current: newEarnings },
                        netSavings: newNetSavings,
                        balance: newBalance
                    };
                },
                { revalidate: false }
            );

            const response = await fetch('/api/transactions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingTx.id,
                    type: editingTx.type,
                    amount: parsed,
                    category: editingTx.category,
                    description: editingTx.description || editingTx.category,
                    date: editingTx.date,
                }),
            });

            if (!response.ok) throw new Error('Dashboard transaction update failed');

            setEditingTx(null);
            await finishMutation();
        } catch (error) {
            console.error('Dashboard edit error:', error);
            mutate(dashboardKey); // Rollback
        } finally {
            setEditSubmitting(false);
        }
    };

    const submitDashboardDuplicate = async (tx: DashboardTransaction) => {
        if (editSubmitting) return;
        setEditSubmitting(true);
        try {
            // Optimistic update
            mutate(
                dashboardKey,
                (current: any) => {
                    if (!current) return current;
                    const tempId = Date.now();
                    const newTx = {
                        id: tempId,
                        type: tx.type,
                        amount: tx.amount,
                        category: tx.category,
                        description: tx.description || tx.category,
                        date: new Date().toISOString().split('T')[0],
                    };
                    const updatedTransactions = [newTx, ...current.recentTransactions];
                    
                    let newExpenses = current.expenses.current;
                    let newEarnings = current.earnings.current;
                    if (tx.type === 'expense') {
                        newExpenses += tx.amount;
                    } else {
                        newEarnings += tx.amount;
                    }
                    const newBalance = current.balance + (tx.type === 'earning' ? tx.amount : -tx.amount);
                    const newNetSavings = newEarnings - newExpenses;

                    return {
                        ...current,
                        recentTransactions: updatedTransactions,
                        expenses: { ...current.expenses, current: newExpenses },
                        earnings: { ...current.earnings, current: newEarnings },
                        netSavings: newNetSavings,
                        balance: newBalance
                    };
                },
                { revalidate: false }
            );

            const response = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: tx.type,
                    amount: tx.amount,
                    category: tx.category,
                    description: tx.description || tx.category,
                    date: new Date().toISOString().split('T')[0],
                }),
            });

            if (!response.ok) throw new Error('Dashboard transaction duplicate failed');

            await finishMutation();
        } catch (error) {
            console.error('Dashboard duplicate error:', error);
            mutate(dashboardKey); // Rollback
        } finally {
            setEditSubmitting(false);
        }
    };

    const submitDashboardDelete = async () => {
        if (deleteSubmitting) return;
        if (!deletingTxId) return;
        setDeleteSubmitting(true);

        try {
            // Optimistic update
            mutate(
                dashboardKey,
                (current: any) => {
                    if (!current) return current;
                    const oldTx = current.recentTransactions.find((t: any) => t.id === deletingTxId);
                    if (!oldTx) return current;
                    
                    const updatedTransactions = current.recentTransactions.filter((t: any) => t.id !== deletingTxId);
                    
                    let newExpenses = current.expenses.current;
                    let newEarnings = current.earnings.current;
                    if (oldTx.type === 'expense') {
                        newExpenses -= oldTx.amount;
                    } else {
                        newEarnings -= oldTx.amount;
                    }
                    const newBalance = current.balance - (oldTx.type === 'earning' ? oldTx.amount : -oldTx.amount);
                    const newNetSavings = newEarnings - newExpenses;

                    return {
                        ...current,
                        recentTransactions: updatedTransactions,
                        expenses: { ...current.expenses, current: newExpenses },
                        earnings: { ...current.earnings, current: newEarnings },
                        netSavings: newNetSavings,
                        balance: newBalance
                    };
                },
                { revalidate: false }
            );

            const response = await fetch(`/api/transactions?id=${deletingTxId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Dashboard transaction delete failed');

            setDeletingTxId(null);
            await finishMutation();
        } catch (error) {
            console.error('Dashboard delete error:', error);
            mutate(dashboardKey); // Rollback
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const renderActionMenu = (tx: DashboardTransaction) => (
        <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 ml-1 text-sm">chevron_right</span>
    );

    return (
        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto page-enter">
            {showSuccess && (
                <div className="fixed right-6 top-6 z-[90] toast-enter">
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-white shadow-lg shadow-emerald-500/20">
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        <span className="text-sm font-semibold">Transaction updated</span>
                    </div>
                </div>
            )}

            {/* Subtle revalidation indicator — replaces full-screen spinner */}
            {isValidating && (
                <div className="fixed top-0 left-0 lg:left-64 right-0 z-50 h-0.5">
                    <div className="h-full bg-primary/60 animate-pulse rounded-full" />
                </div>
            )}

            {/* ═══════════════════════════════════════════════
               MOBILE HOME VIEW
               ═══════════════════════════════════════════════ */}
            <div className="lg:hidden">
                {/* Mobile Greeting Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-text-muted">{greeting()}</p>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {userName || 'Welcome'} 👋
                        </h2>
                    </div>
                    <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-white font-bold text-base shadow-lg shadow-primary/25">
                        {userName ? userName.charAt(0).toUpperCase() : 'U'}
                    </div>
                </div>

                <div className="mb-5 grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-1.5 rounded-2xl border border-gray-200/70 bg-white/80 px-2 py-2.5 text-[11px] font-semibold text-gray-600 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#161b22]/80 dark:text-gray-300">
                        <span className="material-symbols-outlined text-[15px] text-primary">calendar_month</span>
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-[11px] font-bold outline-none"
                        >
                            {monthOptions.map(m => (
                                <option key={m.value} value={m.value} className="bg-white dark:bg-surface-dark">{m.label.split(' ')[0]}</option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-center gap-1.5 rounded-2xl border border-gray-200/70 bg-white/80 px-2 py-2.5 text-[11px] font-semibold text-gray-600 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#161b22]/80 dark:text-gray-300">
                        <span className="material-symbols-outlined text-[15px] text-primary">view_week</span>
                        <select
                            value={selectedWeek}
                            onChange={e => setSelectedWeek(e.target.value)}
                            className="min-w-0 flex-1 bg-transparent text-[11px] font-bold outline-none"
                        >
                            {weekOptions.map(w => (
                                <option key={w.value} value={w.value} className="bg-white dark:bg-surface-dark">{w.label.replace(' (1st-7th)', '').replace(' (8th-14th)', '').replace(' (15th-21st)', '').replace(' (22nd-End)', '')}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        onClick={() => {
                            if (layoutData) {
                                setTempDesktopLayout(layoutData.dashboardLayout);
                                setTempMobileLayout(layoutData.mobileWidgetOrder);
                            }
                            setLayoutTab('mobile');
                            setIsLayoutOpen(true);
                        }}
                        className="flex items-center justify-center gap-1 rounded-2xl border border-gray-200/70 bg-white/80 px-2 py-2.5 text-[11px] font-bold text-gray-600 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#161b22]/80 dark:text-gray-300"
                    >
                        <span className="material-symbols-outlined text-[16px] text-primary">dashboard_customize</span>
                        <span>Layout</span>
                    </button>
                </div>

                {/* Dynamic Mobile Layout */}
                <div className="flex flex-col gap-5">
                    {mobileLayout.map((widgetId) => {
                        if (widgetId === 'quick_stats') {
                            return (
                                <div key={widgetId} className="flex overflow-x-auto custom-scrollbar gap-3 pb-2 snap-x stagger-children">
                                    <div className="snap-start shrink-0 glass-panel p-3 rounded-2xl flex items-center gap-3 w-[150px]" style={{ animation: 'slideUp 0.4s ease-out both' }}>
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center icon-glow"><span className="material-symbols-outlined text-emerald-500 text-[18px]">savings</span></div>
                                        <div><p className="text-[10px] text-gray-500 dark:text-text-muted uppercase font-bold tracking-wider">Savings Rate</p><p className="text-sm font-bold text-gray-900 dark:text-white">{data.earnings.current > 0 ? ((data.netSavings / data.earnings.current) * 100).toFixed(0) : 0}%</p></div>
                                    </div>
                                    <div className="snap-start shrink-0 glass-panel p-3 rounded-2xl flex items-center gap-3 w-[150px]" style={{ animation: 'slideUp 0.4s ease-out 0.1s both' }}>
                                        <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center icon-glow"><span className="material-symbols-outlined text-rose-500 text-[18px]">speed</span></div>
                                        <div><p className="text-[10px] text-gray-500 dark:text-text-muted uppercase font-bold tracking-wider">Burn Rate</p><p className="text-sm font-bold text-gray-900 dark:text-white">{sym}{(data.expenses.current / Math.max(1, new Date().getDate())).toFixed(0)}/d</p></div>
                                    </div>
                                    <div className="snap-start shrink-0 glass-panel p-3 rounded-2xl flex items-center gap-3 w-[150px]" style={{ animation: 'slideUp 0.4s ease-out 0.2s both' }}>
                                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center icon-glow"><span className="material-symbols-outlined text-amber-500 text-[18px]">warning</span></div>
                                        <div><p className="text-[10px] text-gray-500 dark:text-text-muted uppercase font-bold tracking-wider">Active Alerts</p><p className="text-sm font-bold text-gray-900 dark:text-white">{data.budgetAlerts.filter(b => b.percentage >= 80).length}</p></div>
                                    </div>
                                </div>
                            );
                        }

                        if (widgetId === 'net_worth') {
                            return (
                                <ShimmerBorder key={widgetId} className="rounded-[2rem] hover:scale-[1.02] transition-transform duration-500 shadow-2xl shadow-primary/20 dark:shadow-primary/10 breathe" borderWidth={1}>
                                    <div className="relative rounded-[2rem] p-6 lg:p-8 overflow-hidden h-full">
                                        {/* Background Layers */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-600 to-indigo-600 dark:from-primary/80 dark:via-blue-800/80 dark:to-indigo-900/80" />
                                        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 dark:bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 animate-pulse" style={{ animationDuration: '6s' }} />
                                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-400/20 dark:bg-emerald-500/10 rounded-full blur-3xl translate-y-1/4 -translate-x-1/4 animate-pulse" style={{ animationDuration: '8s', animationDirection: 'reverse' }} />

                                        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none flex items-center justify-center -rotate-6 scale-110 translate-y-10">
                                            <FinancialMandala data={data.categorySpending} width={500} height={500} />
                                        </div>
                                        <ProgressiveBlur direction="bottom" height={80} className="rounded-b-[2rem]" />

                                        {/* Content */}
                                        <div className="relative z-10 flex flex-col h-full justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-white/80 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[16px]">account_balance</span>
                                                    Total Net Worth
                                                </p>
                                                <h3 className="text-5xl lg:text-6xl font-bold text-white tracking-tight mb-2 number-appear flex items-baseline gap-1">
                                                    <span className="text-3xl text-white/70">{sym}</span>
                                                    <AnimatedCounter value={data.balance} delay={0.1} />
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${data.netSavings > 0 ? 'bg-emerald-500/20 text-emerald-100' : 'bg-rose-500/20 text-rose-100'}`}>
                                                        {data.netSavings > 0 ? '+' : ''}{((data.netSavings / (data.earnings.current || 1)) * 100).toFixed(1)}%
                                                    </span>
                                                    <span className="text-white/60 text-xs">vs last month</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mt-8">
                                                <div className="bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-3xl p-4 lg:p-5 shadow-inner">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-8 h-8 rounded-full bg-emerald-400/20 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-emerald-300 text-[16px] font-bold">arrow_downward</span>
                                                        </div>
                                                        <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Total Income</span>
                                                    </div>
                                                    <p className="text-2xl font-bold text-white flex items-baseline gap-1">
                                                        <span className="text-sm text-white/70">{sym}</span>
                                                        <AnimatedCounter value={data.earnings.current} delay={0.2} />
                                                    </p>
                                                </div>
                                                <div className="bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 dark:border-white/10 rounded-3xl p-4 lg:p-5 shadow-inner">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-white text-[16px] font-bold">arrow_upward</span>
                                                        </div>
                                                        <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">Total Expenses</span>
                                                    </div>
                                                    <p className="text-2xl font-bold text-white flex items-baseline gap-1">
                                                        <span className="text-sm text-white/70">{sym}</span>
                                                        <AnimatedCounter value={data.expenses.current} delay={0.3} />
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </ShimmerBorder>
                            );
                        }

                        if (widgetId === 'ai_insight') {
                            return (
                                <div key={widgetId} className="relative glass-panel rounded-2xl p-5 overflow-hidden border border-emerald-100 dark:border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50/50 dark:from-[#161b22] dark:to-emerald-900/10">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_rgb(16,185,129)]" />
                                    <div className="flex items-start gap-3">
                                        <div className="relative shrink-0 mt-0.5">
                                            <div className="absolute inset-0 bg-emerald-400 blur-md rounded-full animate-pulse opacity-50" style={{ animationDuration: '3s' }} />
                                            <div className="relative w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl animate-bounce-in" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5">AI Insight</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                                                {data.netSavings > 0
                                                    ? `Great job! You've saved ${fmt(data.netSavings)} this period. Your savings rate is ${data.earnings.current > 0 ? ((data.netSavings / data.earnings.current) * 100).toFixed(0) : 0}%.`
                                                    : `Heads up — you're spending more than you earn this period. Consider reviewing your top expense categories.`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        if (widgetId === 'recent_activity') {
                            return (
                                <div key={widgetId} className="mb-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
                                        <Link href="/transactions" className="inline-flex items-center gap-1 text-xs font-bold text-primary transition-colors hover:text-blue-600 dark:text-emerald-400">
                                            All transactions
                                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                        </Link>
                                    </div>
                                    <div className="space-y-3 relative overflow-hidden rounded-2xl">
                                        <ProgressiveBlur direction="bottom" height={60} className="rounded-b-2xl z-20" />
                                        {data.recentTransactions.length === 0 ? (
                                            <div className="bg-gray-50 dark:bg-[#161b22] border border-gray-100 dark:border-[#30363d] rounded-2xl p-8 text-center shadow-inner">
                                                <div className="w-12 h-12 bg-gray-100 dark:bg-[#21262d] rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <span className="material-symbols-outlined text-2xl text-gray-400 dark:text-gray-500">receipt_long</span>
                                                </div>
                                                <p className="text-sm font-medium text-gray-500 dark:text-text-muted">No transactions yet</p>
                                            </div>
                                        ) : data.recentTransactions.slice(0, 10).map(t => (
                                            <ShimmerBorder key={t.id} className="rounded-2xl relative z-10" borderWidth={0}>
                                                <div onClick={() => setSelectedDetailTx(t)} className="relative overflow-visible glass-panel rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 active:scale-[0.98] active:bg-gray-50/80 dark:active:bg-surface-hover/80 hover:shadow-md hover:border-primary/30 cursor-pointer group category-accent" style={{ borderLeftColor: getCategoryHex(t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase(), customCats) }}>
                                                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-transparent via-primary/30 dark:via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 ${t.type === 'expense' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
                                                        <span className={`material-symbols-outlined text-xl ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                            {getCategoryIcon(t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase(), customCats)}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-base font-bold text-gray-900 dark:text-white truncate mb-0.5">{t.description || t.category}</p>
                                                        <p className="text-xs font-medium text-gray-400 dark:text-text-muted">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                                    </div>
                                                    <div className="ml-auto flex shrink-0 items-center gap-1">
                                                        <p className={`text-base font-bold ${t.type === 'expense' ? 'text-gray-900 dark:text-white' : 'text-emerald-500'}`}>
                                                            {t.type === 'expense' ? '−' : '+'}{fmt(t.amount)}
                                                        </p>
                                                        {renderActionMenu(t)}
                                                    </div>
                                                </div>
                                            </ShimmerBorder>
                                        ))}
                                    </div>
                                </div>
                            );
                        }

                        if (widgetId === 'budget_alerts') {
                            return (
                                <div key={widgetId} className="glass-panel p-5 rounded-2xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-amber-500">warning</span>
                                            Budget Alerts
                                        </h3>
                                    </div>
                                    <div className="space-y-4">
                                        {data.budgetAlerts.length === 0 ? (
                                            <p className="text-xs text-gray-500 text-center py-4">No active budget alerts</p>
                                        ) : (
                                            data.budgetAlerts.map(b => (
                                                <div key={b.category} className="space-y-1">
                                                    <div className="flex justify-between text-xs font-semibold">
                                                        <span className="text-gray-700 dark:text-gray-300">{b.category}</span>
                                                        <span className={b.percentage >= 100 ? 'text-rose-500' : b.percentage >= 80 ? 'text-amber-500' : 'text-gray-500'}>
                                                            {b.percentage.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-gray-100 dark:bg-[#21262d] overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-500 ${b.percentage >= 100 ? 'bg-rose-500' : b.percentage >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`} 
                                                            style={{ width: `${Math.min(100, b.percentage)}%` }} 
                                                        />
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        }

                        if (widgetId === 'intel_hub') {
                            return (
                                <div key={widgetId} className="glass-panel rounded-2xl flex flex-col overflow-hidden bg-white dark:bg-surface-dark">
                                    <div className="p-4 border-b border-gray-150 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-blue-500 text-lg">insights</span>
                                            Intelligence Hub
                                        </h3>
                                    </div>
                                    <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {marketNews.slice(0, 3).map(news => (
                                            <div key={news.id} className="block p-3 rounded-xl border border-gray-100 dark:border-[#30363d] bg-gray-50/20 dark:bg-[#161b22]/20">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-150 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400">
                                                        {news.sentiment}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400">{news.time}</span>
                                                </div>
                                                <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-snug">{news.title}</h4>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }

                        return null;
                    })}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
               DESKTOP VIEW (hidden on mobile)
               ═══════════════════════════════════════════════ */}
            <div className="hidden lg:block">
                {/* Header */}
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {greeting()}{userName ? `, ${userName}` : ''} 👋
                        </h2>
                        <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Here&apos;s what&apos;s happening with your money.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-text-muted bg-gray-100 dark:bg-surface-dark px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#30363d]">
                            <span className="material-symbols-outlined text-base">calendar_month</span>
                            <select
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                                className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 font-medium cursor-pointer"
                            >
                                {monthOptions.map(m => (
                                    <option key={m.value} value={m.value} className="bg-white dark:bg-surface-dark">{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-text-muted bg-gray-100 dark:bg-surface-dark px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#30363d]">
                            <span className="material-symbols-outlined text-base">view_week</span>
                            <select
                                value={selectedWeek}
                                onChange={e => setSelectedWeek(e.target.value)}
                                className="bg-transparent border-none outline-none text-gray-700 dark:text-gray-300 font-medium cursor-pointer"
                            >
                                {weekOptions.map(w => (
                                    <option key={w.value} value={w.value} className="bg-white dark:bg-surface-dark">{w.label}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={() => {
                                if (layoutData) {
                                    setTempDesktopLayout(layoutData.dashboardLayout);
                                    setTempMobileLayout(layoutData.mobileWidgetOrder);
                                }
                                setLayoutTab('desktop');
                                setIsLayoutOpen(true);
                            }}
                            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-text-muted bg-gray-100 dark:bg-surface-dark px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#30363d] hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[18px]">dashboard_customize</span>
                            <span>Customize</span>
                        </button>
                        <Link href="/generative-art" className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors font-semibold">
                            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                            <span>Generative Studio</span>
                        </Link>
                    </div>
                </header>


                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5 mb-8 stagger-children">
                    {stats.map((s, i) => (
                        <TiltCard key={i} className={`glass-panel ${s.gradient} p-5 lg:p-6 rounded-3xl relative overflow-hidden group breathe`}
                            style={{ animationDelay: `${i * 0.08}s`, animation: `slideUp 0.5s ease-out ${i * 0.08}s both` }}>
                            {i === 0 && (
                                <div className="absolute inset-0 z-0 opacity-20 pointer-events-none flex items-center justify-center -rotate-12 scale-150">
                                    <FinancialMandala data={data.categorySpending} width={300} height={300} />
                                </div>
                            )}
                            <div className="flex flex-col gap-1 relative z-10">
                                <p className="text-gray-500 dark:text-text-muted text-xs font-semibold uppercase tracking-wider">{s.label}</p>
                                <h3 className="text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 text-2xl lg:text-3xl font-bold tracking-tight number-appear">{s.value}</h3>
                                <div className="flex items-center gap-1.5 mt-2">
                                    <span className={`${s.change >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'} text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1`}>
                                        <span className="material-symbols-outlined text-sm">{s.change >= 0 ? 'trending_up' : 'trending_down'}</span>
                                        {s.change >= 0 ? '+' : ''}{s.change.toFixed(1)}%
                                    </span>
                                    <span className="text-gray-400 dark:text-text-muted text-xs">vs prev period</span>
                                </div>
                            </div>
                        </TiltCard>
                    ))}
                </div>

                {/* Charts & Alerts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
                    {/* Spending Trends */}
                    <TiltCard className="lg:col-span-2 glass-panel p-6 rounded-3xl ambient-glow" style={{ animation: 'slideUp 0.5s ease-out 0.35s both' }}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Spending Trends</h3>
                                <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">Income vs Expenses over time</p>
                            </div>
                        </div>
                        <div className="h-[320px]">
                            <Bar ref={chartRef} data={barData!} options={{
                                responsive: true, maintainAspectRatio: false,
                                plugins: {
                                    legend: { position: 'top' as const, labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', padding: 16, font: { size: 12, weight: 500 } } },
                                    tooltip: { backgroundColor: isDark ? '#161b22' : '#fff', titleColor: isDark ? '#f0f6fc' : '#1f2937', bodyColor: isDark ? '#8b949e' : '#6b7280', borderColor: isDark ? '#30363d' : '#e5e7eb', borderWidth: 1, padding: 12, cornerRadius: 8, displayColors: true, boxPadding: 4 },
                                },
                                scales: {
                                    x: { grid: { display: false }, ticks: { color: tickColor, maxTicksLimit: 8, font: { size: 11 }, padding: 10 } },
                                    y: { beginAtZero: true, grid: { color: gridColor, lineWidth: 0.5 }, ticks: { color: tickColor, callback: (v) => sym + v, font: { size: 11 }, padding: 8 }, border: { display: false } },
                                },
                            }} />
                        </div>
                    </TiltCard>

                    {/* Budget Alerts & Categories */}
                    <div className="flex flex-col gap-5" style={{ animation: 'slideUp 0.5s ease-out 0.45s both' }}>
                        {/* Predictive Analytics */}
                        {data.dailySpending && data.earnings && (
                            <PredictiveCashflow dailySpending={data.dailySpending} monthlyIncome={data.earnings.current} />
                        )}

                        {/* Top Categories */}
                        {data.categorySpending.length > 0 && (
                            <TiltCard className="glass-panel p-6 rounded-3xl flex-1 ambient-glow">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Top Categories</h3>
                                <div className="h-[160px]">
                                    <Doughnut data={doughnutData!} options={{
                                        responsive: true, maintainAspectRatio: false,
                                        animation: { duration: 800, easing: 'easeOutQuart' },
                                        plugins: {
                                            legend: { position: 'right' as const, labels: { color: tickColor, usePointStyle: true, pointStyle: 'circle', padding: 10, font: { size: 11 } } },
                                            tooltip: { backgroundColor: isDark ? '#161b22' : '#fff', titleColor: isDark ? '#f0f6fc' : '#1f2937', bodyColor: isDark ? '#8b949e' : '#6b7280', borderColor: isDark ? '#30363d' : '#e5e7eb', borderWidth: 1, padding: 10, cornerRadius: 8 },
                                        },
                                        cutout: '68%',
                                    }} />
                                </div>
                            </TiltCard>
                        )}
                    </div>
                </div>

                {/* Final Row: Recent Transactions & Financial Intelligence Hub */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">

                    {/* Recent Transactions (Takes up 2 cols on large) */}
                    <div className="lg:col-span-2 glass-panel rounded-3xl overflow-visible ambient-glow" style={{ animation: 'slideUp 0.5s ease-out 0.55s both' }}>
                        <div className="p-6 border-b border-gray-200 dark:border-[#30363d] flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
                            <Link href="/transactions" className="text-primary text-sm font-semibold hover:underline flex items-center gap-1">
                                All transactions <span className="material-symbols-outlined text-base">arrow_forward</span>
                            </Link>
                        </div>
                        <div className="overflow-visible">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/80 dark:bg-[#0B0F17] text-xs text-gray-500 dark:text-gray-300 uppercase tracking-wider border-b border-gray-100 dark:border-white/10">
                                        <th className="px-4 lg:px-6 py-3.5 font-semibold">Transaction</th>
                                        <th className="px-4 lg:px-6 py-3.5 font-semibold hidden md:table-cell">Category</th>
                                        <th className="px-4 lg:px-6 py-3.5 font-semibold hidden sm:table-cell">Date</th>
                                        <th className="px-4 lg:px-6 py-3.5 font-semibold text-right">Amount</th>
                                        <th className="px-4 lg:px-6 py-3.5 font-semibold text-right w-12">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-white/10 text-sm">
                                    {data.recentTransactions.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center">
                                            <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 block mb-2">receipt_long</span>
                                            <p className="text-gray-400 dark:text-text-muted">No transactions yet. Use AI Chat to start tracking!</p>
                                        </td></tr>
                                    ) : data.recentTransactions.map((t) => (
                                        <tr key={t.id} onClick={() => setSelectedDetailTx(t)} className="hover:bg-gray-50 dark:hover:bg-surface-hover/50 transition-colors duration-200 cursor-pointer relative group">
                                            <td className="px-4 lg:px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.type === 'expense' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500'}`}>
                                                        <span className="material-symbols-outlined text-lg">{getCategoryIcon(t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase(), customCats)}</span>
                                                    </div>
                                                    <span className="font-medium text-gray-900 dark:text-white truncate">{t.description || t.category}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 lg:px-6 py-4 hidden md:table-cell">
                                                <span 
                                                    className="text-xs font-bold px-2.5 py-1 rounded-md"
                                                    style={{ 
                                                        backgroundColor: `${getCategoryHex(t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase(), customCats)}26`, 
                                                        color: getCategoryHex(t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase(), customCats) 
                                                    }}
                                                >
                                                    {t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase()}
                                                </span>
                                            </td>
                                            <td className="px-4 lg:px-6 py-4 text-gray-500 dark:text-text-muted hidden sm:table-cell">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                            <td className={`px-4 lg:px-6 py-4 text-right font-semibold ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                {t.type === 'expense' ? '-' : '+'}{fmt(t.amount)}
                                            </td>
                                            <td className="px-4 lg:px-6 py-4 text-right w-12 text-gray-400">
                                                <span className="material-symbols-outlined text-[20px] group-hover:text-primary transition-colors">chevron_right</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex flex-col gap-5" style={{ animation: 'slideUp 0.5s ease-out 0.65s both' }}>
                        {/* Budget Alerts */}
                        <div className="glass-panel p-6 rounded-3xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Budget Alerts</h3>
                                {data.budgetAlerts.length > 0 && (
                                    <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold px-2 py-1 rounded-md">
                                        {data.budgetAlerts.filter(b => b.percentage >= 80).length} Alerts
                                    </span>
                                )}
                            </div>
                            <div className="space-y-4">
                                {data.budgetAlerts.length === 0 ? (
                                    <div className="text-center py-4">
                                        <span className="material-symbols-outlined text-3xl text-gray-300 dark:text-gray-600 mb-2 block">verified</span>
                                        <p className="text-sm text-gray-400 dark:text-text-muted">No budget alerts. Set budgets to track spending.</p>
                                    </div>
                                ) : data.budgetAlerts.slice(0, 3).map((b, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{b.category}</span>
                                            <span className={`text-xs font-bold ${b.percentage >= 100 ? 'text-rose-500' : b.percentage >= 80 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                                {b.percentage >= 100 ? 'Over Budget!' : b.percentage >= 80 ? `${b.percentage}% used` : 'On Track'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 dark:bg-surface-hover rounded-full h-2 overflow-hidden">
                                            <div className={`h-2 rounded-full transition-all duration-700 ease-out ${b.percentage >= 100 ? 'bg-rose-500' : b.percentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                style={{ width: `${Math.min(b.percentage, 100)}%` }} />
                                        </div>
                                        <div className="flex justify-between mt-1 text-xs text-gray-400 dark:text-text-muted">
                                            <span>{fmt(b.spent)} spent</span>
                                            <span>{fmt(b.limit)} limit</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Financial Intelligence Hub */}
                        <div className="glass-panel rounded-3xl flex flex-col overflow-hidden ambient-glow">
                        <div className="p-5 border-b border-gray-200 dark:border-[#30363d] bg-gradient-to-r from-blue-500/10 to-transparent">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-blue-500">insights</span>
                                Intelligence Hub
                            </h3>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-[#30363d] text-sm">
                            <button onClick={() => setActiveTab('currency')} className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${activeTab === 'currency' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Rates</button>
                            <button onClick={() => setActiveTab('news')} className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${activeTab === 'news' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>News</button>
                            <button onClick={() => setActiveTab('calculator')} className={`flex-1 py-3 font-semibold transition-colors border-b-2 ${activeTab === 'calculator' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}>Growth</button>
                        </div>

                        {/* Tab Content */}
                        <div className="p-5 flex-1 bg-white dark:bg-surface-dark overflow-y-auto max-h-[350px]">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, filter: 'blur(8px)', y: 8 }}
                                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                                    exit={{ opacity: 0, filter: 'blur(8px)', y: -8 }}
                                    transition={{ duration: 0.22 }}
                                    className={`space-y-4 ${activeTab === 'calculator' ? 'flex flex-col h-full' : ''}`}
                                >
                                    {activeTab === 'currency' ? (
                                        <>
                                            {!exchangeRates ? (
                                                <HubSkeleton rows={5} />
                                            ) : (
                                                <>
                                                    <p className="text-xs text-gray-500 mb-3 font-medium">1 {currency} equals:</p>
                                                    <div className="space-y-3">
                                                        {['EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF'].map(c => {
                                                            // If base is already one of these, skip or show USD instead
                                                            if (c === currency) return null;
                                                            const rate = exchangeRates.rates[c];
                                                            if (!rate) return null;
                                                            return (
                                                                <div key={c} className="flex justify-between items-center group p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors border border-transparent hover:border-gray-100 dark:hover:border-[#30363d]">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#21262d] flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                                                                            {c.slice(0, 2)}
                                                                        </div>
                                                                        <span className="font-semibold text-gray-900 dark:text-white">{c}</span>
                                                                    </div>
                                                                    <span className="font-mono text-gray-700 dark:text-gray-300 group-hover:text-blue-500 transition-colors">{rate.toFixed(4)}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </>
                                    ) : activeTab === 'news' ? (
                                        <>
                                            {marketNews.length === 0 ? (
                                                <HubSkeleton rows={4} />
                                            ) : (
                                                marketNews.map(news => (
                                                    <a key={news.id} href="#" className="block p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-surface-hover border border-gray-100 dark:border-[#30363d] transition-all hover:scale-[1.02] hover:shadow-md">
                                                        <div className="flex justify-between items-start mb-1.5">
                                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${news.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                                news.sentiment === 'negative' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' :
                                                                    'bg-gray-100 text-gray-700 dark:bg-[#21262d] dark:text-gray-300'
                                                                }`}>
                                                                {news.sentiment}
                                                            </span>
                                                            <span className="text-xs text-gray-400">{news.time}</span>
                                                        </div>
                                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug mb-2 group-hover:text-blue-500 transition-colors">{news.title}</h4>
                                                        <p className="text-xs text-gray-500 font-medium">{news.source}</p>
                                                    </a>
                                                ))
                                            )}
                                        </>
                                    ) : activeTab === 'calculator' ? (
                                        <>
                                            <p className="text-xs text-gray-500 mb-2">See how monthly savings grow over time with compound interest.</p>
        
                                            <div className="space-y-3 flex-1">
                                                <div>
                                                    <label htmlFor="calcAmount" className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex justify-between">Monthly Save <span>{fmt(calcAmount)}</span></label>
                                                    <input id="calcAmount" type="range" min="50" max="5000" step="50" value={calcAmount} onChange={e => setCalcAmount(Number(e.target.value))} className="w-full accent-blue-500" />
                                                </div>
                                                <div>
                                                    <label htmlFor="calcYears" className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex justify-between">Years <span>{calcYears} yrs</span></label>
                                                    <input id="calcYears" type="range" min="1" max="40" step="1" value={calcYears} onChange={e => setCalcYears(Number(e.target.value))} className="w-full accent-blue-500" />
                                                </div>
                                                <div>
                                                    <label htmlFor="calcRate" className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex justify-between">Est. Return <span>{calcRate}%</span></label>
                                                    <input id="calcRate" type="range" min="1" max="15" step="0.5" value={calcRate} onChange={e => setCalcRate(Number(e.target.value))} className="w-full accent-blue-500" />
                                                </div>
                                            </div>
        
                                            <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-center">
                                                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Future Value</p>
                                                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                                    {fmt(calcAmount * 12 * ((Math.pow(1 + calcRate / 100, calcYears) - 1) / (calcRate / 100)))}
                                                </p>
                                            </div>
                                        </>
                                    ) : null}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                    </div>

                </div>

                {/* Floating AI Button */}
                <a href="/chat" className="hidden lg:flex fixed bottom-8 right-8 bg-primary text-white rounded-2xl p-4 btn-primary-glow items-center gap-2 group z-50 animate-bounce-in shadow-lg">
                    <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform duration-300">smart_toy</span>
                    <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-sm">Talk to AI</span>
                </a>
            </div>
            {/* End Desktop View */}

            {mounted && createPortal(
                <AnimatePresence>
                    {editingTx && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[6px]" onClick={() => { setEditingTx(null); setEditSubmitting(false); }}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                                transition={{ duration: 0.2 }}
                                className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#30363d] dark:bg-[#161b22]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#30363d] px-5 py-4">
                                    <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                                        <span className="material-symbols-outlined text-primary text-xl">edit</span>
                                        Edit Transaction
                                    </h3>
                                    <button onClick={() => { setEditingTx(null); setEditSubmitting(false); }} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-white/10">
                                        <span className="material-symbols-outlined text-xl">close</span>
                                    </button>
                                </div>
                                <form onSubmit={(event) => { event.preventDefault(); submitDashboardEdit(); }} className="space-y-3 px-5 py-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Type</label>
                                            <select
                                                value={editingTx.type}
                                                onChange={(event) => setEditingTx({ ...editingTx, type: event.target.value as "expense" | "earning", category: '' })}
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-[#30363d] dark:bg-[#0A0E1A] dark:text-white"
                                            >
                                                <option value="expense">Expense</option>
                                                <option value="earning">Earning</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Amount</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editingTx.amount}
                                                onChange={(event) => setEditingTx({ ...editingTx, amount: event.target.value })}
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-[#30363d] dark:bg-[#0A0E1A] dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Category</label>
                                            <select
                                                value={editingTx.category}
                                                onChange={(event) => setEditingTx({ ...editingTx, category: event.target.value })}
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-[#30363d] dark:bg-[#0A0E1A] dark:text-white"
                                            >
                                                <option value="">Select</option>
                                                {dashboardCategoryOptions.map(category => (
                                                    <option key={category.label} value={category.label}>{category.label}</option>
                                                ))}
                                                {customCats.filter(category => category.type === editingTx.type).length > 0 && (
                                                    <optgroup label="Custom">
                                                        {customCats.filter(category => category.type === editingTx.type).map(category => (
                                                            <option key={category.id} value={category.name}>{category.name}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Date</label>
                                            <input
                                                type="date"
                                                value={editingTx.date ? (editingTx.date.includes('T') ? editingTx.date.split('T')[0] : editingTx.date) : ''}
                                                onChange={(event) => setEditingTx({ ...editingTx, date: event.target.value })}
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-[#30363d] dark:bg-[#0A0E1A] dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Description</label>
                                        <input
                                            type="text"
                                            value={editingTx.description || ''}
                                            onChange={(event) => setEditingTx({ ...editingTx, description: event.target.value })}
                                            placeholder="Optional description"
                                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-[#30363d] dark:bg-[#0A0E1A] dark:text-white"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-1">
                                        <button type="button" onClick={() => { setEditingTx(null); setEditSubmitting(false); }} className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-[#21262d] dark:text-gray-300 dark:hover:bg-[#30363d] transition-colors">
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={editSubmitting || !editingTx.amount || !editingTx.category || isNaN(parseFloat(String(editingTx.amount))) || parseFloat(String(editingTx.amount)) <= 0}
                                            className="flex flex-1 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover transition-all disabled:opacity-40 active:scale-[0.98]"
                                        >
                                            {editSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Changes'}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {mounted && createPortal(
                <AnimatePresence>
                    {deletingTxId && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: 18 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 18 }}
                                className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#30363d] dark:bg-zinc-900"
                            >
                                <div className="p-5 text-center">
                                    <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10">
                                        <span className="material-symbols-outlined text-[32px]">delete_forever</span>
                                    </div>
                                    <h3 className="mb-2 text-xl font-bold text-gray-900 dark:text-white">Delete Transaction?</h3>
                                    <p className="mb-6 text-sm text-gray-500 dark:text-text-muted">This transaction will be removed from your history and balance.</p>
                                    <div className="flex gap-3">
                                        <button onClick={() => { setDeletingTxId(null); setDeleteSubmitting(false); }} className="flex-1 rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-surface-dark dark:text-gray-300 dark:hover:bg-white/10">
                                            Cancel
                                        </button>
                                        <button onClick={submitDashboardDelete} disabled={deleteSubmitting} className="flex flex-1 items-center justify-center rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25 hover:bg-rose-600 disabled:opacity-40">
                                            {deleteSubmitting ? <span className="h-5 w-16 rounded-full bg-white/30 shimmer-skeleton" /> : 'Delete'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* Global Details Modal */}
            {selectedDetailTx && mounted && (
                <TransactionDetailModal
                    transaction={selectedDetailTx}
                    customCategories={customCats}
                    onClose={() => setSelectedDetailTx(null)}
                    onEdit={(tx) => {
                        setSelectedDetailTx(null);
                        setEditingTx({ ...tx, amount: String(tx.amount) });
                    }}
                    onDuplicate={(tx) => {
                        setSelectedDetailTx(null);
                        submitDashboardDuplicate(tx);
                    }}
                    onDelete={(tx) => {
                        setSelectedDetailTx(null);
                        setDeletingTxId(tx.id);
                    }}
                    onNotesChange={(id, notes) => {
                        // Optional optimistic update logic if needed
                    }}
                />
            )}
        </div>
    );
}
