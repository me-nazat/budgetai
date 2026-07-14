export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { getClientIP } from '@/lib/security/rate-limiter';
import { DebtService } from '@/services/debt.service';
import { z } from 'zod';

const updateDebtSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  debtType: z.enum(['credit_card', 'personal_loan', 'student_loan', 'bnpl', 'other']).optional(),
  balance: z.number().min(0, 'Balance must be non-negative').optional(),
  initialBalance: z.number().min(0, 'Initial balance must be non-negative').optional(),
  interestRateApr: z.number().min(0, 'APR must be non-negative').optional(),
  minimumPayment: z.number().min(0, 'Minimum payment must be non-negative').optional(),
  dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  linkRecurring: z.boolean().optional(),
});

type Context = {
  params: Promise<{ id: string }>;
};

export const PUT = apiHandler(
  withAuth<Context>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const debtId = parseInt(id, 10);
    if (isNaN(debtId)) {
      return NextResponse.json({ error: 'Invalid debt ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateDebtSchema.parse(body);
    const ip = getClientIP(request);

    const updated = await DebtService.updateDebt(userId, debtId, validated, ip);
    return NextResponse.json(updated);
  })
);

export const DELETE = apiHandler(
  withAuth<Context>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const debtId = parseInt(id, 10);
    if (isNaN(debtId)) {
      return NextResponse.json({ error: 'Invalid debt ID' }, { status: 400 });
    }

    const ip = getClientIP(request);
    await DebtService.deleteDebt(userId, debtId, ip);
    return NextResponse.json({ success: true, message: 'Debt deleted successfully' });
  })
);
