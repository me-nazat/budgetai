import { redirect } from 'next/navigation';

/**
 * @fileoverview Route consolidation redirect.
 * Legacy /analytics is merged into /insights?view=cashflow.
 */
export default function AnalyticsRedirectPage() {
  redirect('/insights?view=cashflow');
}
