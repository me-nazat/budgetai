'use client';

import useSWR, { mutate } from 'swr';

// ────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────
interface DashboardData {
    expenses: { current: number; change: number };
    earnings: { current: number; change: number };
    netSavings: number;
    balance: number;
    categorySpending: Array<{ category: string; total: number }>;
    dailySpending: Array<{ date: string; expenses: number; earnings: number }>;
    recentTransactions: Array<{
        id: number; type: string; amount: number;
        category: string; description: string; date: string;
    }>;
    budgetAlerts: Array<{
        category: string; limit: number; spent: number; percentage: number;
    }>;
    netWorth: number;
}

export function useDashboard(month: string, week: string) {
    const key = `/api/dashboard?month=${month}&week=${week}`;
    const { data, error, isLoading, isValidating } = useSWR<DashboardData>(key);
    return { data, error, isLoading, isValidating };
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
    const { data, error, isLoading } = useSWR<UserData>('/api/auth/me');
    return { user: data?.user, error, isLoading };
}

// ────────────────────────────────────────────────────────────
// Transactions
// ────────────────────────────────────────────────────────────
interface Transaction {
    id: number; type: string; amount: number;
    category: string; description: string;
    date: string; created_at: string;
}

interface TransactionsResponse {
    transactions: Transaction[];
    total: number;
}

export function useTransactions(
    start: string, end: string,
    typeFilter: string = 'all', limit: number = 200
) {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    params.set('limit', String(limit));

    const key = `/api/transactions?${params.toString()}`;
    const { data, error, isLoading, isValidating } = useSWR<TransactionsResponse>(key);
    return {
        transactions: data?.transactions || [],
        total: data?.total || 0,
        error, isLoading, isValidating,
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

export function useMarketNews() {
    const { data } = useSWR<{ news: MarketNews[] }>('/api/market?type=news');
    return data?.news || [];
}

export function useExchangeRates(currency: string) {
    const { data } = useSWR<CurrencyRates>(
        `/api/market?type=rates&base=${currency}`
    );
    return (!data?.rates || data?.error) ? null : data;
}

// ────────────────────────────────────────────────────────────
// Cache Invalidation — call after mutations
// ────────────────────────────────────────────────────────────
export async function invalidateFinancialData() {
    // Revalidate all SWR keys that start with these prefixes
    await mutate(
        (key: string) =>
            typeof key === 'string' && (
                key.startsWith('/api/dashboard') ||
                key.startsWith('/api/transactions') ||
                key.startsWith('/api/notifications') ||
                key.startsWith('/api/budgets') ||
                key.startsWith('/api/networth') ||
                key.startsWith('/api/goals') ||
                key.startsWith('/api/recurring') ||
                key.startsWith('/api/categories')
            ),
        undefined,
        { revalidate: true }
    );
}
