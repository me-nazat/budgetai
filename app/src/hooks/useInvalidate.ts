'use client';

import { useSWRConfig } from 'swr';
import { useCallback } from 'react';

export type InvalidationDomain =
  | 'transactions'
  | 'accounts'
  | 'budgets'
  | 'goals'
  | 'recurring'
  | 'categories'
  | 'all';

/**
 * Returns a predicate that checks if an SWR key matches dependent endpoints for a given domain.
 */
export function getDomainKeyMatcher(domain: InvalidationDomain): (key: unknown) => boolean {
  return (key: unknown) => {
    if (typeof key !== 'string') return false;

    switch (domain) {
      case 'transactions':
        return (
          key.startsWith('/api/transactions') ||
          key.startsWith('/api/accounts') ||
          key.startsWith('/api/dashboard') ||
          key.startsWith('/api/budgets') ||
          key.startsWith('/api/networth') ||
          key.startsWith('/api/heatmap') ||
          key.startsWith('/api/notifications') ||
          key.startsWith('/api/coach')
        );

      case 'accounts':
        return (
          key.startsWith('/api/accounts') ||
          key.startsWith('/api/transactions') ||
          key.startsWith('/api/dashboard') ||
          key.startsWith('/api/networth') ||
          key.startsWith('/api/budgets')
        );

      case 'budgets':
        return (
          key.startsWith('/api/budgets') ||
          key.startsWith('/api/dashboard') ||
          key.startsWith('/api/transactions') ||
          key.startsWith('/api/notifications')
        );

      case 'goals':
        return (
          key.startsWith('/api/goals') ||
          key.startsWith('/api/dashboard') ||
          key.startsWith('/api/networth')
        );

      case 'recurring':
        return (
          key.startsWith('/api/recurring') ||
          key.startsWith('/api/subscriptions') ||
          key.startsWith('/api/dashboard') ||
          key.startsWith('/api/transactions')
        );

      case 'categories':
        return (
          key.startsWith('/api/categories') ||
          key.startsWith('/api/transactions') ||
          key.startsWith('/api/dashboard') ||
          key.startsWith('/api/budgets')
        );

      case 'all':
      default:
        return (
          key.startsWith('/api/dashboard') ||
          key.startsWith('/api/transactions') ||
          key.startsWith('/api/accounts') ||
          key.startsWith('/api/notifications') ||
          key.startsWith('/api/budgets') ||
          key.startsWith('/api/networth') ||
          key.startsWith('/api/goals') ||
          key.startsWith('/api/recurring') ||
          key.startsWith('/api/subscriptions') ||
          key.startsWith('/api/categories') ||
          key.startsWith('/api/heatmap') ||
          key.startsWith('/api/coach')
        );
    }
  };
}

export interface OptimisticMutateOptions<TData = unknown, TResult = unknown> {
  key: string;
  optimisticData: TData | ((current: TData | undefined) => TData);
  action: () => Promise<TResult>;
  domain?: InvalidationDomain;
}

/**
 * Hook providing multi-key domain invalidation and optimistic mutations.
 */
export function useInvalidate() {
  const { mutate } = useSWRConfig();

  const invalidateDomain = useCallback(
    async (domain: InvalidationDomain = 'all') => {
      const matcher = getDomainKeyMatcher(domain);
      await mutate(matcher);
    },
    [mutate]
  );

  const optimisticMutate = useCallback(
    async <TData = unknown, TResult = unknown>({
      key,
      optimisticData,
      action,
      domain = 'all',
    }: OptimisticMutateOptions<TData, TResult>): Promise<TResult> => {
      try {
        const result = await mutate(
          key,
          async () => {
            return await action();
          },
          {
            optimisticData,
            rollbackOnError: true,
            populateCache: false,
            revalidate: true,
          }
        );

        // After successful mutation, trigger domain revalidation on dependent keys
        const matcher = getDomainKeyMatcher(domain);
        await mutate(matcher);

        return result as TResult;
      } catch (err) {
        await mutate(key);
        throw err;
      }
    },
    [mutate]
  );

  return {
    invalidate: invalidateDomain,
    optimisticMutate,
  };
}

/**
 * Backward-compatible hook for invalidating financial data across dependent queries.
 */
export function useInvalidateFinancialData() {
  const { invalidate } = useInvalidate();
  return async (domain: InvalidationDomain = 'all') => {
    await invalidate(domain);
  };
}

/**
 * Standalone optimistic mutation helper when SWR mutate function is passed directly.
 */
export async function optimisticMutate<TData = unknown, TResult = unknown>(
  mutateFn: (key: any, data?: any, opts?: any) => Promise<any>,
  options: OptimisticMutateOptions<TData, TResult>
): Promise<TResult> {
  const { key, optimisticData, action, domain = 'all' } = options;
  try {
    const result = await mutateFn(
      key,
      async () => {
        return await action();
      },
      {
        optimisticData,
        rollbackOnError: true,
        populateCache: false,
        revalidate: true,
      }
    );

    const matcher = getDomainKeyMatcher(domain);
    await mutateFn(matcher);
    return result as TResult;
  } catch (err) {
    await mutateFn(key);
    throw err;
  }
}
