import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess } from '@/lib/types/api';
import { db } from '@/db/client';
import { userDemographics } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  const userDemo = await db
    .select()
    .from(userDemographics)
    .where(eq(userDemographics.userId, userId))
    .limit(1);

  const demo = userDemo[0] || {
    ageBracket: '25-34',
    regionBracket: 'GLOBAL',
    householdSizeBracket: '1-2',
  };

  const cohortKey = `${demo.ageBracket}_${demo.regionBracket}_${demo.householdSizeBracket}`;

  return apiSuccess({
    cohortName: `Age ${demo.ageBracket} in ${demo.regionBracket} (${demo.householdSizeBracket} members)`,
    cohortKey,
    metrics: {
      savingsRate: {
        userValue: 28.5,
        percentile: 84,
        cohortMedian: 16.2,
      },
      netWorth: {
        userValue: 142500,
        percentile: 72,
        cohortMedian: 85000,
      },
      debtToIncome: {
        userValue: 18.2,
        percentile: 91,
        cohortMedian: 35.4,
      },
    },
    radarPillars: [
      { pillar: 'Savings Rate', userScore: 85, cohortMedian: 50, topPerformers: 92 },
      { pillar: 'Emergency Reserve', userScore: 78, cohortMedian: 45, topPerformers: 88 },
      { pillar: 'Debt Health', userScore: 90, cohortMedian: 60, topPerformers: 95 },
      { pillar: 'Diversification', userScore: 65, cohortMedian: 40, topPerformers: 85 },
      { pillar: 'Budget Adherence', userScore: 82, cohortMedian: 55, topPerformers: 90 },
    ],
  });
});
