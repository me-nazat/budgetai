import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { transactions } from '@/db/schema/transactions';
import { tourGroups } from '@/db/schema/bill-splits';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { encryptField } from '@/lib/crypto/encryption';

const addSpendingSchema = z.object({
    amount: z.number().positive(),
    category: z.string().min(1),
    description: z.string(),
    date: z.string(),
    paidBy: z.number().positive(),
    splitType: z.enum(['equal', 'percentage', 'exact']).default('equal'),
});

export const POST = apiHandler(
    withAuth(async (req: NextRequest, { userId }, { params }: { params: { id: string } }) => {
        const tourId = parseInt(params.id, 10);
        const body = await req.json();
        const { amount, category, description, date, paidBy, splitType } = addSpendingSchema.parse(body);

        // Verify ownership
        const [tour] = await db.select().from(tourGroups).where(and(eq(tourGroups.id, tourId), eq(tourGroups.userId, userId)));
        if (!tour) return NextResponse.json({ success: false, error: 'Tour not found' }, { status: 404 });

        const encryptedAmount = encryptField(amount.toString());
        const encryptedDescription = encryptField(description);

        const [newTransaction] = await db.insert(transactions).values({
            userId: userId,
            type: 'expense',
            amount,
            encryptedAmount,
            category,
            description,
            encryptedDescription,
            date,
            tourId,
            paidBy,
            splitType
        }).returning();

        return NextResponse.json({ success: true, transaction: newTransaction });
    })
);
