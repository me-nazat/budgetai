import { redirect } from 'next/navigation';

/**
 * @fileoverview Route consolidation redirect.
 * Legacy /forecast is merged into /insights?view=forecast.
 */
export default function ForecastRedirectPage() {
  redirect('/insights?view=forecast');
}
