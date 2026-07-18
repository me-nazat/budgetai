export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { AccountService } from '@/services/account.service';

type Context = {
  params: Promise<{ id: string }>;
};

export const PUT = apiHandler(
  withAuth<Context>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const accountId = parseInt(id, 10);
    if (isNaN(accountId)) {
      return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 });
    }

    const body = await request.json();
    const updated = await AccountService.update(userId, accountId, body);
    return NextResponse.json(updated);
  })
);
