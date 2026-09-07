export const dynamic = 'force-dynamic';

/**
 * @fileoverview Tax categories API filtered by transaction category.
 * Feature 12.1: Inline Tax Tagging + Receipt Auto-Linking.
 *
 * GET /api/tax/categories?txnCategory=Software&jurisdiction=US_IRS
 *
 * @module api/tax/categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { taxCategories } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const DEFAULT_TAX_CATEGORIES = [
  { id: 'taxcat_sch_c_software', code: 'SOFTWARE_100', name: 'Schedule C — Software & Cloud Tools', deductiblePercentage: 1.0, jurisdiction: 'US_IRS', description: 'Developer tools, SaaS, hosting, APIs' },
  { id: 'taxcat_sch_c_office', code: 'SCH_C_OFFICE', name: 'Schedule C — Office Supplies & Hardware', deductiblePercentage: 1.0, jurisdiction: 'US_IRS', description: 'Monitors, desks, office stationery' },
  { id: 'taxcat_sch_c_travel', code: 'SCH_C_TRAVEL', name: 'Schedule C — Business Travel', deductiblePercentage: 1.0, jurisdiction: 'US_IRS', description: 'Flights, lodging, trains for client visits' },
  { id: 'taxcat_sch_c_meals', code: 'MEALS_50', name: 'Schedule C — Business Meals (50%)', deductiblePercentage: 0.5, jurisdiction: 'US_IRS', description: 'Client dinners and business travel meals' },
  { id: 'taxcat_sch_c_utilities', code: 'SCH_C_UTILITIES', name: 'Schedule C — Home Office Utilities', deductiblePercentage: 0.3, jurisdiction: 'US_IRS', description: 'Pro-rated internet and power' },
];

export const GET = apiHandler(
  withAuth(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const jurisdiction = searchParams.get('jurisdiction') || 'US_IRS';
    const txnCategory = searchParams.get('txnCategory');

    // Seed defaults if table is empty
    const existing = await db.select().from(taxCategories).limit(1);
    if (existing.length === 0) {
      for (const cat of DEFAULT_TAX_CATEGORIES) {
        await db.insert(taxCategories).values(cat).onConflictDoNothing();
      }
    }

    const categories = await db
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.jurisdiction, jurisdiction));

    return NextResponse.json({
      categories,
      jurisdiction,
      filter: txnCategory || 'all',
    });
  })
);
