'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useLanguage } from '@/contexts/LanguageContext';

export interface SubscriptionItem {
  id: number;
  name: string;
  amount: number;
  currency: string;
  billingCycle: 'weekly' | 'monthly' | 'yearly';
  nextRenewalDate: string;
  category: string;
  logoUrl?: string | null;
  isActive: number;
  trialEndsAt?: string | null;
  previousAmount?: number | null;
  accountId?: number | null;
  cancelReminderDays?: number;
  daysUntilRenewal?: number;
  trialCountdownDays?: number | null;
  monthlyNormalizedAmount?: number;
  annualNormalizedAmount?: number;
  priceHikeAlert?: {
    detected: boolean;
    previousAmount: number;
    currentAmount: number;
    delta: number;
    percentageIncrease: number;
    lastChargedDate?: string;
  };
}

interface AccountItem {
  id: number;
  name: string;
  type: string;
  colorTag?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function SubscriptionsContent() {
  const { currency, fmtRaw, convert, fmt } = useCurrency();
  const { t } = useLanguage();

  const { data, mutate, isLoading } = useSWR<{ subscriptions: SubscriptionItem[] }>(
    '/api/subscriptions',
    fetcher
  );

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .catch(() => {});
  }, []);

  // View state: Monthly vs Annual cost projection
  const [costView, setCostView] = useState<'monthly' | 'annual'>('monthly');

  // Filter state
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'price_hikes' | 'trials'>('all');

  // Selected date on 30-day calendar
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMode, setEditMode] = useState<SubscriptionItem | null>(null);
  const [accountUpdateTarget, setAccountUpdateTarget] = useState<SubscriptionItem | null>(null);
  const [reminderTarget, setReminderTarget] = useState<SubscriptionItem | null>(null);
  const [reminderDaysInput, setReminderDaysInput] = useState('3');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [subCurrency, setSubCurrency] = useState(currency);
  const [billingCycle, setBillingCycle] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [nextRenewal, setNextRenewal] = useState('');
  const [category, setCategory] = useState('Entertainment');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [cancelReminderDays, setCancelReminderDays] = useState('3');
  const [formAccountId, setFormAccountId] = useState<number | null>(null);

  const subs = useMemo(() => data?.subscriptions || [], [data]);

  // Price hikes count
  const priceHikeCount = useMemo(
    () => subs.filter((s) => s.priceHikeAlert?.detected).length,
    [subs]
  );

  // Active free trials count
  const activeTrialsCount = useMemo(
    () => subs.filter((s) => s.trialCountdownDays !== null && (s.trialCountdownDays ?? 0) >= 0).length,
    [subs]
  );

  // Filtered subs
  const filteredSubs = useMemo(() => {
    if (filterMode === 'active') return subs.filter((s) => s.isActive);
    if (filterMode === 'price_hikes') return subs.filter((s) => s.priceHikeAlert?.detected);
    if (filterMode === 'trials') return subs.filter((s) => s.trialCountdownDays !== null);
    return subs;
  }, [subs, filterMode]);

  // Total costs
  const totalMonthlyCost = useMemo(() => {
    return subs
      .filter((s) => s.isActive)
      .reduce((sum, s) => {
        const amt = s.monthlyNormalizedAmount ?? s.amount;
        return sum + convert(amt, s.currency as any, currency as any);
      }, 0);
  }, [subs, convert, currency]);

  const totalAnnualCost = useMemo(() => {
    return totalMonthlyCost * 12;
  }, [totalMonthlyCost]);

  // 30-Day Calendar Days Generation
  const calendarDays = useMemo(() => {
    const days: Array<{
      dateStr: string;
      dayNum: number;
      dayOfWeek: string;
      isToday: boolean;
      dueSubs: SubscriptionItem[];
      totalDue: number;
    }> = [];

    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const dayNum = d.getDate();
      const dayOfWeek = dayNames[d.getDay()];

      // Find subs due on this day (matching YYYY-MM-DD or matching day-of-month if periodic)
      const dueSubs = subs.filter((s) => s.isActive && s.nextRenewalDate === dateStr);
      const totalDue = dueSubs.reduce((acc, s) => acc + convert(s.amount, s.currency as any, currency as any), 0);

      days.push({
        dateStr,
        dayNum,
        dayOfWeek,
        isToday: i === 0,
        dueSubs,
        totalDue,
      });
    }

    return days;
  }, [subs, convert, currency]);

  // 30-day committed outflow sum
  const thirtyDayOutflow = useMemo(() => {
    return calendarDays.reduce((acc, day) => acc + day.totalDue, 0);
  }, [calendarDays]);

  const triggerToast = (msg: string) => {
    setActionSuccessMessage(msg);
    setTimeout(() => setActionSuccessMessage(null), 3500);
  };

  // Quick Action: Mark Renewed
  const handleMarkRenewed = async (sub: SubscriptionItem) => {
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_renewed', id: sub.id }),
      });
      if (!res.ok) throw new Error('Failed to renew subscription');
      triggerToast(`Renewed "${sub.name}". Next cycle scheduled.`);
      mutate();
    } catch (err: any) {
      alert(err?.message || 'Error updating renewal.');
    }
  };

  // Quick Action: Cancel Reminder
  const handleSaveReminder = async () => {
    if (!reminderTarget) return;
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_reminder',
          id: reminderTarget.id,
          days: parseInt(reminderDaysInput, 10) || 3,
        }),
      });
      if (!res.ok) throw new Error('Failed to update reminder');
      triggerToast(`Alert reminder updated for "${reminderTarget.name}".`);
      setReminderTarget(null);
      mutate();
    } catch (err: any) {
      alert(err?.message || 'Error updating reminder.');
    }
  };

  // Quick Action: Update Account
  const handleSaveAccountUpdate = async () => {
    if (!accountUpdateTarget) return;
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_account',
          id: accountUpdateTarget.id,
          accountId: selectedAccountId,
        }),
      });
      if (!res.ok) throw new Error('Failed to update account');
      triggerToast(`Billing account updated for "${accountUpdateTarget.name}".`);
      setAccountUpdateTarget(null);
      mutate();
    } catch (err: any) {
      alert(err?.message || 'Error updating account.');
    }
  };

  // Save / Edit Subscription Form
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name,
      amount: parseFloat(amount),
      currency: subCurrency,
      billingCycle,
      nextRenewalDate: nextRenewal,
      category,
      trialEndsAt: trialEndsAt || null,
      accountId: formAccountId || null,
      cancelReminderDays: parseInt(cancelReminderDays, 10) || 3,
      isActive: 1,
    };

    if (editMode) {
      await fetch(`/api/subscriptions/${editMode.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      triggerToast(`Subscription "${name}" updated.`);
    } else {
      await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      triggerToast(`Subscription "${name}" created.`);
    }

    closeModal();
    mutate();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this subscription?')) return;
    await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
    triggerToast('Subscription deleted.');
    mutate();
  };

  const toggleActive = async (sub: SubscriptionItem) => {
    await fetch(`/api/subscriptions/${sub.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: sub.isActive ? 0 : 1 }),
    });
    mutate();
  };

  const openEdit = (sub: SubscriptionItem) => {
    setEditMode(sub);
    setName(sub.name);
    setAmount(sub.amount.toString());
    setSubCurrency(sub.currency as any);
    setBillingCycle(sub.billingCycle);
    setNextRenewal(sub.nextRenewalDate);
    setCategory(sub.category);
    setTrialEndsAt(sub.trialEndsAt || '');
    setCancelReminderDays(String(sub.cancelReminderDays ?? 3));
    setFormAccountId(sub.accountId || null);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditMode(null);
    setName('');
    setAmount('');
    setBillingCycle('monthly');
    setNextRenewal('');
    setTrialEndsAt('');
    setCancelReminderDays('3');
    setFormAccountId(null);
  };

  return (
    <div className="w-full">
      {/* Toast Notification */}
      <AnimatePresence>
        {actionSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            {actionSuccessMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {t('subscriptionsPage.title')}
          </h2>
          <p className="text-gray-500 dark:text-text-muted text-sm mt-1">
            {t('subscriptionsPage.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Monthly / Annual Cost Toggle */}
          <div className="flex bg-gray-100 dark:bg-surface-dark p-1 rounded-xl border border-gray-200 dark:border-[#30363d]">
            <button
              onClick={() => setCostView('monthly')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                costView === 'monthly'
                  ? 'bg-white dark:bg-[#1a202c] text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('subscriptionsPage.monthlyView')}
            </button>
            <button
              onClick={() => setCostView('annual')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                costView === 'annual'
                  ? 'bg-white dark:bg-[#1a202c] text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {t('subscriptionsPage.annualView')}
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/20 text-sm transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Subscription
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            {costView === 'monthly' ? 'Total Monthly Cost' : 'Annual Projected Cost'}
          </p>
          <h3 className="text-3xl font-black text-gray-900 dark:text-white tabular-nums font-mono">
            {costView === 'monthly' ? fmtRaw(totalMonthlyCost) : fmtRaw(totalAnnualCost)}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Normalized across {subs.filter((s) => s.isActive).length} active memberships
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            {t('subscriptionsPage.upcomingCommitments')}
          </p>
          <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums font-mono">
            {fmtRaw(thirtyDayOutflow)}
          </h3>
          <p className="text-xs text-gray-400 mt-1">Due within the upcoming 30 days</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {t('subscriptionsPage.priceHikeDetected')}
            </p>
            {priceHikeCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
            )}
          </div>
          <h3 className={`text-3xl font-black tabular-nums font-mono ${priceHikeCount > 0 ? 'text-amber-500' : 'text-gray-900 dark:text-white'}`}>
            {priceHikeCount}
          </h3>
          <p className="text-xs text-gray-400 mt-1">Charges flagged with price increases</p>
        </div>

        <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
            {t('subscriptionsPage.freeTrialEnding')}
          </p>
          <h3 className={`text-3xl font-black tabular-nums font-mono ${activeTrialsCount > 0 ? 'text-sky-500' : 'text-gray-900 dark:text-white'}`}>
            {activeTrialsCount}
          </h3>
          <p className="text-xs text-gray-400 mt-1">Active promotional trial periods</p>
        </div>
      </div>

      {/* 30-DAY VISUAL BILL CALENDAR */}
      <div className="glass-panel rounded-2xl p-6 mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-[22px]">
              calendar_month
            </span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {t('subscriptionsPage.billCalendar')}
            </h3>
          </div>
          <span className="text-xs text-gray-400">
            Next 30 Days Forecast • Click date to inspect bills
          </span>
        </div>

        {/* Calendar Strip / Grid */}
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-flow-col auto-cols-[minmax(72px,1fr)] gap-2 min-w-[700px]">
            {calendarDays.map((day) => {
              const hasBills = day.dueSubs.length > 0;
              const isSelected = selectedCalendarDate === day.dateStr;

              return (
                <button
                  key={day.dateStr}
                  onClick={() => setSelectedCalendarDate(isSelected ? null : day.dateStr)}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col justify-between items-center min-h-[92px] ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 shadow-sm'
                      : hasBills
                      ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500'
                      : day.isToday
                      ? 'border-indigo-200 dark:border-white/10 bg-gray-50 dark:bg-white/5'
                      : 'border-gray-100 dark:border-white/5 bg-transparent hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase text-gray-400">
                    {day.dayOfWeek}
                  </span>
                  <span className={`text-base font-black ${day.isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                    {day.dayNum}
                  </span>

                  {hasBills ? (
                    <div className="w-full mt-1">
                      <span className="inline-block text-[10px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md truncate max-w-[62px]">
                        {fmtRaw(day.totalDue)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-300 dark:text-gray-600">—</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Details Callout */}
        {selectedCalendarDate && (
          <div className="mt-4 p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-200 dark:border-indigo-500/20 flex flex-wrap items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-indigo-600 text-[20px]">event</span>
              <div>
                <p className="text-xs font-bold text-gray-900 dark:text-white">
                  Renewals on {new Date(selectedCalendarDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {calendarDays.find((d) => d.dateStr === selectedCalendarDate)?.dueSubs.map((s) => (
                    <span key={s.id} className="text-xs font-bold bg-white dark:bg-surface-dark px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200">
                      {s.name}: {fmt(s.amount)}
                    </span>
                  )) || <span className="text-xs text-gray-400">{t('subscriptionsPage.noUpcomingBills')}</span>}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedCalendarDate(null)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white font-bold"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Filters Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex bg-gray-100 dark:bg-surface-dark p-1 rounded-xl border border-gray-200 dark:border-[#30363d] w-fit">
          {[
            { id: 'all', label: 'All Subscriptions', count: subs.length },
            { id: 'active', label: 'Active', count: subs.filter((s) => s.isActive).length },
            { id: 'price_hikes', label: 'Price Hikes', count: priceHikeCount },
            { id: 'trials', label: 'Free Trials', count: activeTrialsCount },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                filterMode === tab.id
                  ? 'bg-white dark:bg-[#1a202c] text-gray-900 dark:text-white shadow-sm'
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

      {/* Subscriptions Grid */}
      {isLoading ? (
        <div className="flex justify-center p-16">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredSubs.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-2xl border border-gray-100 dark:border-white/5">
          <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4">
            subscriptions
          </span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            No Subscriptions Match Filter
          </h3>
          <p className="text-gray-500 max-w-sm mx-auto text-sm">
            Add recurring subscriptions like Netflix, Spotify, AWS, or gym memberships to monitor renewals and price hikes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubs.map((sub) => {
            const hasHike = sub.priceHikeAlert?.detected;
            const hasTrial = sub.trialCountdownDays !== null && (sub.trialCountdownDays ?? 0) >= 0;
            const linkedAccount = accounts.find((a) => a.id === sub.accountId);

            const displayAmount =
              costView === 'monthly'
                ? sub.monthlyNormalizedAmount ?? sub.amount
                : sub.annualNormalizedAmount ?? sub.amount * 12;

            return (
              <div
                key={sub.id}
                className={`glass-panel p-6 rounded-2xl border transition-all flex flex-col justify-between group ${
                  hasHike
                    ? 'border-amber-500/40 bg-amber-500/5 shadow-sm'
                    : sub.isActive
                    ? 'border-gray-200 dark:border-white/10 hover:border-indigo-500/50'
                    : 'border-gray-100 dark:border-white/5 opacity-60'
                }`}
              >
                <div>
                  {/* Top Bar: Icon, Name, Category, Active Toggle */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center font-black text-gray-700 dark:text-white text-lg">
                        {sub.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white truncate max-w-[170px] text-base">
                          {sub.name}
                        </h3>
                        <p className="text-xs text-gray-400 capitalize">
                          {sub.category} • {sub.billingCycle}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleActive(sub)}
                      className={`w-10 h-5 rounded-full relative transition-colors ${
                        sub.isActive ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'
                      }`}
                      title={sub.isActive ? 'Active — click to pause' : 'Paused — click to resume'}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          sub.isActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      ></span>
                    </button>
                  </div>

                  {/* Badges: Price Hike & Free Trial Alerts */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {hasHike && sub.priceHikeAlert && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        <span className="material-symbols-outlined text-[14px]">trending_up</span>
                        {t('subscriptionsPage.priceHikeBadge')}: +{fmt(sub.priceHikeAlert.delta)} (+{sub.priceHikeAlert.percentageIncrease}%)
                      </span>
                    )}

                    {hasTrial && sub.trialCountdownDays !== null && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                        <span className="material-symbols-outlined text-[14px]">hourglass_top</span>
                        {sub.trialCountdownDays} {t('subscriptionsPage.freeTrialDaysRemaining')}
                      </span>
                    )}
                  </div>

                  {/* Cost & Cycle Display */}
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 mb-4">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">
                      {costView === 'monthly' ? 'Monthly Cost' : 'Annual Cost'}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <h4 className="text-2xl font-black text-gray-900 dark:text-white tabular-nums font-mono">
                        {fmt(displayAmount)}
                      </h4>
                      <span className="text-xs text-gray-400 font-medium">
                        (Raw: {fmt(sub.amount)}/{sub.billingCycle === 'monthly' ? 'mo' : sub.billingCycle === 'yearly' ? 'yr' : 'wk'})
                      </span>
                    </div>
                  </div>

                  {/* Renewal and Linked Account Info */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4">
                    <div className="flex justify-between">
                      <span>Next Renewal:</span>
                      <strong className="text-gray-800 dark:text-gray-200">
                        {sub.nextRenewalDate} ({sub.daysUntilRenewal ?? 0}d left)
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Billing Account:</span>
                      <button
                        onClick={() => {
                          setAccountUpdateTarget(sub);
                          setSelectedAccountId(sub.accountId || null);
                        }}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                        {linkedAccount ? linkedAccount.name : 'Select Account'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="pt-3 border-t border-gray-100 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {/* Mark Renewed Quick Action */}
                    <button
                      onClick={() => handleMarkRenewed(sub)}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                      title="Advance to next billing cycle"
                    >
                      <span className="material-symbols-outlined text-[15px]">event_repeat</span>
                      {t('subscriptionsPage.markRenewed')}
                    </button>

                    {/* Cancel Reminder Quick Action */}
                    <button
                      onClick={() => {
                        setReminderTarget(sub);
                        setReminderDaysInput(String(sub.cancelReminderDays ?? 3));
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors flex items-center gap-1"
                      title="Configure cancellation reminder"
                    >
                      <span className="material-symbols-outlined text-[15px]">notifications_active</span>
                      {sub.cancelReminderDays ? `${sub.cancelReminderDays}d alert` : t('subscriptionsPage.cancelReminder')}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(sub)}
                      className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors"
                      title="Edit subscription"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete subscription"
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

      {/* QUICK ACTION MODAL: Update Account */}
      <AnimatePresence>
        {accountUpdateTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#12161f] border border-gray-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {t('subscriptionsPage.updateBillingAccount')}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Assign a payment card or bank account to &quot;{accountUpdateTarget.name}&quot;.
              </p>

              <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                <button
                  onClick={() => setSelectedAccountId(null)}
                  className={`w-full p-3 rounded-xl border text-left text-sm font-bold transition-all ${
                    selectedAccountId === null
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600'
                      : 'border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  None (Unlinked)
                </button>
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`w-full p-3 rounded-xl border text-left text-sm font-bold transition-all flex items-center justify-between ${
                      selectedAccountId === acc.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600'
                        : 'border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <span>{acc.name}</span>
                    <span className="text-xs text-gray-400 capitalize">{acc.type}</span>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setAccountUpdateTarget(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAccountUpdate}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-md shadow-indigo-600/20"
                >
                  Save Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QUICK ACTION MODAL: Cancel Reminder */}
      <AnimatePresence>
        {reminderTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#12161f] border border-gray-200 dark:border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                {t('subscriptionsPage.cancelReminder')}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Receive proactive reminders before &quot;{reminderTarget.name}&quot; renews on {reminderTarget.nextRenewalDate}.
              </p>

              <div className="mb-6">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Days in Advance
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['1', '3', '5', '7'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setReminderDaysInput(d)}
                      className={`py-2 rounded-xl text-sm font-bold border transition-all ${
                        reminderDaysInput === d
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                          : 'border-gray-200 dark:border-white/5 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setReminderTarget(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveReminder}
                  className="flex-1 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow-md shadow-indigo-600/20"
                >
                  Set Alert
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD / EDIT SUBSCRIPTION MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#12161f] border border-gray-200 dark:border-white/10 rounded-3xl p-6 lg:p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editMode ? 'Edit Subscription' : 'Add Subscription'}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-white">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Service Name</label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Netflix, Spotify, AWS, GitHub"
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-indigo-600 text-gray-900 dark:text-white font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Amount</label>
                    <input
                      required
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="15.00"
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-indigo-600 text-gray-900 dark:text-white font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Currency</label>
                    <select
                      value={subCurrency}
                      onChange={(e) => setSubCurrency(e.target.value as any)}
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-indigo-600 text-gray-900 dark:text-white"
                    >
                      <option value="BDT">BDT (৳)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billing Cycle</label>
                    <select
                      value={billingCycle}
                      onChange={(e) => setBillingCycle(e.target.value as any)}
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-indigo-600 text-gray-900 dark:text-white"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Next Renewal Date</label>
                    <input
                      required
                      type="date"
                      value={nextRenewal}
                      onChange={(e) => setNextRenewal(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-indigo-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-indigo-600 text-gray-900 dark:text-white"
                    >
                      <option value="Entertainment">Entertainment</option>
                      <option value="Software">Software & SaaS</option>
                      <option value="Utilities">Utilities & Telecom</option>
                      <option value="Gym">Gym & Fitness</option>
                      <option value="Education">Education</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Free Trial Ends (Optional)</label>
                    <input
                      type="date"
                      value={trialEndsAt}
                      onChange={(e) => setTrialEndsAt(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-indigo-600 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Linked Billing Account</label>
                  <select
                    value={formAccountId || ''}
                    onChange={(e) => setFormAccountId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-3 text-sm outline-none focus:border-indigo-600 text-gray-900 dark:text-white"
                  >
                    <option value="">Unlinked (None)</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-lg shadow-indigo-600/20 text-sm"
                  >
                    Save Subscription
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
