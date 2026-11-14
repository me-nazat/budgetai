export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { getClientIP } from '@/lib/security/rate-limiter';
import { AutomationRulesService } from '@/services/automation-rules.service';

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const list = await AutomationRulesService.getRules(userId);
    return NextResponse.json({ rules: list });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    const newRule = await AutomationRulesService.createRule(userId, body, ip, userAgent);
    return NextResponse.json(newRule, { status: 201 });
  })
);
