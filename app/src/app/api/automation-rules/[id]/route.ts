export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { getClientIP } from '@/lib/security/rate-limiter';
import { AutomationRulesService } from '@/services/automation-rules.service';

type Context = {
  params: Promise<{ id: string }>;
};

export const PUT = apiHandler(
  withAuth<Context>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const ruleId = parseInt(id, 10);
    if (isNaN(ruleId)) {
      return NextResponse.json({ error: 'Invalid rule ID' }, { status: 400 });
    }

    const body = await request.json();
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    const updated = await AutomationRulesService.updateRule(userId, ruleId, body, ip, userAgent);
    return NextResponse.json(updated);
  })
);

export const DELETE = apiHandler(
  withAuth<Context>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const ruleId = parseInt(id, 10);
    if (isNaN(ruleId)) {
      return NextResponse.json({ error: 'Invalid rule ID' }, { status: 400 });
    }

    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    await AutomationRulesService.deleteRule(userId, ruleId, ip, userAgent);
    return NextResponse.json({ success: true, message: 'Automation rule deleted successfully' });
  })
);
