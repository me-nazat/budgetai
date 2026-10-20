export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { getClientIP } from '@/lib/security/rate-limiter';
import { DebtService } from '@/services/debt.service';
import { z } from 'zod';

const recordPaymentSchema = z.object({
  debtId: z.number().int().positive('Valid debt ID is required'),
  sourceAccountId: z.number().int().positive('Valid source account ID is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
  note: z.string().max(255).optional(),
});

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const validated = recordPaymentSchema.parse(body);
    const ip = getClientIP(request);

    const result = await DebtService.recordPayment(
      userId,
      validated.debtId,
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
