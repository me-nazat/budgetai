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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId) || numId < 1) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for') || undefined;
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    const body = await req.json();

    if (body.action === 'mark_renewed') {
      const updated = await SubscriptionService.markRenewed(userId, numId, { ip, userAgent });
      return NextResponse.json({ message: 'Renewed', subscription: updated });
    }

    if (body.action === 'cancel_reminder') {
      const updated = await SubscriptionService.updateCancelReminder(userId, numId, Number(body.days ?? 3), { ip, userAgent });
      return NextResponse.json({ message: 'Reminder updated', subscription: updated });
    }

    if (body.action === 'update_account') {
      const updated = await SubscriptionService.updateBillingAccount(userId, numId, body.accountId ? Number(body.accountId) : null, { ip, userAgent });
      return NextResponse.json({ message: 'Account updated', subscription: updated });
    }

    const payload: Record<string, any> = {};
    if (body.name !== undefined) payload.name = body.name;
    if (body.amount !== undefined) payload.amount = Number(body.amount);
    if (body.currency !== undefined) payload.currency = body.currency;
    if (body.billingCycle !== undefined || body.billing_cycle !== undefined) {
      payload.billingCycle = body.billingCycle || body.billing_cycle;
    }
    if (body.nextRenewalDate !== undefined || body.next_renewal_date !== undefined) {
      payload.nextRenewalDate = body.nextRenewalDate || body.next_renewal_date;
    }
    if (body.category !== undefined) payload.category = body.category;
    if (body.logoUrl !== undefined || body.logo_url !== undefined) {
      payload.logoUrl = body.logoUrl !== undefined ? body.logoUrl : body.logo_url;
    }
    if (body.isActive !== undefined || body.is_active !== undefined) {
      payload.isActive = body.isActive !== undefined ? body.isActive : body.is_active;
    }
    if (body.trialEndsAt !== undefined || body.trial_ends_at !== undefined) {
      payload.trialEndsAt = body.trialEndsAt !== undefined ? body.trialEndsAt : body.trial_ends_at;
    }
    if (body.previousAmount !== undefined || body.previous_amount !== undefined) {
      payload.previousAmount = body.previousAmount !== undefined ? body.previousAmount : body.previous_amount;
    }
    if (body.accountId !== undefined || body.account_id !== undefined) {
      payload.accountId = body.accountId !== undefined ? body.accountId : body.account_id;
    }
    if (body.cancelReminderDays !== undefined || body.cancel_reminder_days !== undefined) {
      payload.cancelReminderDays = body.cancelReminderDays !== undefined ? Number(body.cancelReminderDays) : Number(body.cancel_reminder_days);
    }

    const updated = await SubscriptionService.update(userId, numId, payload, { ip, userAgent });
    return NextResponse.json({ message: 'Updated', subscription: updated });
  } catch (e: any) {
    console.error('Failed to update subscription:', e);
    return NextResponse.json({ error: e?.message || 'Failed to update subscription' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await resolveUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (!Number.isFinite(numId) || numId < 1) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  const ip = req.headers.get('x-forwarded-for') || undefined;
  const userAgent = req.headers.get('user-agent') || undefined;

  try {
    await SubscriptionService.delete(userId, numId, { ip, userAgent });
    return NextResponse.json({ message: 'Deleted' });
  } catch (e: any) {
    console.error('Failed to delete subscription:', e);
    return NextResponse.json({ error: e?.message || 'Failed to delete subscription' }, { status: 500 });
  }
}

