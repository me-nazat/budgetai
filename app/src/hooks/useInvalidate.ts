import { useSWRConfig } from 'swr';

export function useInvalidateFinancialData() {
    const { mutate } = useSWRConfig();

    return async () => {
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
    };
}
