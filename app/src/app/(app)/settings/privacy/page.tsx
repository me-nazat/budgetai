import { redirect } from 'next/navigation';

/**
 * @fileoverview Route consolidation redirect.
 * Sub-route /settings/privacy is merged into /settings?tab=security.
 */
export default function PrivacySettingsRedirect() {
  redirect('/settings?tab=security');
}
