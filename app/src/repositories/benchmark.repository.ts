import { db } from '@/db/client';
import { benchmarkDemographics, users, transactions, userDemographics } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface PeerBenchmarkCategoryResult {
  category: string;
  userAmount: number;
  p50Amount: number;
  p90Amount: number;
  percentileScore: number;
}

export interface UserBenchmarkProfile {
  optedIn: boolean;
  ageTier: string;
  region: string;
  householdSize?: string;
}

export class BenchmarkRepository {
  /**
   * Get user benchmark profile from the canonical source (userDemographics),
   * with read-only fallback to legacy users columns for backward compat.
   */
  static async getUserBenchmarkProfile(userId: number): Promise<UserBenchmarkProfile> {
    // Primary source: userDemographics table
    const [demo] = await db
      .select()
      .from(userDemographics)
      .where(eq(userDemographics.userId, userId));

    if (demo) {
      return {
        optedIn: true,
        ageTier: demo.ageBracket,
        region: demo.regionBracket,
        householdSize: demo.householdSizeBracket,
      };
    }

    // Legacy fallback (read-only, deprecated): users table columns
    const [user] = await db
      .select({
        benchmarkOptIn: users.benchmarkOptIn,
        demographicAgeTier: users.demographicAgeTier,
        demographicRegion: users.demographicRegion,
      })
      .from(users)
      .where(eq(users.id, userId));

    return {
      optedIn: Boolean(user?.benchmarkOptIn),
      ageTier: user?.demographicAgeTier || '25-34',
      region: user?.demographicRegion || 'GLOBAL',
    };
  }

  /**
   * Alias for saveUserBenchmarkProfile / updateUserBenchmarkProfile for backward compatibility.
   */
  static async updateUserBenchmarkProfile(
    userId: number,
    data: { benchmarkOptIn?: number; demographicAgeTier?: string; demographicRegion?: string; ageBracket?: string; householdSizeBracket?: string; regionBracket?: string }
  ) {
    const ageBracket = data.ageBracket || data.demographicAgeTier || '25-34';
    const regionBracket = data.regionBracket || data.demographicRegion || 'GLOBAL';
    const householdSizeBracket = data.householdSizeBracket || '1-2';

    if (data.benchmarkOptIn === 0) {
      return this.removeOptIn(userId);
    }

    return this.saveUserBenchmarkProfile(userId, {
      ageBracket,
      householdSizeBracket,
      regionBracket,
    });
  }
  static async saveUserBenchmarkProfile(
    userId: number,
    data: { ageBracket: string; householdSizeBracket: string; regionBracket: string }
  ) {
    const existing = await db
      .select()
      .from(userDemographics)
      .where(eq(userDemographics.userId, userId));

    if (existing.length > 0) {
      await db
        .update(userDemographics)
        .set({
          ageBracket: data.ageBracket,
          householdSizeBracket: data.householdSizeBracket,
          regionBracket: data.regionBracket,
          optedInAt: new Date().toISOString(),
        })
        .where(eq(userDemographics.userId, userId));
    } else {
      await db.insert(userDemographics).values({
        userId,
        ageBracket: data.ageBracket,
        householdSizeBracket: data.householdSizeBracket,
        regionBracket: data.regionBracket,
      });
    }

    // Keep legacy columns in sync during deprecation period
    await db
      .update(users)
      .set({
        benchmarkOptIn: 1,
        demographicAgeTier: data.ageBracket,
        demographicRegion: data.regionBracket,
      })
      .where(eq(users.id, userId));
  }

  /** Remove opt-in (both tables) */
  static async removeOptIn(userId: number) {
    await db.delete(userDemographics).where(eq(userDemographics.userId, userId));
    await db
      .update(users)
      .set({ benchmarkOptIn: 0 })
      .where(eq(users.id, userId));
  }

  /** Calculate anonymous peer benchmark comparison for user spending */
  static async getPeerBenchmarks(
    userId: number,
    filters?: { ageTier?: string; regionCode?: string; incomeBracket?: string }
  ) {
    const userProfile = await this.getUserBenchmarkProfile(userId);
    const ageTier = filters?.ageTier || userProfile.ageTier || '25-34';
    const regionCode = filters?.regionCode || userProfile.region || 'GLOBAL';
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

    // Save monthly snapshot if user is opted in
    if (userProfile.optedIn) {
      const yearMonth = new Date().toISOString().substring(0, 7);
      await this.saveCategoryPercentileSnapshots(userId, yearMonth, results);
    }

    return {
      cohort: { ageTier, regionCode, incomeBracket },
      overallFinancialStandingScore: overallScore,
      optInStatus: userProfile.optedIn,
      categoryBenchmarks: results,
    };
  }

  /**
   * Save category percentile snapshots for a given month.
   */
  static async saveCategoryPercentileSnapshots(
    userId: number,
    yearMonth: string,
    results: PeerBenchmarkCategoryResult[]
  ) {
    const { categoryPercentileSnapshots } = await import('@/db/schema');

    // Delete existing snapshot for this month to maintain idempotency
    await db
      .delete(categoryPercentileSnapshots)
      .where(
        and(
          eq(categoryPercentileSnapshots.userId, userId),
          eq(categoryPercentileSnapshots.yearMonth, yearMonth)
        )
      );

    for (const r of results) {
      await db.insert(categoryPercentileSnapshots).values({
        userId,
        yearMonth,
        category: r.category,
        userSpent: r.userAmount,
        p50Spent: r.p50Amount,
        p90Spent: r.p90Amount,
        percentileRank: r.percentileScore,
      });
    }
  }

  /**
   * Get category percentile snapshots history for a user.
   */
  static async getCategoryPercentileSnapshots(userId: number, yearMonth?: string) {
    const { categoryPercentileSnapshots } = await import('@/db/schema');
    const ym = yearMonth || new Date().toISOString().substring(0, 7);

    return db
      .select()
      .from(categoryPercentileSnapshots)
      .where(
        and(
          eq(categoryPercentileSnapshots.userId, userId),
          eq(categoryPercentileSnapshots.yearMonth, ym)
        )
      );
  }
}
