import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useData<T>(key: string | null, fallbackData?: T) {
  const { data, error, mutate, isLoading } = useSWR<T>(key, fetcher, {
    fallbackData,
    revalidateOnFocus: false, // Don't refetch just because user switched tabs
    revalidateIfStale: false, // Trust the cache if we have it
    dedupingInterval: 60000, // 1 minute
    keepPreviousData: true, // Smooth transitions between pages
  });

  return { data, error, mutate, isLoading };
}
