import { redirect } from 'next/navigation';

/**
 * Legacy documents route redirected to consolidated Tax & Vault center.
 */
export default function DocumentsRedirectPage() {
  redirect('/tax-center?tab=vault');
}
