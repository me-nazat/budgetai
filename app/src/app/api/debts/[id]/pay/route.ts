export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { getClientIP } from '@/lib/security/rate-limiter';
import { DebtService } from '@/services/debt.service';
import { z } from 'zod';

const recordItemPaymentSchema = z.object({
  sourceAccountId: z.number().int().positive('Valid source account ID is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  note: z.string().max(255).optional(),
});

type Context = {
  params: Promise<{ id: string }>;
};

export const POST = apiHandler(
  withAuth<Context>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const debtId = parseInt(id, 10);
    if (isNaN(debtId)) {
      return NextResponse.json({ error: 'Invalid debt ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = recordItemPaymentSchema.parse(body);
    const ip = getClientIP(request);

    const result = await DebtService.recordPayment(
      userId,
      debtId,
      {
        sourceAccountId: validated.sourceAccountId,
        amount: validated.amount,
        date: validated.date,
        note: validated.note,
      },
      ip
    );

    return NextResponse.json(result, { status: 200 });
  })
);
