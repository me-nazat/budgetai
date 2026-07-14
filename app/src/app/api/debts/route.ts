export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { getClientIP } from '@/lib/security/rate-limiter';
import { DebtService } from '@/services/debt.service';
import { z } from 'zod';

const createDebtSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  debtType: z.enum(['credit_card', 'personal_loan', 'student_loan', 'bnpl', 'other']),
  balance: z.number().min(0, 'Balance must be non-negative'),
  initialBalance: z.number().min(0, 'Initial balance must be non-negative').optional(),
  interestRateApr: z.number().min(0, 'APR must be non-negative'),
  minimumPayment: z.number().min(0, 'Minimum payment must be non-negative'),
  dueDayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  linkRecurring: z.boolean().optional(),
});

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const list = await DebtService.getDebts(userId);
    return NextResponse.json({ debts: list });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const validated = createDebtSchema.parse(body);
    const ip = getClientIP(request);

    const newDebt = await DebtService.createDebt(userId, validated, ip);
    return NextResponse.json(newDebt, { status: 201 });
  })
);
