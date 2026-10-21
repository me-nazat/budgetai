'use client';

import React, { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { usePrivacy } from '@/contexts/PrivacyContext';
import { useCustomCategories } from '@/hooks/useCustomCategories';
import { useAccounts } from '@/hooks/useApi';
import { getCategoryIcon } from '@/lib/categoryUtils';

export interface FilterState {
  search: string;
  type: 'all' | 'expense' | 'earning' | 'transfer';
  datePreset: 'all_time' | 'this_month' | 'last_month' | 'last_30' | 'last_90' | 'this_year' | 'custom';
  startDate: string;
  endDate: string;
  month: string;
  categories: string[];
  accountIds: number[];
  minAmount: string;
  maxAmount: string;
  taxDeductible: 'all' | 'true' | 'false';
  sortBy: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
}

export interface FilterSummary {
  totalCount: number;
  totalInflows: number;
  totalOutflows: number;
  totalInflow?: number;
  totalOutflow?: number;
  netCashflow: number;
  averageTransactionAmount: number;
}

interface TransactionFiltersBarProps {
  filterSummary?: FilterSummary;
  fmt: (v: number) => string;
  showQuickAdd: boolean;
  setShowQuickAdd: (v: boolean) => void;
  setIsScannerOpen: (v: boolean) => void;
  exportExcel: () => void;
  onFilterChange?: (filters: FilterState) => void;
}

const QUICK_DATE_PILLS = [
  { id: 'all_time', label: 'All Time' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'last_30', label: 'Last 30 Days' },
  { id: 'last_90', label: 'Last 90 Days' },
  { id: 'this_year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
] as const;

function computeDatePresetRange(preset: string): { start: string; end: string; month?: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const pad = (n: number) => String(n).padStart(2, '0');
  const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  switch (preset) {
    case 'all_time':
      return { start: '', end: '', month: '' };
    case 'this_month': {
      const start = `${year}-${pad(month + 1)}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
      return { start, end, month: `${year}-${pad(month + 1)}` };
    }
    case 'last_month': {
      const prevDate = new Date(year, month - 1, 1);
      const pYear = prevDate.getFullYear();
      const pMonth = prevDate.getMonth();
      const start = `${pYear}-${pad(pMonth + 1)}-01`;
      const lastDay = new Date(pYear, pMonth + 1, 0).getDate();
      const end = `${pYear}-${pad(pMonth + 1)}-${pad(lastDay)}`;
      return { start, end, month: `${pYear}-${pad(pMonth + 1)}` };
    }
    case 'last_30': {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start: format(past), end: format(now) };
    }
    case 'last_90': {
      const past = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      return { start: format(past), end: format(now) };
    }
    case 'this_year': {
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
    default:
      return { start: '', end: '' };
  }
}

export const TransactionFiltersBar: React.FC<TransactionFiltersBarProps> = ({
  filterSummary,
  fmt,
  showQuickAdd,
  setShowQuickAdd,
  setIsScannerOpen,
  exportExcel,
  onFilterChange,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { formatAmount } = usePrivacy();
  const [, startTransition] = useTransition();

  const { categories: customCategories } = useCustomCategories('all');
  const { accounts } = useAccounts();

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on "/" key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Active filter states initialized from URL search params
  const initialPreset = useMemo(() => {
    if (searchParams.get('startDate') || searchParams.get('start')) return 'custom';
    if (searchParams.get('month')) return 'this_month';
    if (searchParams.get('all_time') || (!searchParams.get('month') && !searchParams.get('startDate'))) return 'this_month';
    return 'this_month';
  }, [searchParams]);

  const defaultDates = useMemo(() => computeDatePresetRange('this_month'), []);

  const [search, setSearch] = useState(searchParams.get('q') || searchParams.get('search') || '');
  const [type, setType] = useState<'all' | 'expense' | 'earning' | 'transfer'>(
    (searchParams.get('type') as any) || 'all'
  );
  const [datePreset, setDatePreset] = useState<FilterState['datePreset']>(initialPreset as any);
  const [startDate, setStartDate] = useState(
    searchParams.get('startDate') || searchParams.get('start') || defaultDates.start
  );
  const [endDate, setEndDate] = useState(
    searchParams.get('endDate') || searchParams.get('end') || defaultDates.end
  );
  const [month, setMonth] = useState(searchParams.get('month') || defaultDates.month || '');

  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    const raw = searchParams.get('category') || searchParams.get('categories');
    return raw ? raw.split(',').map((c) => c.trim()).filter(Boolean) : [];
  });

  const [selectedAccounts, setSelectedAccounts] = useState<number[]>(() => {
    const raw = searchParams.get('accountId') || searchParams.get('accountIds');
    return raw
      ? raw
          .split(',')
          .map((id) => parseInt(id.trim(), 10))
          .filter((n) => !isNaN(n))
      : [];
  });

  const [minAmount, setMinAmount] = useState(searchParams.get('minAmount') || '');
  const [maxAmount, setMaxAmount] = useState(searchParams.get('maxAmount') || '');
  const [taxDeductible, setTaxDeductible] = useState<'all' | 'true' | 'false'>(
    (searchParams.get('taxDeductible') as any) || 'all'
  );
  const [sortBy, setSortBy] = useState<FilterState['sortBy']>(
    (searchParams.get('sort') || searchParams.get('sortBy') || 'date_desc') as any
  );

  // Dropdown popover open states
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [amountPopoverOpen, setAmountPopoverOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const amountMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(target)) {
        setCategoryDropdownOpen(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountDropdownOpen(false);
      }
      if (amountMenuRef.current && !amountMenuRef.current.contains(target)) {
        setAmountPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Synchronize state changes to URL query string with 200ms debounce
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set('q', search.trim());
      }
      if (type !== 'all') params.set('type', type);

      if (datePreset === 'this_month' && month) {
        params.set('month', month);
      } else if (datePreset === 'all_time') {
        // No date constraint
      } else if (startDate && endDate) {
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }

      if (selectedCategories.length === 1) {
        params.set('category', selectedCategories[0]);
      } else if (selectedCategories.length > 1) {
        params.set('categories', selectedCategories.join(','));
      }

      if (selectedAccounts.length === 1) {
        params.set('accountId', String(selectedAccounts[0]));
      } else if (selectedAccounts.length > 1) {
        params.set('accountIds', selectedAccounts.join(','));
      }

      if (minAmount.trim()) params.set('minAmount', minAmount.trim());
      if (maxAmount.trim()) params.set('maxAmount', maxAmount.trim());
      if (taxDeductible !== 'all') params.set('taxDeductible', taxDeductible);
      if (sortBy !== 'date_desc') params.set('sort', sortBy);

      const qs = params.toString();
      const targetUrl = qs ? `${pathname}?${qs}` : pathname;

      startTransition(() => {
        router.replace(targetUrl, { scroll: false });
      });

      if (onFilterChange) {
        onFilterChange({
          search: search.trim(),
          type,
          datePreset,
          startDate,
          endDate,
          month,
          categories: selectedCategories,
          accountIds: selectedAccounts,
          minAmount,
          maxAmount,
          taxDeductible,
          sortBy,
        });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [
    search,
    type,
    datePreset,
    startDate,
    endDate,
    month,
    selectedCategories,
    selectedAccounts,
    minAmount,
    maxAmount,
    taxDeductible,
    sortBy,
    pathname,
    router,
    onFilterChange,
  ]);

  // Handle Quick Date Preset Click
  const handleDatePresetClick = (presetId: FilterState['datePreset']) => {
    setDatePreset(presetId);
    if (presetId !== 'custom') {
      const range = computeDatePresetRange(presetId);
      setStartDate(range.start);
      setEndDate(range.end);
      if (range.month) setMonth(range.month);
      else setMonth('');
    }
  };

  // Toggle Category selection
  const toggleCategory = (catName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  };

  // Toggle Account selection
  const toggleAccount = (accId: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(accId) ? prev.filter((id) => id !== accId) : [...prev, accId]
    );
  };

  // Count active filter facets
  const activeFacetCount = useMemo(() => {
    let count = 0;
    if (search.trim()) count++;
    if (type !== 'all') count++;
    if (datePreset !== 'this_month') count++;
    if (selectedCategories.length > 0) count++;
    if (selectedAccounts.length > 0) count++;
    if (minAmount.trim() || maxAmount.trim()) count++;
    if (taxDeductible !== 'all') count++;
    if (sortBy !== 'date_desc') count++;
    return count;
  }, [
    search,
    type,
    datePreset,
    selectedCategories,
    selectedAccounts,
    minAmount,
    maxAmount,
    taxDeductible,
    sortBy,
  ]);

  // Clear all filters back to default
  const clearAllFilters = () => {
    const cur = computeDatePresetRange('this_month');
    setSearch('');
    setType('all');
    setDatePreset('this_month');
    setStartDate(cur.start);
    setEndDate(cur.end);
    setMonth(cur.month || '');
    setSelectedCategories([]);
    setSelectedAccounts([]);
    setMinAmount('');
    setMaxAmount('');
    setTaxDeductible('all');
    setSortBy('date_desc');
  };

  // Combined standard + custom categories
  const allCategoryList = useMemo(() => {
    const defaultList = [
      'Food',
      'Transport',
      'Housing',
      'Utilities',
      'Entertainment',
      'Shopping',
      'Health',
      'Education',
      'Business',
      'Savings',
      'Salary',
      'Freelance',
      'Investment',
      'Other',
    ];
    const customList = customCategories.map((c) => c.name);
    const combined = Array.from(new Set([...defaultList, ...customList]));
    if (!categorySearchQuery.trim()) return combined;
    return combined.filter((c) =>
      c.toLowerCase().includes(categorySearchQuery.trim().toLowerCase())
    );
  }, [customCategories, categorySearchQuery]);

  return (
    <div className="space-y-4 mb-6">
      {/* ── Top Header Strip: Title & Primary Actions ── */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Ledger & Transactions</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary dark:text-[#38bdf8] border border-primary/20">
              60fps Real-Time
            </span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1">
            Keyboard-navigable ledger with inline cell editing and zero balance drift
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="px-3.5 py-2 bg-primary/10 text-primary dark:text-[#38bdf8] hover:bg-primary/20 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 border border-primary/20 active:scale-95 shadow-sm"
            title="Scan Receipts with OCR"
          >
            <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            <span>Smart Scan</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 active:scale-95 shadow-sm shadow-primary/20"
          >
            <span className="material-symbols-outlined text-[18px]">
              {showQuickAdd ? 'close' : 'add'}
            </span>
            <span>{showQuickAdd ? 'Cancel' : 'Quick Add'}</span>
          </button>

          <button
            type="button"
            onClick={exportExcel}
            className="px-3.5 py-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl text-xs sm:text-sm font-semibold transition-all border border-emerald-200 dark:border-emerald-500/20 hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-1.5 active:scale-95 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* ── Filter Bar Controls ── */}
      <div className="card-glass relative overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.08] p-4 shadow-xl backdrop-blur-2xl space-y-3">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
        {/* Row 1: Search, Type Tabs, Sort By, Reset Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Debounced Search with / shortcut */}
          <div className="relative flex-1 min-w-[220px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search description, category, or amount... (Press / to focus)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-14 py-2 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-xs sm:text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary transition-colors"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-[10px] font-mono text-gray-400">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Type Filter Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-black/30 p-1 rounded-xl shrink-0 overflow-x-auto border border-transparent dark:border-white/5">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'expense', label: 'Expenses' },
                { id: 'earning', label: 'Income' },
                { id: 'transfer', label: 'Transfers' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  type === t.id
                    ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Sort By Select */}
          <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/30 text-xs font-semibold text-gray-700 dark:text-gray-300 shrink-0">
            <span className="material-symbols-outlined text-[16px] text-gray-400">sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent outline-none cursor-pointer text-xs font-bold text-gray-900 dark:text-white"
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
            </select>
          </label>

          {/* Reset Filters Button */}
          {activeFacetCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-xs font-bold border border-rose-200 dark:border-rose-500/20 flex items-center gap-1 shrink-0 transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>
              <span>Clear ({activeFacetCount})</span>
            </button>
          )}
        </div>

        {/* Row 2: Date Range Quick Pills & Custom Inputs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-150 dark:border-white/10">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">
            Period:
          </span>
          {QUICK_DATE_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => handleDatePresetClick(pill.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                datePreset === pill.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
              }`}
            >
              {pill.label}
            </button>
          ))}

          {/* Custom Date Pickers */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-1.5 ml-2 animate-fade-in">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-black/30 text-gray-900 dark:text-white outline-none"
              />
              <span className="text-gray-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-black/30 text-gray-900 dark:text-white outline-none"
              />
            </div>
          )}
        </div>

        {/* Row 3: Faceted Popovers (Categories, Accounts, Amount Bounds, Tax Status) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Categories Multi-Select Dropdown */}
          <div className="relative" ref={categoryMenuRef}>
            <button
              type="button"
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedCategories.length > 0
                  ? 'bg-primary/10 border-primary/25 text-primary dark:text-[#38bdf8]'
                  : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-white/5 dark:border-white/10 dark:text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">category</span>
              <span>
                {selectedCategories.length === 0
                  ? 'All Categories'
                  : `Categories (${selectedCategories.length})`}
              </span>
              <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
            </button>

            {categoryDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-40 w-64 rounded-2xl border border-gray-200/80 bg-white/95 p-2.5 shadow-2xl dark:border-white/10 dark:bg-[#12182B]/95 backdrop-blur-xl">
                <input
                  type="text"
                  placeholder="Filter categories..."
                  value={categorySearchQuery}
                  onChange={(e) => setCategorySearchQuery(e.target.value)}
                  className="w-full mb-2 px-2.5 py-1 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-black/30 text-gray-900 dark:text-white outline-none"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {allCategoryList.map((cat) => {
                    const isChecked = selectedCategories.includes(cat);
                    return (
                      <label
                        key={cat}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCategory(cat)}
                          className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span className="material-symbols-outlined text-[15px] text-gray-400">
                          {getCategoryIcon(cat, customCategories)}
                        </span>
                        <span className="text-gray-800 dark:text-gray-200 font-medium truncate">
                          {cat}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {selectedCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategories([])}
                    className="mt-2 w-full text-center text-[11px] font-bold text-rose-500 hover:underline pt-1 border-t border-gray-100 dark:border-white/10 cursor-pointer"
                  >
                    Clear Category Selection
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Accounts Multi-Select Dropdown */}
          <div className="relative" ref={accountMenuRef}>
            <button
              type="button"
              onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedAccounts.length > 0
                  ? 'bg-primary/10 border-primary/25 text-primary dark:text-[#38bdf8]'
                  : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-white/5 dark:border-white/10 dark:text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
              <span>
                {selectedAccounts.length === 0
                  ? 'All Accounts'
                  : `Accounts (${selectedAccounts.length})`}
              </span>
              <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
            </button>

            {accountDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-40 w-64 rounded-2xl border border-gray-200/80 bg-white/95 p-2.5 shadow-2xl dark:border-white/10 dark:bg-[#12182B]/95 backdrop-blur-xl">
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {accounts.map((acc: any) => {
                    const isChecked = selectedAccounts.includes(acc.id);
                    return (
                      <label
                        key={acc.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAccount(acc.id)}
                          className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: acc.colorTag || '#136dec' }}
                        />
                        <span className="text-gray-800 dark:text-gray-200 font-medium truncate flex-1">
                          {acc.name}
                        </span>
                        <span className="text-[10px] text-gray-400">{acc.currency || 'BDT'}</span>
                      </label>
                    );
                  })}
                </div>
                {selectedAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedAccounts([])}
                    className="mt-2 w-full text-center text-[11px] font-bold text-rose-500 hover:underline pt-1 border-t border-gray-100 dark:border-white/10 cursor-pointer"
                  >
                    Clear Account Selection
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Amount Range Bounds Popover */}
          <div className="relative" ref={amountMenuRef}>
            <button
              type="button"
              onClick={() => setAmountPopoverOpen(!amountPopoverOpen)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                minAmount || maxAmount
                  ? 'bg-primary/10 border-primary/25 text-primary dark:text-[#38bdf8]'
                  : 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-white/5 dark:border-white/10 dark:text-gray-300'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">paid</span>
              <span>
                {minAmount || maxAmount
                  ? `${minAmount ? `≥${minAmount}` : ''} ${maxAmount ? `≤${maxAmount}` : ''}`
                  : 'Amount Range'}
              </span>
              <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
            </button>

            {amountPopoverOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-40 w-60 rounded-2xl border border-gray-200/80 bg-white/95 p-3 shadow-2xl dark:border-white/10 dark:bg-[#12182B]/95 backdrop-blur-xl space-y-2.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Amount Bounds
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 block mb-0.5">Min</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-black/30 text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-gray-500 block mb-0.5">Max</label>
                    <input
                      type="number"
                      placeholder="999999"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-white/10 rounded-lg bg-gray-50 dark:bg-black/30 text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
                {(minAmount || maxAmount) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMinAmount('');
                      setMaxAmount('');
                    }}
                    className="w-full text-center text-[11px] font-bold text-rose-500 hover:underline pt-1 border-t border-gray-100 dark:border-white/10 cursor-pointer"
                  >
                    Reset Range
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tax Tag Deductible Filter */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#0A0E1A]/60 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() =>
                setTaxDeductible((cur) =>
                  cur === 'all' ? 'true' : cur === 'true' ? 'false' : 'all'
                )
              }
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                taxDeductible === 'true'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : taxDeductible === 'false'
                  ? 'bg-gray-300 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">sell</span>
              <span>
                {taxDeductible === 'true'
                  ? 'Deductible Only'
                  : taxDeductible === 'false'
                  ? 'Non-Deductible'
                  : 'Tax: All'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Live Filtered Summary Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total Filtered Count */}
        <div className="card-glass relative overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.08] p-3.5 shadow-lg backdrop-blur-2xl flex items-center gap-3 hover-lift group">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary dark:text-[#38bdf8] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">receipt_long</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Filtered
            </p>
            <p className="text-base sm:text-lg font-black text-gray-900 dark:text-white font-mono tabular-nums">
              {filterSummary ? filterSummary.totalCount : 0} rows
            </p>
          </div>
        </div>

        {/* Total Inflows */}
        <div className="card-glass relative overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.08] p-3.5 shadow-lg backdrop-blur-2xl flex items-center gap-3 hover-lift group">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Inflows
            </p>
            <p className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              +{formatAmount(filterSummary?.totalInflows || 0, fmt(filterSummary?.totalInflows || 0))}
            </p>
          </div>
        </div>

        {/* Total Outflows */}
        <div className="card-glass relative overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.08] p-3.5 shadow-lg backdrop-blur-2xl flex items-center gap-3 hover-lift group">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
              Outflows
            </p>
            <p className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums">
              -{formatAmount(filterSummary?.totalOutflows || 0, fmt(filterSummary?.totalOutflows || 0))}
            </p>
          </div>
        </div>

        {/* Net Cashflow */}
        <div className="card-glass relative overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.08] p-3.5 shadow-lg backdrop-blur-2xl flex items-center gap-3 hover-lift group">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              (filterSummary?.netCashflow || 0) >= 0
                ? 'bg-primary/10 border-primary/20 text-primary dark:text-[#38bdf8]'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">account_balance</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Net Cashflow
            </p>
            <p
              className={`text-base sm:text-lg font-black font-mono tabular-nums ${
                (filterSummary?.netCashflow || 0) >= 0
                  ? 'text-primary dark:text-[#38bdf8]'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {(filterSummary?.netCashflow || 0) >= 0 ? '+' : ''}
              {formatAmount(
                filterSummary?.netCashflow || 0,
                fmt(filterSummary?.netCashflow || 0)
              )}
            </p>
          </div>
        </div>

        {/* Average Transaction Amount */}
        <div className="col-span-2 md:col-span-1 card-glass relative overflow-hidden rounded-2xl border border-white/[0.08] dark:border-white/[0.08] p-3.5 shadow-lg backdrop-blur-2xl flex items-center gap-3 hover-lift group">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">equalizer</span>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Avg Amount
            </p>
            <p className="text-base sm:text-lg font-black text-gray-900 dark:text-white font-mono tabular-nums">
              {formatAmount(
                filterSummary?.averageTransactionAmount || 0,
                fmt(filterSummary?.averageTransactionAmount || 0)
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
