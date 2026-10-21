'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { useLanguage } from '@/contexts/LanguageContext';
import { resolveIcon, resolveColor, getCategoryIcon } from '@/lib/categoryUtils';
import { motion, AnimatePresence } from 'framer-motion';

interface BudgetEnvelope {
  id: number;
  category: string;
  monthlyLimit: number;
  month: number;
  year: number;
  spent: number;
  percentage: number;
  rolloverEnabled: boolean;
  rolloverBalance: number;
  effectiveLimit: number;
  remaining: number;
  idealDailyBurn: number;
  actualDailyBurn: number;
  pacingStatus: 'on_track' | 'pacing_fast' | 'exhausted';
  pacingDeltaPercent: number;
  projectedMonthEndSpend: number;
  daysRemaining: number;
}

interface CustomBudgetCategory {
  id?: number;
  name: string;
  icon: string;
  color: string;
}

const STANDARD_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Health',
  'Education',
  'Business',
  'Other',
];

const CATEGORY_COLOR_STYLES: Record<string, { icon: string; iconBg: string; text: string; bar: string }> = {
  orange: { icon: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-500', bar: 'bg-orange-500' },
  cyan: { icon: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-500', bar: 'bg-cyan-500' },
  blue: { icon: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-500', bar: 'bg-blue-500' },
  yellow: { icon: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-500', bar: 'bg-amber-500' },
  pink: { icon: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-500', bar: 'bg-rose-500' },
  indigo: { icon: 'text-primary dark:text-[#38bdf8]', iconBg: 'bg-primary/10', text: 'text-primary dark:text-[#38bdf8]', bar: 'bg-primary' },
  emerald: { icon: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-500', bar: 'bg-emerald-500' },
  sky: { icon: 'text-sky-600 dark:text-sky-400', iconBg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-500', bar: 'bg-sky-500' },
  rose: { icon: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-500', bar: 'bg-rose-500' },
  amber: { icon: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-500', bar: 'bg-amber-500' },
  teal: { icon: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-500', bar: 'bg-teal-500' },
  gray: { icon: 'text-gray-600 dark:text-gray-400', iconBg: 'bg-gray-50 dark:bg-gray-500/10', text: 'text-gray-500', bar: 'bg-gray-500' },
  primary: { icon: 'text-primary dark:text-[#38bdf8]', iconBg: 'bg-primary/10', text: 'text-primary dark:text-[#38bdf8]', bar: 'bg-primary' },
};

const getColorStyles = (color: string) => CATEGORY_COLOR_STYLES[color] || CATEGORY_COLOR_STYLES.gray;

export default function BudgetPage() {
  const { fmt } = useCurrency();
  const { t } = useLanguage();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const [budgets, setBudgets] = useState<BudgetEnvelope[]>([]);
  const [customCategories, setCustomCategories] = useState<CustomBudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [editTarget, setEditTarget] = useState<BudgetEnvelope | null>(null);

  // Add/Edit Form State
  const [selectedCategory, setSelectedCategory] = useState('Food');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newCustomCategoryName, setNewCustomCategoryName] = useState('');
  const [monthlyLimitInput, setMonthlyLimitInput] = useState('');
  const [rolloverEnabledInput, setRolloverEnabledInput] = useState(true);
  const [savingBudget, setSavingBudget] = useState(false);

  // Rebalance Form State
  const [fromBudgetId, setFromBudgetId] = useState<number | null>(null);
  const [toBudgetId, setToBudgetId] = useState<number | null>(null);
  const [rebalanceAmount, setRebalanceAmount] = useState<string>('');
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<'all' | 'on_track' | 'pacing_fast' | 'exhausted'>('all');

  useEffect(() => {
    let cancelled = false;

    async function loadBudgets() {
      setLoading(true);
      try {
        const [catRes, budRes] = await Promise.all([
          fetch('/api/categories?type=expense'),
          fetch(`/api/budgets?month=${selectedMonth}&year=${selectedYear}`),
        ]);
        const [catData, budData] = await Promise.all([catRes.json(), budRes.json()]);

        if (cancelled) return;
        setCustomCategories(catData.categories || []);
        setBudgets(budData.budgets || []);
      } catch (err) {
        console.error('Failed to load budgets', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBudgets();

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, selectedYear, reloadToken]);

  const monthName = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth - 1, 1);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [selectedMonth, selectedYear]);

  const mergedCategories = useMemo(
    () => [...STANDARD_CATEGORIES, ...customCategories.map((c) => c.name)],
    [customCategories]
  );

  const availableCategories = useMemo(
    () => mergedCategories.filter((c) => !budgets.find((b) => b.category === c)),
    [budgets, mergedCategories]
  );

  const totalAllocated = useMemo(() => budgets.reduce((sum, b) => sum + (b.monthlyLimit || 0), 0), [budgets]);
  const totalRollover = useMemo(() => budgets.reduce((sum, b) => sum + (b.rolloverBalance || 0), 0), [budgets]);
  const totalEffectiveLimit = useMemo(() => budgets.reduce((sum, b) => sum + (b.effectiveLimit || b.monthlyLimit || 0), 0), [budgets]);
  const totalSpent = useMemo(() => budgets.reduce((sum, b) => sum + (b.spent || 0), 0), [budgets]);
  const totalRemaining = useMemo(() => Math.max(0, totalEffectiveLimit - totalSpent), [totalEffectiveLimit, totalSpent]);

  // Overspending and fast pacing alerts
  const overspentEnvelopes = useMemo(() => budgets.filter((b) => b.pacingStatus === 'exhausted'), [budgets]);
  const pacingFastEnvelopes = useMemo(() => budgets.filter((b) => b.pacingStatus === 'pacing_fast'), [budgets]);
  const alertedCount = overspentEnvelopes.length + pacingFastEnvelopes.length;

  const filteredBudgets = useMemo(() => {
    if (statusFilter === 'all') return budgets;
    return budgets.filter((b) => b.pacingStatus === statusFilter);
  }, [budgets, statusFilter]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleCurrentMonth = () => {
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };

  // Toggle Rollover
  const handleToggleRollover = async (budget: BudgetEnvelope) => {
    const nextVal = !budget.rolloverEnabled;
    // Optimistic update
    setBudgets((prev) =>
      prev.map((b) =>
        b.id === budget.id
          ? {
              ...b,
              rolloverEnabled: nextVal,
              effectiveLimit: nextVal ? b.monthlyLimit + (b.rolloverBalance || 0) : b.monthlyLimit,
              remaining: Math.max(0, (nextVal ? b.monthlyLimit + (b.rolloverBalance || 0) : b.monthlyLimit) - b.spent),
            }
          : b
      )
    );

    try {
      await fetch('/api/budgets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: budget.id,
          rolloverEnabled: nextVal,
        }),
      });
    } catch (err) {
      console.error('Failed to toggle rollover', err);
      setReloadToken((t) => t + 1);
    }
  };

  // Open Rebalance Modal with pre-selections
  const openRebalanceModal = (targetBudgetId?: number) => {
    // Select a source that has surplus
    const surplusBudgets = budgets.filter((b) => b.remaining > 0);
    const defaultSource = surplusBudgets[0]?.id || null;
    setFromBudgetId(defaultSource);

    if (targetBudgetId) {
      setToBudgetId(targetBudgetId);
    } else {
      // Pick first overspent or different budget
      const defaultTarget = budgets.find((b) => b.id !== defaultSource)?.id || null;
      setToBudgetId(defaultTarget);
    }

    setRebalanceAmount('');
    setRebalanceError(null);
    setShowRebalanceModal(true);
  };

  // Execute Category Rebalance
  const handleExecuteRebalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromBudgetId || !toBudgetId || !rebalanceAmount) return;

    const amountNum = parseFloat(rebalanceAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setRebalanceError('Please enter a valid transfer amount.');
      return;
    }

    const sourceEnvelope = budgets.find((b) => b.id === fromBudgetId);
    if (sourceEnvelope && sourceEnvelope.monthlyLimit < amountNum) {
      setRebalanceError(`Insufficient base allocation in ${sourceEnvelope.category}. Max transferable is ${fmt(sourceEnvelope.monthlyLimit)}.`);
      return;
    }

    setIsRebalancing(true);
    setRebalanceError(null);

    try {
      const res = await fetch('/api/budgets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rebalance',
          fromBudgetId,
          toBudgetId,
          amount: amountNum,
          month: selectedMonth,
          year: selectedYear,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to rebalance categories.');
      }

      setShowRebalanceModal(false);
      setReloadToken((t) => t + 1);
    } catch (err: any) {
      setRebalanceError(err?.message || 'Error executing rebalance.');
    } finally {
      setIsRebalancing(false);
    }
  };

  // Save / Add Budget
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthlyLimitInput) return;

    let targetCat = selectedCategory;
    if (isAddingCustom && newCustomCategoryName.trim()) {
      targetCat = newCustomCategoryName.trim();
      try {
        const smartIcon = resolveIcon(targetCat);
        const smartColor = resolveColor(targetCat);
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: targetCat, type: 'expense', icon: smartIcon, color: smartColor }),
        });
      } catch {}
    }

    if (!targetCat) return;

    setSavingBudget(true);
    try {
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: targetCat,
          monthlyLimit: parseFloat(monthlyLimitInput),
          month: selectedMonth,
          year: selectedYear,
          rolloverEnabled: rolloverEnabledInput,
        }),
      });

      setShowAddModal(false);
      setEditTarget(null);
      setMonthlyLimitInput('');
      setNewCustomCategoryName('');
      setIsAddingCustom(false);
      setReloadToken((t) => t + 1);
    } catch (err) {
      console.error('Failed to save budget', err);
    } finally {
      setSavingBudget(false);
    }
  };

  // Delete Budget
  const handleDeleteBudget = async (id: number) => {
    if (!confirm('Are you sure you want to remove this budget envelope?')) return;
    try {
      await fetch(`/api/budgets?id=${id}`, { method: 'DELETE' });
      setReloadToken((t) => t + 1);
    } catch (err) {
      console.error('Failed to delete budget', err);
    }
  };

  const selectedSourceEnvelope = useMemo(() => budgets.find((b) => b.id === fromBudgetId), [budgets, fromBudgetId]);
  const selectedTargetEnvelope = useMemo(() => budgets.find((b) => b.id === toBudgetId), [budgets, toBudgetId]);
  const parsedTransferAmount = parseFloat(rebalanceAmount) || 0;

  return (
    <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
      {/* Month Navigation & Controls */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary dark:text-[#38bdf8] text-xs font-bold uppercase tracking-wider mb-2">
            <span className="material-symbols-outlined text-[16px]">mail</span>
            Zero-Based Envelope System
          </div>
          <h1 className="text-2xl lg:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            {t('budgetsPage.title')}
          </h1>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">
            {t('budgetsPage.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Stepper */}
          <div className="flex items-center bg-white dark:bg-surface-dark border border-gray-200 dark:border-white/10 rounded-xl p-1 shadow-sm">
            <button
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <button
              onClick={handleCurrentMonth}
              className="px-3 py-1 text-sm font-bold text-gray-900 dark:text-white hover:text-primary transition-colors"
              title="Jump to current month"
            >
              {monthName}
            </button>
            <button
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </div>

          {/* Quick Rebalance Button */}
          <button
            onClick={() => openRebalanceModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">balance</span>
            {t('budgetsPage.rebalanceCategories')}
          </button>

          {/* Add Envelope Button */}
          <button
            onClick={() => {
              setEditTarget(null);
              setMonthlyLimitInput('');
              setSelectedCategory(availableCategories[0] || 'Food');
              setRolloverEnabledInput(true);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 shadow-md shadow-primary/25"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('budgetsPage.createBudget')}
          </button>
        </div>
      </div>

      {/* Proactive Overspending Alert Banner */}
      {alertedCount > 0 && (
        <div className="glass-panel border-amber-500/30 bg-amber-500/5 rounded-2xl p-4 lg:p-5 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-base">
                {t('budgetsPage.overspendingAlertTitle')} ({alertedCount})
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {overspentEnvelopes.length > 0 && `${overspentEnvelopes.length} exhausted envelope(s)`}
                {overspentEnvelopes.length > 0 && pacingFastEnvelopes.length > 0 && ' and '}
                {pacingFastEnvelopes.length > 0 && `${pacingFastEnvelopes.length} pacing fast`}.{' '}
                {t('budgetsPage.overspendingAlertDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => openRebalanceModal(overspentEnvelopes[0]?.id || pacingFastEnvelopes[0]?.id)}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm shrink-0"
          >
            {t('budgetsPage.rebalanceNow')}
          </button>
        </div>
      )}

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card-glass relative overflow-hidden rounded-2xl p-6 border border-white/[0.08] dark:border-white/[0.08] hover-lift group shadow-lg">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-all" />
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <span className="material-symbols-outlined text-primary bg-primary/10 border border-primary/20 p-2.5 rounded-xl text-[20px]">
              account_balance_wallet
            </span>
            <p className="text-gray-500 dark:text-text-muted text-xs font-bold uppercase tracking-wider">
              {t('budgetsPage.totalAllocated')}
            </p>
          </div>
          <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight tabular-nums font-mono relative z-10">
            {fmt(totalAllocated)}
          </h3>
          <p className="text-xs text-gray-400 mt-1 relative z-10">Base monthly allocated budget</p>
        </div>

        <div className="card-glass relative overflow-hidden rounded-2xl p-6 border border-white/[0.08] dark:border-white/[0.08] hover-lift group shadow-lg">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-all" />
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-[20px]">
              history_toggle_off
            </span>
            <p className="text-gray-500 dark:text-text-muted text-xs font-bold uppercase tracking-wider">
              {t('budgetsPage.rolloverCarried')}
            </p>
          </div>
          <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums font-mono relative z-10">
            +{fmt(totalRollover)}
          </h3>
          <p className="text-xs text-gray-400 mt-1 relative z-10">Surplus unspent from prior cycle</p>
        </div>

        <div className="card-glass relative overflow-hidden rounded-2xl p-6 border border-white/[0.08] dark:border-white/[0.08] hover-lift group shadow-lg">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full bg-rose-500/10 blur-2xl group-hover:bg-rose-500/20 transition-all" />
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl text-[20px]">
              shopping_cart_checkout
            </span>
            <p className="text-gray-500 dark:text-text-muted text-xs font-bold uppercase tracking-wider">
              {t('budgetsPage.totalSpent')}
            </p>
          </div>
          <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight tabular-nums font-mono relative z-10">
            {fmt(totalSpent)}
          </h3>
          <p className="text-xs text-gray-400 mt-1 relative z-10">
            {totalEffectiveLimit > 0 ? `${((totalSpent / totalEffectiveLimit) * 100).toFixed(0)}% consumed` : '0% consumed'}
          </p>
        </div>

        <div className="card-glass relative overflow-hidden rounded-2xl p-6 border border-white/[0.08] dark:border-white/[0.08] hover-lift group shadow-lg">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full bg-teal-500/10 blur-2xl group-hover:bg-teal-500/20 transition-all" />
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-500/20 p-2.5 rounded-xl text-[20px]">
              savings
            </span>
            <p className="text-gray-500 dark:text-text-muted text-xs font-bold uppercase tracking-wider">
              {t('budgetsPage.totalRemaining')}
            </p>
          </div>
          <h3 className="text-3xl font-black text-teal-600 dark:text-teal-400 tracking-tight tabular-nums font-mono relative z-10">
            {fmt(totalRemaining)}
          </h3>
          <p className="text-xs text-gray-400 mt-1 relative z-10">Available in active envelopes</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex card-glass p-1 rounded-xl border border-white/[0.08] dark:border-white/[0.08] w-fit">
          {[
            { id: 'all', label: 'All Envelopes', count: budgets.length },
            { id: 'on_track', label: 'On Track', count: budgets.filter((b) => b.pacingStatus === 'on_track').length },
            { id: 'pacing_fast', label: 'Pacing Fast', count: pacingFastEnvelopes.length },
            { id: 'exhausted', label: 'Exhausted', count: overspentEnvelopes.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                statusFilter === tab.id
                  ? 'bg-primary/20 text-primary dark:text-[#38bdf8] border border-primary/30 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span>{tab.label}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Envelope Cards Grid */}
      {loading ? (
        <div className="p-16 text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <div className="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Synchronizing envelope balances and burn pace...</p>
        </div>
      ) : filteredBudgets.length === 0 ? (
        <div className="card-glass rounded-2xl p-16 text-center border border-white/[0.08]">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
            account_balance_wallet
          </span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {t('budgetsPage.emptyTitle')}
          </h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm mb-6">
            {t('budgetsPage.emptyDesc')}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold shadow-md shadow-primary/25"
          >
            {t('budgetsPage.emptyAction')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBudgets.map((b) => {
            const catColor = resolveColor(b.category);
            const catIcon = getCategoryIcon(b.category, customCategories);
            const style = getColorStyles(catColor);

            const effectiveLimit = b.effectiveLimit || b.monthlyLimit;
            const pct = effectiveLimit > 0 ? (b.spent / effectiveLimit) * 100 : 0;
            const remaining = Math.max(0, effectiveLimit - b.spent);

            // Progress bar gradient based on status
            let barGradient = 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]';
            if (pct >= 100) barGradient = 'bg-gradient-to-r from-rose-500 to-red-500 shadow-[0_0_12px_rgba(244,63,94,0.35)]';
            else if (pct >= 80 || b.pacingStatus === 'pacing_fast') barGradient = 'bg-gradient-to-r from-amber-500 to-orange-400 shadow-[0_0_12px_rgba(245,158,11,0.35)]';

            return (
              <div
                key={b.id}
                className="card-glass relative overflow-hidden rounded-2xl p-6 border border-white/[0.08] dark:border-white/[0.08] hover:border-primary/40 hover-lift transition-all flex flex-col justify-between group shadow-lg"
              >
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                <div>
                  {/* Category Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 flex items-center justify-center rounded-xl ${style.iconBg} ${style.icon} group-hover:scale-105 transition-transform border border-white/5`}>
                        <span className="material-symbols-outlined text-[22px]">{catIcon}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-base">
                          {b.category}
                        </h3>
                        {b.rolloverEnabled && b.rolloverBalance > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="material-symbols-outlined text-[13px]">add_circle</span>
                            +{fmt(b.rolloverBalance)} {t('budgetsPage.rolloverCarried')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Auto-Pacing Badge */}
                    <div>
                      {b.pacingStatus === 'exhausted' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <span className="material-symbols-outlined text-[14px]">error</span>
                          {t('budgetsPage.exhausted')}
                        </span>
                      )}
                      {b.pacingStatus === 'pacing_fast' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <span className="material-symbols-outlined text-[14px]">speed</span>
                          {t('budgetsPage.pacingFast')}
                          {b.pacingDeltaPercent ? ` (+${b.pacingDeltaPercent}%)` : ''}
                        </span>
                      )}
                      {b.pacingStatus === 'on_track' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          {t('budgetsPage.onTrack')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amounts Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4 p-3.5 rounded-xl bg-black/20 dark:bg-black/30 border border-white/5 backdrop-blur-sm">
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                        {t('budgetsPage.spentSoFar')}
                      </p>
                      <p className="text-base font-black text-gray-900 dark:text-white tabular-nums font-mono">
                        {fmt(b.spent)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                        {t('budgetsPage.remaining')}
                      </p>
                      <p className={`text-base font-black tabular-nums font-mono ${remaining === 0 ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {fmt(remaining)}
                      </p>
                    </div>
                  </div>

                  {/* Visual Progress Bar with Glow */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-gray-500 dark:text-text-muted">
                        Cap: {fmt(effectiveLimit)}
                      </span>
                      <span className={pct >= 100 ? 'text-rose-500 font-bold' : 'text-gray-400'}>
                        {pct.toFixed(0)}% Utilized
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/40 border border-white/5 overflow-hidden p-[1px]">
                      <div
                        className={`h-full ${barGradient} rounded-full transition-all duration-700 ease-out`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Burn Pace Analysis */}
                  <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-4 px-1">
                    <span>
                      Ideal: <strong className="text-gray-700 dark:text-gray-300 font-mono">{fmt(b.idealDailyBurn || 0)}/d</strong>
                    </span>
                    <span>
                      Actual: <strong className={`font-mono ${(b.actualDailyBurn || 0) > (b.idealDailyBurn || 0) ? 'text-amber-500' : 'text-emerald-500'}`}>{fmt(b.actualDailyBurn || 0)}/d</strong>
                    </span>
                    <span>{b.daysRemaining ?? 0} days left</span>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                  {/* Rollover Toggle */}
                  <button
                    onClick={() => handleToggleRollover(b)}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                    title={t('budgetsPage.rolloverTooltip')}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${b.rolloverEnabled ? 'text-emerald-500' : 'text-gray-400'}`}>
                      {b.rolloverEnabled ? 'check_box' : 'check_box_outline_blank'}
                    </span>
                    <span className="font-medium">Rollover Surplus</span>
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openRebalanceModal(b.id)}
                      className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                      title="Rebalance this envelope"
                    >
                      <span className="material-symbols-outlined text-[18px]">balance</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditTarget(b);
                        setSelectedCategory(b.category);
                        setMonthlyLimitInput(b.monthlyLimit.toString());
                        setRolloverEnabledInput(b.rolloverEnabled);
                        setShowAddModal(true);
                      }}
                      className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Edit monthly allocation"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(b.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete envelope"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ONE-CLICK REBALANCE MODAL */}
      <AnimatePresence>
        {showRebalanceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="card-glass-elevated relative overflow-hidden bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 lg:p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">balance</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {t('budgetsPage.rebalanceModalTitle')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-text-muted">
                      {monthName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRebalanceModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                {t('budgetsPage.rebalanceModalDesc')}
              </p>

              {rebalanceError && (
                <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  {rebalanceError}
                </div>
              )}

              <form onSubmit={handleExecuteRebalance} className="space-y-4">
                {/* Source Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t('budgetsPage.fromEnvelope')}
                  </label>
                  <select
                    value={fromBudgetId || ''}
                    onChange={(e) => setFromBudgetId(Number(e.target.value))}
                    required
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-amber-500 text-gray-900 dark:text-white"
                  >
                    <option value="" disabled>Select surplus source...</option>
                    {budgets.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.id === toBudgetId}>
                        {b.category} (Limit: {fmt(b.monthlyLimit)} • Remaining: {fmt(b.remaining)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t('budgetsPage.toEnvelope')}
                  </label>
                  <select
                    value={toBudgetId || ''}
                    onChange={(e) => setToBudgetId(Number(e.target.value))}
                    required
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-amber-500 text-gray-900 dark:text-white"
                  >
                    <option value="" disabled>Select needy destination...</option>
                    {budgets.map((b) => (
                      <option key={b.id} value={b.id} disabled={b.id === fromBudgetId}>
                        {b.category} (Limit: {fmt(b.monthlyLimit)} • {b.pacingStatus.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Transfer Amount */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {t('budgetsPage.transferAmount')}
                    </label>
                    {selectedSourceEnvelope && (
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                        Max Surplus: {fmt(selectedSourceEnvelope.monthlyLimit)}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={selectedSourceEnvelope ? selectedSourceEnvelope.monthlyLimit : undefined}
                    value={rebalanceAmount}
                    onChange={(e) => setRebalanceAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-amber-500 text-gray-900 dark:text-white tabular-nums font-mono font-bold"
                  />

                  {/* Quick percentage chips */}
                  {selectedSourceEnvelope && (
                    <div className="flex gap-2 mt-2">
                      {[
                        { label: '25%', factor: 0.25 },
                        { label: '50%', factor: 0.5 },
                        { label: 'Max (100%)', factor: 1.0 },
                      ].map((chip) => {
                        const targetAmt = Math.min(
                          selectedSourceEnvelope.monthlyLimit,
                          Math.round(selectedSourceEnvelope.remaining * chip.factor * 100) / 100
                        );
                        return (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => setRebalanceAmount(targetAmt.toString())}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-amber-500/10 hover:text-amber-500 transition-colors text-gray-600 dark:text-gray-300"
                          >
                            {chip.label} ({fmt(targetAmt)})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Live Equation Preview */}
                {selectedSourceEnvelope && selectedTargetEnvelope && parsedTransferAmount > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs space-y-2">
                    <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 font-medium">
                      <span>{selectedSourceEnvelope.category}:</span>
                      <span className="tabular-nums font-mono">
                        {fmt(selectedSourceEnvelope.monthlyLimit)} →{' '}
                        <strong className="text-amber-600 dark:text-amber-400">
                          {fmt(Math.max(0, selectedSourceEnvelope.monthlyLimit - parsedTransferAmount))}
                        </strong>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-gray-700 dark:text-gray-300 font-medium">
                      <span>{selectedTargetEnvelope.category}:</span>
                      <span className="tabular-nums font-mono">
                        {fmt(selectedTargetEnvelope.monthlyLimit)} →{' '}
                        <strong className="text-emerald-600 dark:text-emerald-400">
                          {fmt(selectedTargetEnvelope.monthlyLimit + parsedTransferAmount)}
                        </strong>
                      </span>
                    </div>
                    <div className="pt-2 border-t border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">verified</span>
                      {t('budgetsPage.zeroBasedInvariant')} ({fmt(totalAllocated)})
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowRebalanceModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRebalancing || !fromBudgetId || !toBudgetId || parsedTransferAmount <= 0}
                    className="flex-1 py-3 px-4 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    {isRebalancing ? 'Rebalancing...' : t('budgetsPage.confirmRebalance')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD / EDIT BUDGET MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="card-glass-elevated relative overflow-hidden bg-white/95 dark:bg-[#12182B]/95 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 lg:p-8 w-full max-w-md shadow-2xl"
            >
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">category</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {editTarget ? t('budgetsPage.editAllocation') : t('budgetsPage.createBudget')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-text-muted">
                      {monthName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveBudget} className="space-y-4">
                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Category
                  </label>
                  {editTarget ? (
                    <div className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-bold">
                      {editTarget.category}
                    </div>
                  ) : isAddingCustom ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-surface-dark focus-within:border-primary">
                      <input
                        type="text"
                        placeholder="Enter custom category name..."
                        value={newCustomCategoryName}
                        onChange={(e) => setNewCustomCategoryName(e.target.value)}
                        className="bg-transparent border-none outline-none text-gray-900 dark:text-white text-sm w-full"
                        autoFocus
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustom(false);
                          setNewCustomCategoryName('');
                        }}
                        className="text-gray-400 hover:text-rose-500"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  ) : (
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        if (e.target.value === '___ADD_CUSTOM___') {
                          setIsAddingCustom(true);
                          setSelectedCategory('');
                        } else {
                          setSelectedCategory(e.target.value);
                        }
                      }}
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary text-gray-900 dark:text-white"
                    >
                      <option value="" disabled>Select category...</option>
                      <optgroup label="Standard Categories">
                        {STANDARD_CATEGORIES.filter((c) => !budgets.find((b) => b.category === c)).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </optgroup>
                      {customCategories.length > 0 && (
                        <optgroup label="Custom Categories">
                          {customCategories.filter((c) => !budgets.find((b) => b.category === c.name)).map((c) => (
                            <option key={`cc-${c.id}`} value={c.name}>{c.name}</option>
                          ))}
                        </optgroup>
                      )}
                      <option value="___ADD_CUSTOM___" className="text-primary font-bold">
                        + Add Custom Category
                      </option>
                    </select>
                  )}
                </div>

                {/* Monthly Limit */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t('budgetsPage.totalBudget')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={monthlyLimitInput}
                    onChange={(e) => setMonthlyLimitInput(e.target.value)}
                    placeholder="e.g. 500"
                    required
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-primary text-gray-900 dark:text-white tabular-nums font-mono font-bold"
                  />
                </div>

                {/* Rollover Toggle */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {t('budgetsPage.rolloverEnabled')}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {t('budgetsPage.rolloverTooltip')}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={rolloverEnabledInput}
                    onChange={(e) => setRolloverEnabledInput(e.target.checked)}
                    className="w-5 h-5 accent-primary rounded cursor-pointer"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingBudget || !monthlyLimitInput}
                    className="flex-1 py-3 px-4 rounded-xl font-bold bg-primary hover:bg-primary-hover text-white transition-colors shadow-lg shadow-primary/25 disabled:opacity-50"
                  >
                    {savingBudget ? 'Saving...' : 'Save Envelope'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
