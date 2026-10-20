import { redirect } from 'next/navigation';

interface HistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Server-side redirect consolidating /history into /transactions
 * while preserving all incoming query string parameters.
 */
export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((v) => query.append(key, v));
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  redirect(queryString ? `/transactions?${queryString}` : '/transactions');
}
