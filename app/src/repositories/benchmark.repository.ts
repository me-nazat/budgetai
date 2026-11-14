import { db } from '@/db/client';
import { benchmarkDemographics, users, transactions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface PeerBenchmarkCategoryResult {
  category: string;
  userAmount: number;
  p50Amount: number;
  p90Amount: number;
  percentileScore: number;
}

export class BenchmarkRepository {
  /** Get user benchmark settings */
  static async getUserBenchmarkProfile(userId: number) {
    const [user] = await db
      .select({
        benchmarkOptIn: users.benchmarkOptIn,
        demographicAgeTier: users.demographicAgeTier,
        demographicRegion: users.demographicRegion,
      })
      .from(users)
      .where(eq(users.id, userId));
    return user || { benchmarkOptIn: 0, demographicAgeTier: '25-34', demographicRegion: 'GLOBAL' };
  }

  /** Update user benchmark settings */
  static async updateUserBenchmarkProfile(
    userId: number,
    data: { benchmarkOptIn?: number; demographicAgeTier?: string; demographicRegion?: string }
  ) {
    const [updated] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  /** Calculate anonymous peer benchmark comparison for user spending */
  static async getPeerBenchmarks(
    userId: number,
    filters?: { ageTier?: string; regionCode?: string; incomeBracket?: string }
  ) {
    const userProfile = await this.getUserBenchmarkProfile(userId);
    const ageTier = filters?.ageTier || userProfile.demographicAgeTier || '25-34';
    const regionCode = filters?.regionCode || userProfile.demographicRegion || 'GLOBAL';
    const incomeBracket = filters?.incomeBracket || 'MEDIAN';

    // 1. Calculate user's category spending for current month
    const userCategorySpending = await db
      .select({
        category: transactions.category,
        totalSpent: sql<number>`SUM(${transactions.amount})`,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.type, 'expense')))
      .groupBy(transactions.category);

    const userMap = new Map<string, number>();
    userCategorySpending.forEach((row) => {
      userMap.set(row.category, Math.abs(row.totalSpent || 0));
    });

    // 2. Fetch demographic benchmarks
    const benchmarks = await db
      .select()
      .from(benchmarkDemographics)
      .where(
        and(
          eq(benchmarkDemographics.ageTier, ageTier),
          eq(benchmarkDemographics.regionCode, regionCode)
        )
      );

    // Default peer benchmark baseline if DB seed is empty
    const categories = ['Food & Dining', 'Housing & Rent', 'Transportation', 'Shopping', 'Entertainment', 'Utilities'];

    const benchmarkMap = new Map<string, { p50: number; p90: number }>();
    benchmarks.forEach((b) => {
      benchmarkMap.set(b.category, { p50: b.p50Amount, p90: b.p90Amount });
    });

    // Fallbacks for standard categories
    const defaultBaselines: Record<string, { p50: number; p90: number }> = {
      'Food & Dining': { p50: 450, p90: 850 },
      'Housing & Rent': { p50: 1200, p90: 2200 },
      'Transportation': { p50: 250, p90: 600 },
      'Shopping': { p50: 300, p90: 750 },
      'Entertainment': { p50: 150, p90: 400 },
      'Utilities': { p50: 200, p90: 450 },
    };

    const results: PeerBenchmarkCategoryResult[] = categories.map((cat) => {
      const userAmount = userMap.get(cat) || 0;
      const bm = benchmarkMap.get(cat) || defaultBaselines[cat] || { p50: 300, p90: 700 };

      // Calculate percentile score (lower spending relative to p50/p90 = higher score out of 100)
      let percentileScore = 80;
      if (userAmount <= bm.p50) {
        percentileScore = 85 + Math.round(((bm.p50 - userAmount) / bm.p50) * 15);
      } else if (userAmount <= bm.p90) {
        percentileScore = 50 + Math.round(((bm.p90 - userAmount) / (bm.p90 - bm.p50)) * 35);
      } else {
        percentileScore = Math.max(10, 50 - Math.round(((userAmount - bm.p90) / bm.p90) * 40));
      }

      return {
        category: cat,
        userAmount,
        p50Amount: bm.p50,
        p90Amount: bm.p90,
        percentileScore: Math.min(100, Math.max(0, percentileScore)),
      };
    });

    const overallScore = Math.round(
      results.reduce((acc, curr) => acc + curr.percentileScore, 0) / (results.length || 1)
    );

    return {
      cohort: { ageTier, regionCode, incomeBracket },
      overallFinancialStandingScore: overallScore,
      optInStatus: Boolean(userProfile.benchmarkOptIn),
      categoryBenchmarks: results,
    };
  }
}
