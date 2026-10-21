'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Toaster, toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { CURRENCIES } from '@/lib/currency';
import { generateMonthOptions } from '@/lib/dateUtils';
import { useDashboard, useUser, useMarketNews, useExchangeRates, useLayout, useAccounts, DashboardData } from '@/hooks/useApi';
import { useSWRConfig } from 'swr';
import { useInvalidateFinancialData } from '@/hooks/useInvalidate';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement } from 'chart.js';
import dynamic from 'next/dynamic';
import React from 'react';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { CATEGORIES_EXPENSE, CATEGORIES_INCOME, getCategoryIcon, getCategoryHex } from '@/lib/categoryUtils';
import TransactionDetailModal from '@/components/TransactionDetailModal';
import AnimatedCounter from '@/components/ui/AnimatedCounter';
import { FirstRunWizard } from '@/components/dashboard/FirstRunWizard';

// Dynamically import charts and predictive cashflow to eliminate heavy main-thread blocking
const Bar = dynamic(() => import('react-chartjs-2').then(mod => mod.Bar), { ssr: false });
const Doughnut = dynamic(() => import('react-chartjs-2').then(mod => mod.Doughnut), { ssr: false });
const PredictiveCashflow = dynamic(() => import('@/components/charts/PredictiveCashflow'), { ssr: false });
const SpendingChart = dynamic(() => import('@/components/charts/SpendingChart'), { ssr: false });
const UpcomingBillsWidget = dynamic(() => import('@/components/UpcomingBillsWidget'), { ssr: false });
const UnifiedHeatmapCard = dynamic(() => import('@/components/dashboard/UnifiedHeatmapCard'), { ssr: false });
const UnifiedInsightsHub = dynamic(() => import('@/components/dashboard/UnifiedInsightsHub'), { ssr: false });
import { TiltCard } from '@/components/ui/TiltCard';
import { DashboardStatCards } from '@/components/dashboard/DashboardStatCards';
import { DashboardLayoutModal } from '@/components/dashboard/DashboardLayoutModal';
import { DashboardIntelHub } from '@/components/dashboard/DashboardIntelHub';
import { HealthScoreWidget } from '@/components/dashboard/HealthScoreWidget';
import { QuickAddTransactionModal } from '@/components/transactions/QuickAddTransactionModal';
import { ReceiptScannerModal } from '@/components/transactions/ReceiptScannerModal';

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

export default function DashboardPage() {
    const chartRef = useRef(null);
    const { currency, fmt } = useCurrency();
    const { formatAmount } = usePrivacy();
    const router = useRouter();
    const { mutate } = useSWRConfig();

    const currentCalendarMonth = useMemo(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    const [selectedMonth, setSelectedMonth] = useState<string>(currentCalendarMonth);
    const [selectedWeek, setSelectedWeek] = useState<string>('all');

    // SWR hooks — cached, stale-while-revalidate
    const { data: swrData, isLoading, isValidating } = useDashboard(selectedMonth, selectedWeek);

    // Synchronously read from localStorage cache for instant render (no flash)
    const cacheKey = `/api/dashboard?month=${selectedMonth}&week=${selectedWeek}`;
    const localCacheData = (() => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem('wealth-ai-swr-cache-v3') || localStorage.getItem('wealth-ai-swr-cache-v1');
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

    // Quick Action Modals
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);

    // First-Run 60-Second Onboarding Wizard
    const { accounts, mutate: mutateAccounts } = useAccounts();
    const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const onboardingDone = localStorage.getItem('wealth-ai-onboarding-completed');
            if (!onboardingDone && accounts && accounts.length === 0) {
                setShowOnboardingWizard(true);
            }
        }
    }, [accounts]);

    const handleOnboardingComplete = () => {
        setShowOnboardingWizard(false);
        if (typeof window !== 'undefined') {
            localStorage.setItem('wealth-ai-onboarding-completed', 'true');
        }
        mutateAccounts();
        mutate('/api/accounts');
        mutate(dashboardKey);
        mutate('/api/budgets');
        mutate('/api/settings');
    };

    // Layout Personalization
    const { layout: layoutData, mutate: mutateLayout } = useLayout();
    const [isLayoutOpen, setIsLayoutOpen] = useState(false);
    const [layoutTab, setLayoutTab] = useState<'desktop' | 'mobile'>('desktop');
    const [tempDesktopLayout, setTempDesktopLayout] = useState<string[]>([]);
    const [tempMobileLayout, setTempMobileLayout] = useState<string[]>([]);
    const [layoutSubmitting, setLayoutSubmitting] = useState(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const desktopLayout = layoutData?.dashboardLayout || [
        'statCards',
        'monthPacing',
        'cashflowChart',
        'accountsLiquidity',
        'healthScore',
        'recent_activity',
        'upcomingBills',
        'intel_hub',
    ];

    const mobileLayout = layoutData?.mobileWidgetOrder || [
        'statCards',
        'monthPacing',
        'accountsLiquidity',
        'healthScore',
        'recent_activity',
        'upcomingBills',
        'ai_insight',
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

    // Month Navigation Helpers
    const handlePrevMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const prevDate = new Date(y, m - 2, 1);
        setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
    };

    const handleNextMonth = () => {
        const [y, m] = selectedMonth.split('-').map(Number);
        const nextDate = new Date(y, m, 1);
        setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
    };

    const handleResetMonth = () => {
        setSelectedMonth(currentCalendarMonth);
        setSelectedWeek('all');
    };

    const formattedMonthLabel = useMemo(() => {
        const [yearStr, monthStr] = selectedMonth.split('-');
        const d = new Date(Number(yearStr), Number(monthStr) - 1, 1);
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }, [selectedMonth]);

    const isCurrentMonth = selectedMonth === currentCalendarMonth;

    const [selectedDetailTx, setSelectedDetailTx] = useState<any | null>(null);
    const [editingTx, setEditingTx] = useState<EditableDashboardTransaction | null>(null);
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [deletingTxId, setDeletingTxId] = useState<number | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Intelligence Hub
    const invalidateFinancialData = useInvalidateFinancialData();
    const [activeTab, setActiveTab] = useState<'currency' | 'news' | 'calculator'>('news');
    const [calcAmount, setCalcAmount] = useState<number>(500);
    const [calcYears, setCalcYears] = useState<number>(10);
    const [calcRate, setCalcRate] = useState<number>(7);

    useEffect(() => {
        setTimeout(() => setMounted(true), 0);
    }, []);

    const userName = user?.name || '';
    const sym = CURRENCIES[currency].symbol;
    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : '#e5e7eb';
    const tickColor = isDark ? '#94a3b8' : '#6b7280';

    // Memoize heavy chart data
    const barData = useMemo(() => data ? ({
        labels: data.dailySpending.map((d: any) => new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [
            { label: 'Expenses', data: data.dailySpending.map((d: any) => d.expenses), backgroundColor: isDark ? 'rgba(19, 109, 236, 0.6)' : 'rgba(19, 109, 236, 0.7)', borderRadius: 6, borderSkipped: false as const },
            { label: 'Earnings', data: data.dailySpending.map((d: any) => d.earnings), backgroundColor: isDark ? 'rgba(16, 185, 129, 0.6)' : 'rgba(16, 185, 129, 0.7)', borderRadius: 6, borderSkipped: false as const },
        ],
    }) : null, [data, isDark]);

    const doughnutData = useMemo(() => data ? ({
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

    if (!data && isLoading) {
        return <DashboardSkeleton />;
    }

    if (!data) return <div className="p-8 text-gray-500">Failed to load dashboard</div>;

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
            mutate(dashboardKey);
        } finally {
            setEditSubmitting(false);
        }
    };

    const submitDashboardDelete = async () => {
        if (deleteSubmitting) return;
        if (!deletingTxId) return;
        setDeleteSubmitting(true);

        try {
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
            mutate(dashboardKey);
        } finally {
            setDeleteSubmitting(false);
        }
    };

    // Section Visibility Helpers
    const isDesktopSectionVisible = (key: string) => {
        if (key === 'statCards') return desktopLayout.includes('statCards') || desktopLayout.includes('net_worth');
        if (key === 'monthPacing') return desktopLayout.includes('monthPacing') || desktopLayout.includes('budget_alerts');
        if (key === 'cashflowChart') return desktopLayout.includes('cashflowChart') || desktopLayout.includes('spending_trends') || desktopLayout.includes('predictive');
        if (key === 'accountsLiquidity') return desktopLayout.includes('accountsLiquidity');
        if (key === 'healthScore') return desktopLayout.includes('healthScore');
        if (key === 'upcomingBills') return desktopLayout.includes('upcomingBills');
        if (key === 'recent_activity') return desktopLayout.includes('recent_activity');
        if (key === 'intel_hub') return desktopLayout.includes('intel_hub');
        return true;
    };

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

            {isValidating && (
                <div className="fixed top-0 left-0 lg:left-64 right-0 z-50 h-0.5">
                    <div className="h-full bg-primary/60 animate-pulse rounded-full" />
                </div>
            )}

            {/* ═══════════════════════════════════════════════
               MOBILE VIEW (hidden on desktop)
               ═══════════════════════════════════════════════ */}
            <div className="lg:hidden">
                {/* Mobile Header with Period Switcher and Quick Actions */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-text-muted">{greeting()}</p>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {userName || 'Welcome'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setIsQuickAddOpen(true)}
                            className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-md active:scale-95 transition-transform"
                            title="Add Transaction"
                        >
                            <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                        <button
                            onClick={() => setIsReceiptScannerOpen(true)}
                            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                            title="Scan Receipt"
                        >
                            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
                        </button>
                        <button
                            onClick={() => {
                                if (layoutData) {
                                    setTempDesktopLayout(layoutData.dashboardLayout);
                                    setTempMobileLayout(layoutData.mobileWidgetOrder);
                                }
                                setLayoutTab('mobile');
                                setIsLayoutOpen(true);
                            }}
                            className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                            title="Customize Layout"
                        >
                            <span className="material-symbols-outlined text-[18px]">dashboard_customize</span>
                        </button>
                    </div>
                </div>

                {/* Mobile Month Switcher Bar */}
                <div className="mb-4 flex items-center justify-between bg-white dark:bg-surface-dark border border-gray-200/80 dark:border-white/10 rounded-2xl p-2 shadow-sm">
                    <button
                        onClick={handlePrevMonth}
                        className="p-1.5 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        title="Previous Month"
                    >
                        <span className="material-symbols-outlined text-base leading-none">chevron_left</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                            {formattedMonthLabel}
                        </span>
                        {!isCurrentMonth && (
                            <button
                                onClick={handleResetMonth}
                                className="px-2 py-0.5 text-[10px] font-bold text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
                            >
                                Today
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleNextMonth}
                        className="p-1.5 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                        title="Next Month"
                    >
                        <span className="material-symbols-outlined text-base leading-none">chevron_right</span>
                    </button>
                </div>

                {/* Dynamic Mobile Layout */}
                <div className="flex flex-col gap-5">
                    {mobileLayout.map((widgetId) => {
                        if (widgetId === 'statCards' || widgetId === 'net_worth') {
                            return <DashboardStatCards key={widgetId} data={data} fmt={fmt} />;
                        }

                        if (widgetId === 'monthPacing' && data.spendingPace) {
                            return (
                                <div key={widgetId} className="glass-panel p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-surface-dark shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-primary text-base">speed</span>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Month Burn Rate</h3>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            data.spendingPace.budgetConsumedPercent <= data.spendingPace.monthElapsedPercent
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                        }`}>
                                            {data.spendingPace.budgetConsumedPercent <= data.spendingPace.monthElapsedPercent ? 'On Track' : 'High Burn'}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex justify-between text-[11px] font-semibold mb-1 text-gray-600 dark:text-gray-400">
                                                <span>Calendar Elapsed</span>
                                                <span className="tabular-nums font-mono">{data.spendingPace.monthElapsedPercent}% ({data.spendingPace.dayOfMonth}/{data.spendingPace.daysInMonth}d)</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                                                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.min(100, data.spendingPace.monthElapsedPercent)}%` }} />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-[11px] font-semibold mb-1 text-gray-600 dark:text-gray-400">
                                                <span>Budget Consumed</span>
                                                <span className="tabular-nums font-mono">{data.spendingPace.budgetConsumedPercent}% ({formatAmount(data.spendingPace.currentMonthSpendToDate, fmt(data.spendingPace.currentMonthSpendToDate))})</span>
                                            </div>
                                            <div className="h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-700 ${
                                                        data.spendingPace.budgetConsumedPercent > data.spendingPace.monthElapsedPercent ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`} 
                                                    style={{ width: `${Math.min(100, data.spendingPace.budgetConsumedPercent)}%` }} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        if (widgetId === 'accountsLiquidity' && data.accountsSummary) {
                            return (
                                <div key={widgetId} className="glass-panel p-4 rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-surface-dark shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-primary text-base">account_balance_wallet</span>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Accounts & Liquidity</h3>
                                        </div>
                                        <Link href="/accounts" className="text-[11px] font-bold text-primary hover:underline">
                                            View all
                                        </Link>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-gray-50/80 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5 mb-3">
                                        <div className="flex justify-between text-[11px] font-semibold mb-1">
                                            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">Assets: {formatAmount(data.accountsSummary.totalAssets, fmt(data.accountsSummary.totalAssets))}</span>
                                            <span className="text-rose-600 dark:text-rose-400 tabular-nums font-mono">Liab: {formatAmount(data.accountsSummary.totalLiabilities, fmt(data.accountsSummary.totalLiabilities))}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden flex">
                                            <div 
                                                className="bg-emerald-500 h-full transition-all duration-700" 
                                                style={{ width: `${(data.accountsSummary.totalAssets / Math.max(1, data.accountsSummary.totalAssets + data.accountsSummary.totalLiabilities)) * 100}%` }} 
                                            />
                                            <div 
                                                className="bg-rose-500 h-full transition-all duration-700" 
                                                style={{ width: `${(data.accountsSummary.totalLiabilities / Math.max(1, data.accountsSummary.totalAssets + data.accountsSummary.totalLiabilities)) * 100}%` }} 
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {data.accountsSummary.accounts.slice(0, 3).map(acc => (
                                            <div key={acc.id} className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50 dark:bg-white/[0.02] text-xs">
                                                <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">{acc.name}</span>
                                                <span className={`font-mono font-bold ${acc.isLiability ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'}`}>
                                                    {formatAmount(acc.balance, fmt(acc.balance))}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }

                        if (widgetId === 'healthScore') {
                            return (
                                <div key={widgetId}>
                                    <HealthScoreWidget compact={true} />
                                </div>
                            );
                        }

                        if (widgetId === 'ai_insight') {
                            return (
                                <div key={widgetId} className="relative glass-panel rounded-2xl p-5 overflow-hidden border border-emerald-100 dark:border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50/50 dark:from-[#12182B] dark:to-emerald-900/10">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 shadow-[0_0_10px_rgb(16,185,129)]" />
                                    <div className="flex items-start gap-3">
                                        <div className="relative shrink-0 mt-0.5">
                                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5">AI Insight</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                                                {data.netSavings > 0
                                                    ? `Great job! You've saved ${formatAmount(data.netSavings, fmt(data.netSavings))} this period. Your safe daily burn allowance is ${formatAmount(data.safeToSpend?.dailySafeAllowance || 0, fmt(data.safeToSpend?.dailySafeAllowance || 0))}/day.`
                                                    : `Heads up — monthly expenses exceed income. Safe-to-spend is strictly capped at liquid reserves minus committed bills.`}
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
                                    <div className="space-y-3">
                                        {data.recentTransactions.length === 0 ? (
                                            <div className="bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/10 rounded-2xl p-8 text-center shadow-inner">
                                                <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <span className="material-symbols-outlined text-2xl text-gray-400 dark:text-gray-500">receipt_long</span>
                                                </div>
                                                <p className="text-sm font-medium text-gray-500 dark:text-text-muted">No transactions yet</p>
                                            </div>
                                        ) : data.recentTransactions.slice(0, 5).map(t => (
                                            <div key={t.id} onClick={() => setSelectedDetailTx(t)} className="relative overflow-visible glass-panel rounded-2xl p-4 flex items-center gap-4 transition-all duration-300 active:scale-[0.98] hover:shadow-md cursor-pointer group">
                                                <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm ${t.type === 'expense' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-emerald-50 dark:bg-emerald-500/10'}`}>
                                                    <span className={`material-symbols-outlined text-lg ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                        {getCategoryIcon(t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase(), customCats)}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate mb-0.5">{t.description || t.category}</p>
                                                    <p className="text-xs font-medium text-gray-400 dark:text-text-muted">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                                </div>
                                                <div className="ml-auto flex shrink-0 items-center gap-1">
                                                    <p className={`text-sm font-bold tabular-nums font-mono ${t.type === 'expense' ? 'text-gray-900 dark:text-white' : 'text-emerald-500'}`}>
                                                        {t.type === 'expense' ? '−' : '+'}{formatAmount(t.amount, fmt(t.amount))}
                                                    </p>
                                                    <span className="material-symbols-outlined text-gray-300 dark:text-gray-600 text-sm">chevron_right</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }

                        if (widgetId === 'upcomingBills') {
                            return (
                                <div key={widgetId}>
                                    <UpcomingBillsWidget />
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
                                            <div key={news.id} className="block p-3 rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50/20 dark:bg-white/[0.02]">
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
                {/* Unified Institutional Command Header */}
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                            {greeting()}{userName ? `, ${userName}` : ''}
                        </h2>
                        <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Unified financial command center and cashflow runway.</p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Month/Period Switcher */}
                        <div className="flex items-center bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 rounded-xl p-1 shadow-sm">
                            <button
                                onClick={handlePrevMonth}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                title="Previous Month"
                            >
                                <span className="material-symbols-outlined text-base leading-none">chevron_left</span>
                            </button>
                            <span className="px-3 text-xs font-bold text-gray-800 dark:text-gray-100 min-w-[130px] text-center">
                                {formattedMonthLabel}
                            </span>
                            <button
                                onClick={handleNextMonth}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                title="Next Month"
                            >
                                <span className="material-symbols-outlined text-base leading-none">chevron_right</span>
                            </button>
                            {!isCurrentMonth && (
                                <button
                                    onClick={handleResetMonth}
                                    className="ml-1 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-md transition-colors"
                                    title="Reset to current month"
                                >
                                    Today
                                </button>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsQuickAddOpen(true)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[16px]">add</span>
                                <span>Add Transaction</span>
                            </button>
                            <button
                                onClick={() => setIsReceiptScannerOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[16px]">document_scanner</span>
                                <span>Scan Receipt</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (layoutData) {
                                        setTempDesktopLayout(layoutData.dashboardLayout);
                                        setTempMobileLayout(layoutData.mobileWidgetOrder);
                                    }
                                    setLayoutTab('desktop');
                                    setIsLayoutOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-all shadow-sm active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[16px]">dashboard_customize</span>
                                <span>Customize</span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Actionable Briefing Strip (Overdue Bills, 85%+ Budget Envelopes, Micro-Savings Sweep) */}
                <UnifiedInsightsHub currencySymbol={sym} budgetAlerts={data.budgetAlerts} />

                {/* KPI Stat Cards (Card 1: Safe-to-Spend, Card 2: Net Worth, Card 3: Monthly Spend & Velocity, Card 4: Net Cashflow & Savings Rate) */}
                {isDesktopSectionVisible('statCards') && (
                    <DashboardStatCards data={data} fmt={fmt} />
                )}

                {/* Month Pacing & Budget Envelopes Section */}
                {isDesktopSectionVisible('monthPacing') && data.spendingPace && (
                    <div className="card-glass relative overflow-hidden p-6 lg:p-7 rounded-3xl mb-8 shadow-xl backdrop-blur-2xl">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20" />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-xl">speed</span>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Monthly Burn Rate & Pacing</h3>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                                    Day {data.spendingPace.dayOfMonth} of {data.spendingPace.daysInMonth} ({data.spendingPace.monthElapsedPercent}% elapsed) • Extrapolated month-end spend: <span className="font-bold text-gray-900 dark:text-white tabular-nums font-mono">{formatAmount(data.spendingPace.projectedMonthEndSpend, fmt(data.spendingPace.projectedMonthEndSpend))}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {data.spendingPace.budgetConsumedPercent <= data.spendingPace.monthElapsedPercent ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        On Track ({Math.abs(Math.round((data.spendingPace.monthElapsedPercent - data.spendingPace.budgetConsumedPercent) * 10) / 10)}% under calendar pace)
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-sm">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        Accelerated Burn ({Math.round((data.spendingPace.budgetConsumedPercent - data.spendingPace.monthElapsedPercent) * 10) / 10}% over calendar pace)
                                    </span>
                                )}
                                <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-lg tabular-nums font-mono border ${
                                    data.spendingPace.paceDeltaPercent <= 0 
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' 
                                        : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                                }`}>
                                    {data.spendingPace.paceDeltaPercent > 0 ? '+' : ''}{data.spendingPace.paceDeltaPercent}% vs same day last month
                                </span>
                            </div>
                        </div>

                        {/* Dual Progress: Month Elapsed vs Budget Consumed */}
                        <div className="space-y-4 mb-6">
                            <div>
                                <div className="flex justify-between text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-primary" />
                                        Calendar Month Elapsed
                                    </span>
                                    <span className="tabular-nums font-mono text-gray-500">{data.spendingPace.dayOfMonth} / {data.spendingPace.daysInMonth} days ({data.spendingPace.monthElapsedPercent}%)</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                                    <div 
                                        className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-700 shadow-sm" 
                                        style={{ width: `${Math.min(100, data.spendingPace.monthElapsedPercent)}%` }} 
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs font-semibold mb-1.5 text-gray-700 dark:text-gray-300">
                                    <span className="flex items-center gap-1.5">
                                        <span className={`w-2 h-2 rounded-full ${data.spendingPace.budgetConsumedPercent > data.spendingPace.monthElapsedPercent ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                        Total Budget Consumed
                                    </span>
                                    <span className="tabular-nums font-mono text-gray-500">
                                        {data.spendingPace.budgetConsumedPercent}% ({formatAmount(data.spendingPace.currentMonthSpendToDate, fmt(data.spendingPace.currentMonthSpendToDate))})
                                    </span>
                                </div>
                                <div className="h-2.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                                            data.spendingPace.budgetConsumedPercent >= 100 
                                                ? 'bg-gradient-to-r from-rose-500 to-rose-600' 
                                                : data.spendingPace.budgetConsumedPercent > data.spendingPace.monthElapsedPercent 
                                                    ? 'bg-gradient-to-r from-amber-400 to-amber-500' 
                                                    : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                        }`} 
                                        style={{ width: `${Math.min(100, data.spendingPace.budgetConsumedPercent)}%` }} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Category Budget Envelopes Progress Strip */}
                        {data.budgetAlerts && data.budgetAlerts.length > 0 && (
                            <div className="pt-4 border-t border-gray-200/70 dark:border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold text-gray-500 dark:text-text-muted uppercase tracking-wider">Top Category Envelopes</h4>
                                    <Link href="/budgets" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                                        Manage Envelopes <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                    </Link>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {data.budgetAlerts.slice(0, 4).map(b => (
                                        <div key={b.category} className="rounded-2xl border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] p-3.5 space-y-2 backdrop-blur-md">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">{b.category}</span>
                                                <span className={`text-[11px] font-bold tabular-nums font-mono ${
                                                    b.percentage >= 100 ? 'text-rose-500' : b.percentage >= 80 ? 'text-amber-500' : 'text-emerald-500'
                                                }`}>
                                                    {b.percentage.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        b.percentage >= 100 ? 'bg-rose-500' : b.percentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                                                    }`} 
                                                    style={{ width: `${Math.min(100, b.percentage)}%` }} 
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] text-gray-400 dark:text-text-muted tabular-nums font-mono">
                                                <span>{formatAmount(b.spent, fmt(b.spent))} spent</span>
                                                <span>{formatAmount(b.limit, fmt(b.limit))}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Accounts & Liquidity Ledger */}
                {isDesktopSectionVisible('accountsLiquidity') && data.accountsSummary && (
                    <div className="card-glass relative overflow-hidden p-6 lg:p-7 rounded-3xl mb-8 shadow-xl backdrop-blur-2xl">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20" />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-xl">account_balance_wallet</span>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Accounts & Liquidity Ledger</h3>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-text-muted mt-0.5">
                                    Net Worth: <span className="font-bold text-gray-900 dark:text-white tabular-nums font-mono">{formatAmount(data.accountsSummary.netWorth, fmt(data.accountsSummary.netWorth))}</span> • {data.accountsSummary.liquidRatio}% held in liquid cash ({formatAmount(data.accountsSummary.liquidCash, fmt(data.accountsSummary.liquidCash))})
                                </p>
                            </div>
                            <Link 
                                href="/accounts" 
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white/70 dark:bg-white/5 text-xs font-bold text-primary hover:bg-primary/10 transition-colors self-start sm:self-auto shadow-sm"
                            >
                                <span>Manage Accounts</span>
                                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </Link>
                        </div>

                        {/* Asset to Liability Bar */}
                        <div className="mb-6 p-4 rounded-2xl bg-gray-50/80 dark:bg-white/[0.02] border border-gray-150 dark:border-white/5">
                            <div className="flex justify-between items-center text-xs font-semibold mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                    <span className="text-gray-700 dark:text-gray-300">Total Assets</span>
                                    <span className="tabular-nums font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                        {formatAmount(data.accountsSummary.totalAssets, fmt(data.accountsSummary.totalAssets))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                    <span className="text-gray-700 dark:text-gray-300">Total Liabilities</span>
                                    <span className="tabular-nums font-mono font-bold text-rose-600 dark:text-rose-400">
                                        {formatAmount(data.accountsSummary.totalLiabilities, fmt(data.accountsSummary.totalLiabilities))}
                                    </span>
                                </div>
                            </div>
                            {data.accountsSummary.totalAssets + data.accountsSummary.totalLiabilities > 0 ? (
                                <div className="h-3 rounded-full bg-gray-200/80 dark:bg-white/10 overflow-hidden flex">
                                    <div 
                                        className="bg-emerald-500 h-full transition-all duration-700" 
                                        style={{ width: `${(data.accountsSummary.totalAssets / (data.accountsSummary.totalAssets + data.accountsSummary.totalLiabilities)) * 100}%` }} 
                                        title={`Assets: ${data.accountsSummary.totalAssets}`}
                                    />
                                    <div 
                                        className="bg-rose-500 h-full transition-all duration-700" 
                                        style={{ width: `${(data.accountsSummary.totalLiabilities / (data.accountsSummary.totalAssets + data.accountsSummary.totalLiabilities)) * 100}%` }} 
                                        title={`Liabilities: ${data.accountsSummary.totalLiabilities}`}
                                    />
                                </div>
                            ) : (
                                <div className="h-3 rounded-full bg-gray-200 dark:bg-white/10" />
                            )}
                        </div>

                        {/* Account rows grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {data.accountsSummary.accounts.length === 0 ? (
                                <p className="text-xs text-gray-500 col-span-full py-4 text-center">No active accounts found.</p>
                            ) : (
                                data.accountsSummary.accounts.map(acc => (
                                    <Link
                                        key={acc.id}
                                        href="/accounts"
                                        className="group flex items-center justify-between p-3.5 rounded-2xl border border-gray-150 dark:border-white/5 bg-white dark:bg-surface-dark hover:border-primary/40 hover:shadow-sm transition-all"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                                acc.isLiability 
                                                    ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' 
                                                    : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10'
                                            }`}>
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {acc.type === 'credit' ? 'credit_card' : acc.type === 'loan' ? 'payments' : 'account_balance'}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">{acc.name}</p>
                                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{acc.type}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-2">
                                            <p className={`text-xs font-bold tabular-nums font-mono ${
                                                acc.isLiability ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'
                                            }`}>
                                                {formatAmount(acc.balance, fmt(acc.balance))}
                                            </p>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Charts & Analytics Row */}
                {isDesktopSectionVisible('cashflowChart') && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
                        {/* Spending Burn Trajectory & Category Breakdown */}
                        <div className="lg:col-span-2 card-glass relative overflow-hidden p-6 lg:p-7 rounded-3xl border border-gray-200/80 dark:border-white/10 shadow-xl backdrop-blur-2xl">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20" />
                            <SpendingChart
                                dailySpending={data.dailySpending}
                                previousMonthDailySpending={data.previousMonthDailySpending || []}
                                categorySpending={data.categorySpending}
                                activeMonth={selectedMonth}
                            />
                        </div>

                        {/* Deterministic 30-Day Liquidity Projection */}
                        <div className="flex flex-col gap-5">
                            {data.dailySpending && data.earnings && (
                                <PredictiveCashflow
                                    dailySpending={data.dailySpending}
                                    monthlyIncome={data.earnings.current}
                                    liquidCash={data.safeToSpend?.liquidCash || data.accountsSummary?.liquidCash || data.balance}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Health Score & Committed Bills Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
                    {isDesktopSectionVisible('healthScore') && (
                        <div className="lg:col-span-2">
                            <HealthScoreWidget />
                        </div>
                    )}

                    {isDesktopSectionVisible('upcomingBills') && (
                        <div className="h-full">
                            <UpcomingBillsWidget />
                        </div>
                    )}
                </div>

                {/* Unified Activity Heatmap (Month Grid & 12-Month Activity) */}
                <UnifiedHeatmapCard
                    year={parseInt(selectedMonth.split('-')[0], 10)}
                    month={parseInt(selectedMonth.split('-')[1], 10)}
                    dailySpending={data.dailySpending || []}
                />

                {/* Final Row: Recent Transactions & Financial Intelligence Hub */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
                    {/* Recent Transactions */}
                    {isDesktopSectionVisible('recent_activity') && (
                        <div className="lg:col-span-2 card-glass relative overflow-hidden rounded-3xl shadow-xl backdrop-blur-2xl">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/20" />
                            <div className="p-6 border-b border-gray-200/80 dark:border-white/10 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Transactions</h3>
                                <Link href="/transactions" className="text-primary text-sm font-semibold hover:underline flex items-center gap-1">
                                    All transactions <span className="material-symbols-outlined text-base">arrow_forward</span>
                                </Link>
                            </div>
                            <div className="overflow-visible">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50/80 dark:bg-surface-dark/50 text-xs text-gray-500 dark:text-text-muted uppercase tracking-wider">
                                            <th className="px-4 lg:px-6 py-3.5 font-semibold">Transaction</th>
                                            <th className="px-4 lg:px-6 py-3.5 font-semibold hidden md:table-cell">Category</th>
                                            <th className="px-4 lg:px-6 py-3.5 font-semibold hidden sm:table-cell">Date</th>
                                            <th className="px-4 lg:px-6 py-3.5 font-semibold text-right">Amount</th>
                                            <th className="px-4 lg:px-6 py-3.5 font-semibold text-right w-12">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-sm">
                                        {data.recentTransactions.length === 0 ? (
                                            <tr><td colSpan={5} className="px-6 py-12 text-center">
                                                <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 block mb-2">receipt_long</span>
                                                <p className="text-gray-400 dark:text-text-muted">No transactions found for this period.</p>
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
                                                    <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-100 dark:bg-surface-hover text-gray-600 dark:text-text-muted">
                                                        {t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase()}
                                                    </span>
                                                </td>
                                                <td className="px-4 lg:px-6 py-4 text-gray-500 dark:text-text-muted hidden sm:table-cell">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                                <td className={`px-4 lg:px-6 py-4 text-right font-semibold tabular-nums font-mono ${t.type === 'expense' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                    {t.type === 'expense' ? '-' : '+'}{formatAmount(t.amount, fmt(t.amount))}
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
                    )}

                    {/* Financial Intelligence Hub */}
                    {isDesktopSectionVisible('intel_hub') && (
                        <div className="flex flex-col gap-5">
                            <DashboardIntelHub
                                currency={currency}
                                exchangeRates={exchangeRates}
                                marketNews={marketNews}
                                fmt={fmt}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                calcAmount={calcAmount}
                                setCalcAmount={setCalcAmount}
                                calcYears={calcYears}
                                setCalcYears={setCalcYears}
                                calcRate={calcRate}
                                setCalcRate={setCalcRate}
                            />
                        </div>
                    )}
                </div>

                {/* Floating AI Button */}
                <a href="/chat" className="hidden lg:flex fixed bottom-8 right-8 bg-primary text-white rounded-2xl p-4 btn-primary-glow items-center gap-2 group z-50 animate-bounce-in shadow-lg">
                    <span className="material-symbols-outlined text-2xl group-hover:rotate-12 transition-transform duration-300">smart_toy</span>
                    <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold text-sm">Talk to AI</span>
                </a>
            </div>

            {/* Quick Add Transaction Modal */}
            {mounted && (
                <QuickAddTransactionModal
                    isOpen={isQuickAddOpen}
                    onClose={() => setIsQuickAddOpen(false)}
                />
            )}

            {/* Receipt Scanner Modal */}
            {mounted && (
                <ReceiptScannerModal
                    isOpen={isReceiptScannerOpen}
                    onClose={() => setIsReceiptScannerOpen(false)}
                />
            )}

            {/* Edit Transaction Modal */}
            {mounted && createPortal(
                <AnimatePresence>
                    {editingTx && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[6px]" onClick={() => { setEditingTx(null); setEditSubmitting(false); }}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                                transition={{ duration: 0.2 }}
                                className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#12182B]/95"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/10 px-5 py-4">
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
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
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
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-text-muted">Category</label>
                                            <select
                                                value={editingTx.category}
                                                onChange={(event) => setEditingTx({ ...editingTx, category: event.target.value })}
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
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
                                                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
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
                                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-1">
                                        <button type="button" onClick={() => { setEditingTx(null); setEditSubmitting(false); }} className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:border dark:border-white/10 transition-colors">
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

            {/* Delete Transaction Modal */}
            {mounted && createPortal(
                <AnimatePresence>
                    {deletingTxId && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: 18 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 18 }}
                                className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#12182B]/95"
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
                    }}
                    onDelete={(tx) => {
                        setSelectedDetailTx(null);
                        setDeletingTxId(tx.id);
                    }}
                    onNotesChange={() => {}}
                />
            )}

            {/* Layout Customization Modal */}
            {mounted && (
                <DashboardLayoutModal
                    isOpen={isLayoutOpen}
                    onClose={() => setIsLayoutOpen(false)}
                    layoutTab={layoutTab}
                    setLayoutTab={setLayoutTab}
                    tempDesktopLayout={tempDesktopLayout}
                    tempMobileLayout={tempMobileLayout}
                    handleMoveDesktop={handleMoveDesktop}
                    handleMoveMobile={handleMoveMobile}
                    handleToggleDesktop={handleToggleDesktop}
                    handleToggleMobile={handleToggleMobile}
                    handleDragStart={handleDragStart}
                    handleDragOver={handleDragOver}
                    handleDrop={handleDrop}
                    saveLayout={saveLayout}
                    layoutSubmitting={layoutSubmitting}
                />
            )}

            {/* First-Run 60-Second Setup Wizard */}
            {showOnboardingWizard && (
                <FirstRunWizard
                    onComplete={handleOnboardingComplete}
                    onSkip={() => setShowOnboardingWizard(false)}
                />
            )}
        </div>
    );
}
