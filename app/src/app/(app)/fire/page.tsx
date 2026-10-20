import { redirect } from 'next/navigation';

export default function FireRedirectPage() {
  redirect('/wealth-goals?tab=independence');
}
