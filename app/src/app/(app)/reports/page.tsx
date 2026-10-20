import { redirect } from 'next/navigation';

/**
 * @fileoverview Route consolidation redirect.
 * Legacy /reports is merged into /insights?view=reports.
 */
export default function ReportsRedirectPage() {
  redirect('/insights?view=reports');
}
