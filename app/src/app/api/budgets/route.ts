export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { BudgetService } from '@/services/budget.service';
import { BudgetRepository } from '@/repositories/budget.repository';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);

    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month (1-12)' }, { status: 400 });
    }
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year (2000-2100)' }, { status: 400 });
    }

    const budgets = await BudgetService.getByMonth(session.userId, month, year);

    return NextResponse.json({ budgets });
  } catch (error: any) {
    console.error('Budgets GET error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    if (body.action === 'rebalance') {
      const result = await BudgetService.rebalance(session.userId, {
        fromBudgetId: Number(body.fromBudgetId),
        toBudgetId: Number(body.toBudgetId),
        amount: Number(body.amount),
        month: Number(body.month || new Date().getMonth() + 1),
        year: Number(body.year || new Date().getFullYear()),
      }, { ip, userAgent });

      return NextResponse.json({ success: true, result });
    }

    const now = new Date();
    const payload = {
      category: body.category,
      monthlyLimit: Number(body.monthlyLimit ?? body.monthly_limit),
      month: Number(body.month ?? (now.getMonth() + 1)),
      year: Number(body.year ?? now.getFullYear()),
      rolloverEnabled: Boolean(body.rolloverEnabled ?? body.rollover_enabled ?? false),
      rolloverBalance: Number(body.rolloverBalance ?? body.rollover_balance ?? 0),
    };

    const budget = await BudgetService.createOrUpdate(session.userId, payload, { ip, userAgent });
    return NextResponse.json({ success: true, budget });
  } catch (error: any) {
    console.error('Budget POST error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    if (body.action === 'rebalance') {
      const result = await BudgetService.rebalance(session.userId, {
        fromBudgetId: Number(body.fromBudgetId),
        toBudgetId: Number(body.toBudgetId),
        amount: Number(body.amount),
        month: Number(body.month || new Date().getMonth() + 1),
        year: Number(body.year || new Date().getFullYear()),
      }, { ip, userAgent });

      return NextResponse.json({ success: true, result });
    }

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Valid budget ID required' }, { status: 400 });
    }

    const updatePayload: { monthlyLimit?: number; rolloverEnabled?: boolean; rolloverBalance?: number } = {};
    if (body.monthlyLimit !== undefined || body.monthly_limit !== undefined) {
      updatePayload.monthlyLimit = Number(body.monthlyLimit ?? body.monthly_limit);
    }
    if (body.rolloverEnabled !== undefined || body.rollover_enabled !== undefined) {
      updatePayload.rolloverEnabled = Boolean(body.rolloverEnabled ?? body.rollover_enabled);
    }
    if (body.rolloverBalance !== undefined || body.rollover_balance !== undefined) {
      updatePayload.rolloverBalance = Number(body.rolloverBalance ?? body.rollover_balance);
    }

    const updated = await BudgetRepository.update(session.userId, id, updatePayload);
    return NextResponse.json({ success: true, budget: updated });
  } catch (error: any) {
    console.error('Budget PATCH error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const numId = parseInt(id, 10);
    if (!Number.isFinite(numId) || numId < 1) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    await BudgetService.delete(session.userId, numId, { ip, userAgent });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Budget delete error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
