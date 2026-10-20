import { redirect } from 'next/navigation';

/**
 * Legacy my-month route redirected to the consolidated financial command center.
 */
export default function MyMonthPage() {
  redirect('/dashboard');
}
