export const dynamic = 'force-dynamic';

/**
 * @fileoverview Granular consent management for peer benchmarking.
 * Feature 11.1: Demographic Opt-In Wizard & Granular Consent.
 *
 * GET    /api/benchmarking/consent — Check opt-in and active granular consents
 * POST   /api/benchmarking/consent — Save demographic onboarding & grant metric consents
 * DELETE /api/benchmarking/consent — Withdraw consent (all metrics or single metric)
 *
 * @module api/benchmarking/consent
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  userDemographics,
  module21UserBenchmarkConsents,
} from '@/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';
import crypto from 'crypto';

const SaveConsentSchema = z.object({
  ageBracket: z.enum(['18-24', '25-34', '35-44', '45-54', '55-64', '65+']),
  regionCode: z.string().min(2).max(20).default('GLOBAL'),
  incomeBracket: z.enum(['0-30k', '30k-60k', '60k-100k', '100k-150k', '150k+']),
  employmentSector: z.string().max(100).optional(),
  metrics: z.array(z.enum(['SAVINGS_RATE', 'NET_WORTH', 'EMERGENCY_FUND_MONTHS', 'CATEGORY_SPEND'])).min(1),
});

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const [demo] = await db
      .select()
      .from(userDemographics)
      .where(eq(userDemographics.userId, userId))
      .limit(1);

    const consents = await db
      .select()
      .from(module21UserBenchmarkConsents)
      .where(
        and(
          eq(module21UserBenchmarkConsents.userId, userId),
          isNull(module21UserBenchmarkConsents.revokedAt)
        )
      );

    return NextResponse.json({
      isOptedIn: Boolean(demo && demo.isOptedIn === 1),
      demographics: demo || null,
      activeMetrics: consents.map((c) => c.metricKey),
    });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const parsed = SaveConsentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const { ageBracket, regionCode, incomeBracket, employmentSector, metrics } = parsed.data;

    // Upsert user demographics
    const [existingDemo] = await db
      .select()
      .from(userDemographics)
      .where(eq(userDemographics.userId, userId))
      .limit(1);

    if (existingDemo) {
      await db
        .update(userDemographics)
        .set({
          ageBracket,
          regionCode,
          incomeBracket,
          employmentSector: employmentSector || existingDemo.employmentSector,
          isOptedIn: 1,
          updatedAt: sql`(unixepoch())`,
        })
        .where(eq(userDemographics.userId, userId));
    } else {
      await db.insert(userDemographics).values({
        userId,
        ageBracket,
        regionCode,
        incomeBracket,
        employmentSector,
        isOptedIn: 1,
      });
    }

    // Grant metric consents
    const now = Math.floor(Date.now() / 1000);
    for (const metric of metrics) {
      const [existingConsent] = await db
        .select()
        .from(module21UserBenchmarkConsents)
        .where(
          and(
            eq(module21UserBenchmarkConsents.userId, userId),
            eq(module21UserBenchmarkConsents.metricKey, metric)
          )
        )
        .limit(1);

      if (existingConsent) {
        await db
          .update(module21UserBenchmarkConsents)
          .set({ revokedAt: null, grantedAt: now })
          .where(eq(module21UserBenchmarkConsents.id, existingConsent.id));
      } else {
        await db.insert(module21UserBenchmarkConsents).values({
          id: `consent_${crypto.randomUUID()}`,
          userId,
          metricKey: metric,
          grantedAt: now,
          revokedAt: null,
        });
      }
    }

    return NextResponse.json({ success: true, isOptedIn: true, metrics });
  })
);

export const DELETE = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const metricKey = url.searchParams.get('metricKey');
    const now = Math.floor(Date.now() / 1000);

    if (metricKey) {
      // Revoke single metric
      await db
        .update(module21UserBenchmarkConsents)
        .set({ revokedAt: now })
        .where(
          and(
            eq(module21UserBenchmarkConsents.userId, userId),
            eq(module21UserBenchmarkConsents.metricKey, metricKey)
          )
        );

      return NextResponse.json({ success: true, revokedMetric: metricKey });
    }

    // Complete withdrawal from benchmarks
    await db
      .update(userDemographics)
      .set({ isOptedIn: 0, updatedAt: sql`(unixepoch())` })
      .where(eq(userDemographics.userId, userId));

    await db
      .update(module21UserBenchmarkConsents)
      .set({ revokedAt: now })
      .where(eq(module21UserBenchmarkConsents.userId, userId));

    return NextResponse.json({ success: true, isOptedIn: false, message: 'All benchmark sharing revoked' });
  })
);
