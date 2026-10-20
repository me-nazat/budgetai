import { redirect } from 'next/navigation';

/**
 * @fileoverview Route consolidation redirect.
 * Sub-route /settings/calendar is merged into /settings?tab=integrations.
 */
export default function CalendarSettingsRedirect() {
  redirect('/settings?tab=integrations');
}
