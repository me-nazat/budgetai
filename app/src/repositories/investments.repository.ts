/**
 * @fileoverview Investment holdings repository.
 *
 * Data access layer for the `investment_holdings` table.
 *
 * @module repositories/investments.repository
 */

import { db } from '@/db/client';
import { investmentHoldings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export class InvestmentsRepository {
  /**
   * Gets all holdings for a user.
   */
  static async listByUser(userId: number) {
    return db
      .select()
      .from(investmentHoldings)
      .where(eq(investmentHoldings.userId, userId))
      .orderBy(investmentHoldings.ticker);
  }

  /**
   * Gets a single holding by ID, scoped to user.
   */
  static async getById(userId: number, id: number) {
    const results = await db
      .select()
      .from(investmentHoldings)
      .where(
        and(
          eq(investmentHoldings.id, id),
          eq(investmentHoldings.userId, userId)
        )
      )
      .limit(1);
    return results[0] || null;
  }

  /**
   * Creates a new holding.
   */
  static async create(data: {
    userId: number;
    assetType: 'stock' | 'etf' | 'crypto' | 'bond' | 'mutual_fund' | 'other';
    ticker: string;
    name: string;
    quantity: number;
    avgCostBasis: number;
    currency?: string;
    notes?: string;
  }) {
    const result = await db
      .insert(investmentHoldings)
      .values({
        userId: data.userId,
        assetType: data.assetType,
        ticker: data.ticker.toUpperCase(),
        name: data.name,
        quantity: data.quantity,
        avgCostBasis: data.avgCostBasis,
        currency: data.currency || 'USD',
        notes: data.notes || null,
      })
      .returning();
    return result[0];
  }

  /**
   * Updates an existing holding.
   */
  static async update(
    userId: number,
    id: number,
    data: Partial<{
      assetType: 'stock' | 'etf' | 'crypto' | 'bond' | 'mutual_fund' | 'other';
      ticker: string;
      name: string;
      quantity: number;
      avgCostBasis: number;
      currency: string;
      notes: string | null;
    }>
  ) {
    const updated = {
      ...data,
      ticker: data.ticker?.toUpperCase(),
      updatedAt: new Date().toISOString(),
    };

    await db
      .update(investmentHoldings)
      .set(updated)
      .where(
        and(
          eq(investmentHoldings.id, id),
          eq(investmentHoldings.userId, userId)
        )
      );
  }

  /**
   * Deletes a holding.
   */
  static async delete(userId: number, id: number) {
    await db
      .delete(investmentHoldings)
      .where(
        and(
          eq(investmentHoldings.id, id),
          eq(investmentHoldings.userId, userId)
        )
      );
  }

  /**
   * Gets aggregate portfolio stats (total invested, count).
   */
  static async getPortfolioStats(userId: number) {
    const result = await db
      .select({
        totalInvested: sql<number>`SUM(${investmentHoldings.quantity} * ${investmentHoldings.avgCostBasis})`,
        holdingCount: sql<number>`COUNT(*)`,
      })
      .from(investmentHoldings)
      .where(eq(investmentHoldings.userId, userId));

    return {
      totalInvested: result[0]?.totalInvested || 0,
      holdingCount: result[0]?.holdingCount || 0,
    };
  }
}
