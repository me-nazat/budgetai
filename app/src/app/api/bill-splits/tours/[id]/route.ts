import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { tourGroups, tourParticipants } from '@/db/schema/bill-splits';
import { transactions } from '@/db/schema/transactions';
import { eq, and } from 'drizzle-orm';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { decryptField } from '@/lib/crypto/encryption';

export const GET = apiHandler(
    withAuth(async (_req: NextRequest, { userId }, { params }: { params: { id: string } }) => {
        const tourId = parseInt(params.id, 10);
        
        const [tour] = await db.select().from(tourGroups).where(and(eq(tourGroups.id, tourId), eq(tourGroups.userId, userId)));
        if (!tour) return NextResponse.json({ success: false, error: 'Tour not found' }, { status: 404 });

        const participantsList = await db.select().from(tourParticipants).where(eq(tourParticipants.tourId, tourId));
        
        const txs = await db.select().from(transactions).where(and(eq(transactions.tourId, tourId), eq(transactions.userId, userId)));
        
        const decryptedTxs = txs.map(tx => ({
            ...tx,
            amount: tx.amount !== null ? tx.amount : parseFloat(decryptField(tx.encryptedAmount as string) || '0'),
            description: tx.description !== null ? tx.description : decryptField(tx.encryptedDescription as string)
        }));

        return NextResponse.json({ success: true, tour, participants: participantsList, transactions: decryptedTxs });
    })
);
