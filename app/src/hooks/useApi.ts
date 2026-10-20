'use client';

import useSWR from 'swr';
export { optimisticMutate, useInvalidate, useInvalidateFinancialData } from './useInvalidate';
export type { InvalidationDomain, OptimisticMutateOptions } from './useInvalidate';

// ────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────
export interface SafeToSpendBreakdown {
    safeToSpendTotal: number;
    dailySafeAllowance: number;
    daysRemaining: number;
    liquidCash: number;
    upcomingCommittedBills: number;
    remainingBudgetReservations: number;
    creditCardCurrentBalance: number;
}

export interface SpendingPaceMetrics {
    currentMonthSpendToDate: number;
    previousMonthSpendSameDay: number;
    paceDeltaPercent: number;
    projectedMonthEndSpend: number;
    dayOfMonth: number;
    daysInMonth: number;
    monthElapsedPercent: number;
    budgetConsumedPercent: number;
}

export interface AccountsSummaryData {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    assetToLiabilityRatio: number;
    liquidCash: number;
    liquidRatio: number;
    accounts: Array<{
        id: number;
        name: string;
        type: string;
        currency: string;
        currentBalance: number;
        balance: number;
        isLiability: boolean;
        colorTag: string;
        isArchived: number;
    }>;
}

export interface HealthScorePillars {
    score: number;
    grade: string;
    pillars: {
        savingsRate: { score: number; max: number; action: string };
        budgetAdherence: { score: number; max: number; action: string };
        emergencyRunway: { score: number; max: number; action: string };
        debtLoad: { score: number; max: number; action: string };
    };
    breakdown?: Record<string, any>;
    history?: Array<{ month: string; score: number }>;
    insight?: string;
}

export interface DashboardData {
    expenses: { current: number; change: number };
    earnings: { current: number; change: number };
    netSavings: number;
    balance: number;
    categorySpending: Array<{ category: string; total: number; amount?: number; percentage?: number; delta?: number }>;
    dailySpending: Array<{ date: string; expenses: number; earnings: number }>;
    previousMonthDailySpending?: Array<{ date: string; expenses: number; earnings: number }>;
    recentTransactions: Array<{
        id: number; type: 'expense' | 'earning'; amount: number;
        category: string; description: string; date: string;
    }>;
    budgetAlerts: Array<{
        category: string; limit: number; spent: number; percentage: number;
    }>;
    netWorth: number;
    safeToSpend?: SafeToSpendBreakdown;
    spendingPace?: SpendingPaceMetrics;
    accountsSummary?: AccountsSummaryData;
    healthScore?: HealthScorePillars;
    totalTransactions?: number;
}

export function useDashboard(month: string, week: string) {
    const key = `/api/dashboard?month=${month}&week=${week}`;
    const { data, error, isLoading, isValidating } = useSWR<DashboardData>(key, {
        keepPreviousData: true,
    });
    return {
        data,
        error,
        isLoading: Boolean(isLoading && !data),
        isValidating,
    };
}

// ────────────────────────────────────────────────────────────
// User / Auth
// ────────────────────────────────────────────────────────────
interface UserData {
    user: {
        id: number;
        name: string;
        email: string;
        currency?: string;
    };
}

export function useUser() {
    const { data, error, isLoading, isValidating } = useSWR<UserData>('/api/auth/me', {
        keepPreviousData: true,
    });
    return {
        user: data?.user,
        data,
        error,
        isLoading: Boolean(isLoading && !data),
        isValidating,
    };
}

// ────────────────────────────────────────────────────────────
// Transactions
// ────────────────────────────────────────────────────────────
export interface TransactionSplitItem {
    id: string;
    category: string;
    amount: number;
    note?: string;
    isTaxDeductible?: boolean;
}

export interface Transaction {
    id: number | string;
    type: 'expense' | 'earning' | 'transfer';
    amount: number;
    category: string;
    description: string;
    date: string;
    created_at?: string;
    createdAt?: string;
    accountId?: number | null;
    toAccountId?: number | null;
    transferGroupId?: string | null;
    taxSuggested?: number | null;
    taxDeductible?: number | boolean;
    splits?: TransactionSplitItem[] | string | null;
    splitItemsJson?: string | null;
    isSplit?: boolean | number | null;
    merchantNormalized?: string | null;
    status?: 'cleared' | 'pending' | 'reconciled';
    notes?: string | null;
    attachments?: string | null;
    receipt_image?: string | null;
    personalShareAmount?: number | null;
    reimbursementStatus?: 'none' | 'receivable' | 'payable' | 'settled' | null;
    collaborativeSourceType?: 'tour' | 'household' | 'bill_split' | null;
    collaborativeSourceId?: string | null;
    collaborativeExpenseId?: string | null;
    isSettlementTransfer?: boolean | number | null;
    clientMutationId?: string | null;
    pending?: boolean;
    syncStatus?: 'pending' | 'syncing' | 'failed';
}

export interface FilterSummaryData {
    totalCount: number;
    totalInflows: number;
    totalOutflows: number;
    netCashflow: number;
    averageTransactionAmount: number;
}

export interface TransactionsResponse {
    transactions: Transaction[];
    total: number;
    filterSummary?: FilterSummaryData;
}

export interface UseTransactionsOptions {
    start?: string;
    end?: string;
    month?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    category?: string;
    categories?: string;
    accountId?: number | string;
    accountIds?: string;
    search?: string;
    minAmount?: number | string;
    maxAmount?: number | string;
    taxDeductible?: string;
    hasAttachments?: string;
    sortBy?: string;
    limit?: number;
    offset?: number;
}

export function useTransactions(
    startOrOptions?: string | UseTransactionsOptions,
    end?: string,
    typeFilter: string = 'all',
    limit: number = 200
) {
    const params = new URLSearchParams();

    if (typeof startOrOptions === 'object' && startOrOptions !== null) {
        const opts = startOrOptions;
        if (opts.start) params.set('start', opts.start);
        if (opts.end) params.set('end', opts.end);
        if (opts.startDate) params.set('startDate', opts.startDate);
        if (opts.endDate) params.set('endDate', opts.endDate);
        if (opts.month) params.set('month', opts.month);
        if (opts.type && opts.type !== 'all') params.set('type', opts.type);
        if (opts.category) params.set('category', opts.category);
        if (opts.categories) params.set('categories', opts.categories);
        if (opts.accountId) params.set('accountId', String(opts.accountId));
        if (opts.accountIds) params.set('accountIds', opts.accountIds);
        if (opts.search) params.set('search', opts.search);
        if (opts.minAmount !== undefined && opts.minAmount !== '') params.set('minAmount', String(opts.minAmount));
        if (opts.maxAmount !== undefined && opts.maxAmount !== '') params.set('maxAmount', String(opts.maxAmount));
        if (opts.taxDeductible) params.set('taxDeductible', opts.taxDeductible);
        if (opts.hasAttachments) params.set('hasAttachments', opts.hasAttachments);
        if (opts.sortBy) params.set('sortBy', opts.sortBy);
        params.set('limit', String(opts.limit ?? limit));
        if (opts.offset) params.set('offset', String(opts.offset));
    } else {
        if (startOrOptions) params.set('start', startOrOptions);
        if (end) params.set('end', end);
        if (typeFilter !== 'all') params.set('type', typeFilter);
        params.set('limit', String(limit));
    }

    const key = `/api/transactions?${params.toString()}`;
    const { data, error, isLoading, isValidating, mutate } = useSWR<TransactionsResponse>(key, {
        keepPreviousData: true,
    });

    return {
        data,
        transactions: data?.transactions || [],
        total: data?.total || 0,
        filterSummary: data?.filterSummary,
        error,
        isLoading: Boolean(isLoading && !data),
        isValidating,
        mutate,
        key,
    };
}

export function useAccounts() {
    const { data, error, isLoading, isValidating, mutate } = useSWR<{ accounts: any[] }>('/api/accounts', {
        keepPreviousData: true,
    });
    return {
        accounts: data?.accounts || [],
        data,
        error,
        isLoading: Boolean(isLoading && !data),
        isValidating,
        mutate,
    };
}

// ────────────────────────────────────────────────────────────
// Market Data (news / rates)
// ────────────────────────────────────────────────────────────
interface MarketNews {
    id: number; title: string; source: string;
    time: string; sentiment: 'positive' | 'negative' | 'neutral';
}

interface CurrencyRates {
    base_code: string;
    rates: Record<string, number>;
    error?: string;
}

export function useMarketNews(): MarketNews[] {
    const { data } = useSWR<{ news: MarketNews[] }>('/api/market?type=news', {
        keepPreviousData: true,
    });
    return data?.news || [];
}

export function useExchangeRates(currency: string) {
    const { data, error, isLoading, isValidating } = useSWR<CurrencyRates>(
        `/api/market?type=rates&base=${currency}`,
        { keepPreviousData: true }
    );
    const ratesData = (!data?.rates || data?.error) ? null : data;
    return ratesData;
}

export function useLayout() {
    const { data, error, isLoading, isValidating, mutate } = useSWR<{ dashboardLayout: string[]; mobileWidgetOrder: string[] }>('/api/settings/layout', {
        keepPreviousData: true,
    });
    return {
        layout: data,
        data,
        error,
        isLoading: Boolean(isLoading && !data),
        isValidating,
        mutate,
    };
}

/**
 * Generic instant-cached API hook with transparent state flags.
 */
export function useApi<T = unknown>(key: string | null, options?: Parameters<typeof useSWR<T>>[2]) {
    const { data, error, isLoading, isValidating, mutate } = useSWR<T>(key, {
        keepPreviousData: true,
        ...options,
    });
    return {
        data,
        error,
        isLoading: Boolean(isLoading && !data),
        isValidating,
        mutate,
    };
}
