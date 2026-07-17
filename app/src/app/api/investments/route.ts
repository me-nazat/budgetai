export const dynamic = 'force-dynamic';

/**
 * @fileoverview Investment holdings API.
 *
 * GET — List all holdings for the authenticated user + live prices
 * POST — Create a new holding
 * PUT — Update an existing holding
 * DELETE — Delete a holding
 *
 * @module api/investments
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { InvestmentsRepository } from '@/repositories/investments.repository';

const CreateSchema = z.object({
  assetType: z.enum(['stock', 'etf', 'crypto', 'bond', 'mutual_fund', 'other']),
  ticker: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  quantity: z.number().positive(),
  avgCostBasis: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  notes: z.string().max(500).optional(),
});

const UpdateSchema = z.object({
  id: z.number().int().positive(),
  assetType: z.enum(['stock', 'etf', 'crypto', 'bond', 'mutual_fund', 'other']).optional(),
  ticker: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(200).optional(),
  quantity: z.number().positive().optional(),
  avgCostBasis: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(500).nullable().optional(),
});

const DeleteSchema = z.object({
  id: z.number().int().positive(),
});

/**
 * In-memory price cache (Map<ticker, { price, timestamp }>).
 * TTL: 5 minutes.
 */
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_TTL = 5 * 60 * 1000;

async function fetchLivePrice(ticker: string, assetType: string): Promise<number | null> {
  const cached = priceCache.get(ticker);
  if (cached && Date.now() - cached.timestamp < PRICE_TTL) {
    return cached.price;
  }

  try {
    if (assetType === 'crypto') {
      // CoinGecko simple price API
      const id = ticker.toLowerCase().replace('-usd', '').replace('-USD', '');
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        const price = data[id]?.usd;
        if (price) {
          priceCache.set(ticker, { price, timestamp: Date.now() });
          return price;
        }
      }
    } else {
      // Yahoo Finance v8 quote API
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price) {
          priceCache.set(ticker, { price, timestamp: Date.now() });
          return price;
        }
      }
    }
  } catch {
    // Price fetch failed — return null (UI will show "N/A")
  }
  return null;
}

/**
 * GET /api/investments
 * Returns all holdings with live prices.
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    const holdings = await InvestmentsRepository.listByUser(userId);
    const stats = await InvestmentsRepository.getPortfolioStats(userId);

    // Fetch live prices in parallel
    const withPrices = await Promise.all(
      holdings.map(async (h) => {
        const livePrice = await fetchLivePrice(h.ticker, h.assetType);
        const costBasis = h.quantity * h.avgCostBasis;
        const currentValue = livePrice ? h.quantity * livePrice : null;
        const gainLoss = currentValue !== null ? currentValue - costBasis : null;
        const gainLossPercent = gainLoss !== null && costBasis > 0
          ? (gainLoss / costBasis) * 100
          : null;

        return {
          ...h,
          livePrice,
          costBasis,
          currentValue,
          gainLoss,
          gainLossPercent,
        };
      })
    );

    const totalCurrentValue = withPrices.reduce((sum, h) => sum + (h.currentValue || h.costBasis), 0);
    const totalGainLoss = totalCurrentValue - stats.totalInvested;
    const totalGainLossPercent = stats.totalInvested > 0
      ? (totalGainLoss / stats.totalInvested) * 100
      : 0;

    return NextResponse.json({
      holdings: withPrices,
      summary: {
        totalInvested: stats.totalInvested,
        totalCurrentValue,
        totalGainLoss,
        totalGainLossPercent,
        holdingCount: stats.holdingCount,
      },
    });
  })
);

/**
 * POST /api/investments
 * Creates a new investment holding.
 */
export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const validated = CreateSchema.parse(body);

    const holding = await InvestmentsRepository.create({
      userId,
      ...validated,
    });

    return NextResponse.json(holding, { status: 201 });
  }),
  { rateLimit: 'api' }
);

/**
 * PUT /api/investments
 * Updates an existing investment holding.
 */
export const PUT = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const { id, ...data } = UpdateSchema.parse(body);

    const existing = await InvestmentsRepository.getById(userId, id);
    if (!existing) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }

    await InvestmentsRepository.update(userId, id, data);

    return NextResponse.json({ message: 'Holding updated' });
  })
);

/**
 * DELETE /api/investments
 * Deletes an investment holding.
 */
export const DELETE = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const { id } = DeleteSchema.parse(body);

    const existing = await InvestmentsRepository.getById(userId, id);
    if (!existing) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }

    await InvestmentsRepository.delete(userId, id);

    return NextResponse.json({ message: 'Holding deleted' });
  })
);
