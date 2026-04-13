'use client';

import useSWR from 'swr';

export interface CustomCategory {
    id: number;
    name: string;
    type: string;
    icon: string;
    color: string;
}

export function useCustomCategories(type?: 'expense' | 'earning' | 'all') {
    const key = type && type !== 'all' ? `/api/categories?type=${type}` : '/api/categories';
    const { data, error, isLoading, mutate } = useSWR<{ categories: CustomCategory[] }>(key);

    return {
        categories: data?.categories || [],
        isLoading,
        error,
        mutate
    };
}
