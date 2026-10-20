import { redirect } from 'next/navigation';

/**
 * Legacy overview route redirected to the consolidated financial command center.
 */
export default function OverviewPage() {
  redirect('/dashboard');
}
