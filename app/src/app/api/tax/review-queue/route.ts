export const dynamic = 'force-dynamic';

/**
 * @fileoverview Module 12: AI-Assisted Deduction Review Queue API.
 * Identifies deductible candidates, fetches AI suggestions via Gemini,
 * and handles swipe-right (verify) and swipe-left (reject) operations.
 *
 * GET /api/tax/review-queue — Retrieve candidate queue with AI classifications
 * POST /api/tax/review-queue — Verify or reject candidate deduction
 *
 * @module api/tax/review-queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { db } from '@/db/client';
import { transactions, taxDeductions, taxCategories } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { generateGeminiResponse } from '@/lib/ai';
import { encryptNumber, decryptNumber } from '@/lib/crypto/encryption';

const DEDUCTIBLE_KEYWORDS = /aws|amazon web services|github|vercel|jetbrains|adobe|google cloud|openai|software|saas|api|hosting|server|laptop|apple|dell|monitor|hardware|office|desk|chair|stationery|supplies|flight|hotel|airbnb|delta|united|airline|uber|lyft|taxi|travel|conference|seminar|course|book|training|internet|wifi|phone|zoom|slack|domain|notion|figma/i;

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    // 1. Fetch tax categories
    let categories = await db.select().from(taxCategories);
    if (categories.length === 0) {
      // Seed default IRS categories if empty
      const defaultCategories = [
        { id: 'taxcat_sch_c_software', code: 'SOFTWARE_100', name: 'Schedule C — Software & Cloud Tools', deductiblePercentage: 1.0, jurisdiction: 'US_IRS' },
        { id: 'taxcat_sch_c_office', code: 'SCH_C_OFFICE', name: 'Schedule C — Office Supplies & Hardware', deductiblePercentage: 1.0, jurisdiction: 'US_IRS' },
        { id: 'taxcat_sch_c_travel', code: 'SCH_C_TRAVEL', name: 'Schedule C — Business Travel', deductiblePercentage: 1.0, jurisdiction: 'US_IRS' },
        { id: 'taxcat_sch_c_meals', code: 'MEALS_50', name: 'Schedule C — Business Meals (50%)', deductiblePercentage: 0.5, jurisdiction: 'US_IRS' },
        { id: 'taxcat_sch_c_utilities', code: 'SCH_C_UTILITIES', name: 'Schedule C — Home Office Utilities', deductiblePercentage: 0.3, jurisdiction: 'US_IRS' },
      ];
      for (const cat of defaultCategories) {
        await db.insert(taxCategories).values(cat).onConflictDoNothing();
      }
      categories = await db.select().from(taxCategories);
    }

    // 2. Fetch candidate transactions not yet in taxDeductions
    const candidateRows = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        encryptedAmount: transactions.encryptedAmount,
        description: transactions.description,
        encryptedDescription: transactions.encryptedDescription,
        category: transactions.category,
        date: transactions.date,
        type: transactions.type,
        taxSuggested: transactions.taxSuggested,
        existingDeductionId: taxDeductions.id,
      })
      .from(transactions)
      .leftJoin(taxDeductions, eq(transactions.id, taxDeductions.transactionId))
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense'),
          isNull(taxDeductions.id)
        )
      )
      .orderBy(desc(transactions.date))
      .limit(60);

    // Filter candidate list: taxSuggested === 1 or description/category matches deductible patterns
    const candidates = candidateRows.filter((t) => {
      if (t.taxSuggested === 1) return true;
      if (t.taxSuggested === -1) return false; // user previously rejected
      const textToMatch = `${t.description} ${t.category}`;
      return DEDUCTIBLE_KEYWORDS.test(textToMatch);
    }).slice(0, 15);

    if (candidates.length === 0) {
      return apiSuccess({ items: [], totalCandidates: 0 });
    }

    // 3. AI classification batch via generateGeminiResponse()
    const prompt = `You are a certified tax accountant assistant. Given these candidate business expense transactions:
${candidates.map((c) => `- [ID:${c.id}] Description: "${c.description}", Category: "${c.category}", Amount: $${c.amount}`).join('\n')}

Available Tax Categories:
${categories.map((cat) => `- ID: "${cat.id}", Name: "${cat.name}", Deductible: ${cat.deductiblePercentage * 100}%`).join('\n')}

Classify each transaction into the best fitting tax category ID.
Respond strictly in JSON format as an array:
[{"id": <number>, "taxCategoryId": "<id>", "deductiblePercentage": <number between 0 and 1>, "reason": "<brief justification>"}]`;

    let aiSuggestions: Record<number, { taxCategoryId: string; deductiblePercentage: number; reason: string }> = {};

    try {
      const aiRaw = await generateGeminiResponse(prompt);
      const jsonMatch = aiRaw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item.id && item.taxCategoryId) {
              aiSuggestions[Number(item.id)] = {
                taxCategoryId: item.taxCategoryId,
                deductiblePercentage: Number(item.deductiblePercentage) || 1.0,
                reason: item.reason || 'AI categorized as eligible business deduction',
              };
            }
          });
        }
      }
    } catch {
      // Heuristic fallback will populate below
    }

    // 4. Build output with heuristic fallback if AI did not return a category
    const items = candidates.map((c) => {
      let amount = c.amount;
      if (c.encryptedAmount) {
        try {
          amount = decryptNumber(c.encryptedAmount, 'amount');
        } catch {}
      }

      const aiMatch = aiSuggestions[c.id];
      let selectedCat = categories.find((cat) => cat.id === aiMatch?.taxCategoryId);

      if (!selectedCat) {
        // Deterministic heuristic fallback
        const descLower = c.description.toLowerCase();
        if (/aws|software|cloud|github|vercel|jetbrains|openai/i.test(descLower)) {
          selectedCat = categories.find((cat) => cat.id === 'taxcat_sch_c_software') || categories[0];
        } else if (/hotel|flight|airline|delta|uber|lyft/i.test(descLower)) {
          selectedCat = categories.find((cat) => cat.id === 'taxcat_sch_c_travel') || categories[0];
        } else if (/meal|dinner|lunch|restaurant|food/i.test(descLower)) {
          selectedCat = categories.find((cat) => cat.id === 'taxcat_sch_c_meals') || categories[0];
        } else {
          selectedCat = categories.find((cat) => cat.id === 'taxcat_sch_c_office') || categories[0];
        }
      }

      const deductiblePct = aiMatch?.deductiblePercentage ?? selectedCat.deductiblePercentage ?? 1.0;
      const estimatedDeductibleAmount = Math.round(amount * deductiblePct * 100) / 100;

      return {
        id: c.id,
        transactionId: c.id,
        description: c.description || c.category,
        amount,
        date: c.date,
        originalCategory: c.category,
        suggestedTaxCategoryId: selectedCat.id,
        suggestedTaxCategoryName: selectedCat.name,
        deductiblePercentage: deductiblePct,
        estimatedDeductibleAmount,
        aiReason: aiMatch?.reason || `Matches business ${selectedCat.name.split('—')[1]?.trim() || 'expense'} pattern`,
      };
    });

    return apiSuccess({
      items,
      totalCandidates: items.length,
      categories,
    });
  }),
  { rateLimit: 'api' }
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { transactionId, action, taxCategoryId, eligibleAmount, notes } = body;

    if (!transactionId || (action !== 'verify' && action !== 'reject')) {
      return apiError(new ValidationError('Invalid review queue payload', ErrorCode.INVALID_INPUT));
    }

    if (action === 'reject') {
      // Mark as rejected so it won't appear in the queue again
      await db.insert(taxDeductions).values({
        id: uuidv4(),
        userId,
        transactionId: Number(transactionId),
        taxCategoryId: taxCategoryId || 'taxcat_sch_c_office',
        eligibleAmount: eligibleAmount || 0,
        deductibleAmount: 0,
        status: 'REJECTED',
        notes: notes || 'Rejected in AI deduction review queue',
      }).onConflictDoUpdate({
        target: taxDeductions.transactionId,
        set: { status: 'REJECTED' },
      });

      return apiSuccess({ message: 'Transaction rejected from tax deductions' });
    }

    // Action: 'verify'
    if (!taxCategoryId || typeof eligibleAmount !== 'number' || eligibleAmount <= 0) {
      return apiError(new ValidationError('Valid tax category and eligible amount required to verify', ErrorCode.INVALID_INPUT));
    }

    // Look up category deductible percentage
    const [cat] = await db
      .select()
      .from(taxCategories)
      .where(eq(taxCategories.id, taxCategoryId))
      .limit(1);

    const pct = cat?.deductiblePercentage ?? 1.0;
    const deductibleAmount = Math.round(eligibleAmount * pct * 100) / 100;

    let encryptedEligibleAmount: string | null = null;
    let encryptedDeductibleAmount: string | null = null;

    try {
      encryptedEligibleAmount = encryptNumber(eligibleAmount, 'amount');
      encryptedDeductibleAmount = encryptNumber(deductibleAmount, 'amount');
    } catch {}

    const deductionId = uuidv4();

    await db.insert(taxDeductions).values({
      id: deductionId,
      userId,
      transactionId: Number(transactionId),
      taxCategoryId,
      eligibleAmount,
      deductibleAmount,
      encryptedEligibleAmount,
      encryptedDeductibleAmount,
      status: 'VERIFIED',
      notes: notes || 'Verified in AI review queue',
    }).onConflictDoUpdate({
      target: taxDeductions.transactionId,
      set: {
        taxCategoryId,
        eligibleAmount,
        deductibleAmount,
        encryptedEligibleAmount,
        encryptedDeductibleAmount,
        status: 'VERIFIED',
      },
    });

    return apiSuccess({
      deductionId,
      transactionId,
      taxCategoryId,
      eligibleAmount,
      deductibleAmount,
      status: 'VERIFIED',
    });
  }),
  { rateLimit: 'apiStrict' }
);
