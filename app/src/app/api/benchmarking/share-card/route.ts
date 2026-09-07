export const dynamic = 'force-dynamic';

/**
 * @fileoverview Anonymous share card generator for peer benchmarks.
 * Feature 11.2: Category-Level Percentile Drill-Down & Anonymous Insights.
 *
 * POST /api/benchmarking/share-card
 * Generates an anonymous brag card (never exposes raw numbers or dollar amounts).
 *
 * @module api/benchmarking/share-card
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { module21AnonymousShareCards } from '@/db/schema';
import crypto from 'crypto';

const CreateShareCardSchema = z.object({
  snapshotId: z.number().int().optional(),
  percentileRank: z.number().min(0).max(100),
  category: z.string().optional(),
  metricKey: z.string().optional(),
});

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const parsed = CreateShareCardSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const { snapshotId, percentileRank, category, metricKey } = parsed.data;

    let claimText = '';
    if (category) {
      claimText = `My ${category} spending is more disciplined than ${Math.round(percentileRank)}% of demographic peers.`;
    } else if (metricKey === 'SAVINGS_RATE') {
      claimText = `My monthly savings rate ranks in the top ${Math.max(1, 100 - Math.round(percentileRank))}% of peers nationwide.`;
    } else {
      claimText = `I save and budget more effectively than ${Math.round(percentileRank)}% of peers in my cohort.`;
    }

    const cardId = `card_${crypto.randomUUID()}`;
    // SVG Data URI representing 1200x630 social share card
    const svgCard = `
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#022c22" />
          </linearGradient>
        </defs>
        <rect width="1200" height="630" fill="url(#bg)" />
        <text x="100" y="140" fill="#10b981" font-size="32" font-family="sans-serif" font-weight="bold">WEALTHAI ANONYMOUS BENCHMARK</text>
        <text x="100" y="270" fill="#ffffff" font-size="52" font-family="sans-serif" font-weight="900" width="1000">${claimText}</text>
        <text x="100" y="420" fill="#94a3b8" font-size="28" font-family="sans-serif">Privacy Guaranteed • Anonymous Demographically Matched Cohort (k ≥ 30)</text>
        <rect x="100" y="470" width="1000" height="18" rx="9" fill="#1e293b" />
        <rect x="100" y="470" width="${(percentileRank / 100) * 1000}" height="18" rx="9" fill="#10b981" />
      </svg>
    `.trim();

    const imageUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgCard)}`;

    await db.insert(module21AnonymousShareCards).values({
      id: cardId,
      userId,
      snapshotId: snapshotId || null,
      claimText,
      imageUrl,
    });

    return NextResponse.json({
      success: true,
      cardId,
      claimText,
      imageUrl,
      shareUrl: `/benchmarks?card=${cardId}`,
    });
  })
);
