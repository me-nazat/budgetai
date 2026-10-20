export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jose from 'jose';
import { getSession } from '@/lib/security/session-manager';
import { SubscriptionService } from '@/services/recurring.service';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-for-dev');

async function resolveUserId(): Promise<number | null> {
  const session = await getSession();
  if (session?.userId) return session.userId;
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload.userId as number;
  } catch {
    return null;
  }
}

export async function GET() {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const subscriptions = await SubscriptionService.getAll(userId);
    return NextResponse.json({ subscriptions });
  } catch (e: any) {
    console.error('Failed to fetch subscriptions:', e);
    return NextResponse.json({ error: e?.message || 'Failed to fetch subscriptions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = req.headers.get('x-forwarded-for') || undefined;
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const body = await req.json();

    // Quick Actions
    if (body.action === 'mark_renewed' && body.id) {
      const updated = await SubscriptionService.markRenewed(userId, Number(body.id), { ip, userAgent });
      return NextResponse.json({ success: true, message: 'Subscription renewed', subscription: updated });
    }

    if (body.action === 'cancel_reminder' && body.id) {
      const updated = await SubscriptionService.updateCancelReminder(
        userId,
        Number(body.id),
        Number(body.days ?? 3),
        { ip, userAgent }
      );
      return NextResponse.json({ success: true, message: 'Cancel reminder updated', subscription: updated });
    }

    if (body.action === 'update_account' && body.id) {
      const updated = await SubscriptionService.updateBillingAccount(
        userId,
        Number(body.id),
        body.accountId ? Number(body.accountId) : null,
        { ip, userAgent }
      );
      return NextResponse.json({ success: true, message: 'Billing account updated', subscription: updated });
    }

    // Normal Create Subscription
    const payload = {
      name: body.name,
      amount: Number(body.amount),
      currency: body.currency || 'BDT',
      billingCycle: (body.billingCycle || body.billing_cycle || 'monthly') as 'weekly' | 'monthly' | 'yearly',
      nextRenewalDate: body.nextRenewalDate || body.next_renewal_date,
      category: body.category || 'Other',
      logoUrl: body.logoUrl || body.logo_url || null,
      isActive: body.isActive !== undefined ? body.isActive : (body.is_active !== undefined ? body.is_active : 1),
      trialEndsAt: body.trialEndsAt || body.trial_ends_at || null,
      previousAmount: body.previousAmount !== undefined ? body.previousAmount : body.previous_amount,
      accountId: body.accountId || body.account_id || null,
      cancelReminderDays: body.cancelReminderDays !== undefined ? Number(body.cancelReminderDays) : (body.cancel_reminder_days !== undefined ? Number(body.cancel_reminder_days) : 3),
    };

    const created = await SubscriptionService.create(userId, payload, { ip, userAgent });
    return NextResponse.json({ message: 'Created', id: created.id, subscription: created });
  } catch (e: any) {
    console.error('Failed to create subscription:', e);
    return NextResponse.json({ error: e?.message || 'Failed to create subscription' }, { status: 400 });
  }
}

