export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { AiInsightsRepository } from '@/repositories/aiInsights.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    let insights = await AiInsightsRepository.getActiveInsights(userId);

    // If cache is empty, seed standard proactive AI recommendations
    if (insights.length === 0) {
      const defaultInsights = [
        {
          userId,
          insightType: 'savings_opportunity',
          title: 'High Idle Cash Allocation',
          description:
            'You have over $3,500 resting in non-interest checking. Move $2,000 to High Yield Savings to earn an extra $90/year.',
          actionPayload: JSON.stringify({
            toolName: 'create_goal',
            parameters: { name: 'High Yield Savings Fund', targetAmount: 2000 },
          }),
        },
        {
          userId,
          insightType: 'price_jump',
          title: 'Subscription Price Increase Detected',
          description: 'Your monthly streaming charge increased by $3.00 starting this cycle.',
          actionPayload: JSON.stringify({
            toolName: 'create_budget',
            parameters: { category: 'Entertainment', monthlyLimit: 40 },
          }),
        },
      ];

      for (const item of defaultInsights) {
        await AiInsightsRepository.cacheInsight(item);
      }
      insights = await AiInsightsRepository.getActiveInsights(userId);
    }

    return NextResponse.json({ insights });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { insightId } = body;

    if (!insightId) {
      return NextResponse.json({ error: 'Insight ID required' }, { status: 400 });
    }

    await AiInsightsRepository.dismissInsight(parseInt(insightId, 10), userId);
    return NextResponse.json({ success: true });
  })
);
