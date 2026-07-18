export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { AccountService } from '@/services/account.service';

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const list = await AccountService.list(userId);
    return NextResponse.json({ accounts: list });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const newAccount = await AccountService.create(userId, body);
    return NextResponse.json(newAccount, { status: 201 });
  })
);
