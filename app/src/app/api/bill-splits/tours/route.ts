import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { tourGroups, tourParticipants } from '@/db/schema/bill-splits';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';

const createTourSchema = z.object({
    name: z.string().min(1, 'Tour name is required'),
    participants: z.array(z.string().min(1)).min(1, 'At least one participant required'),
});

export const GET = apiHandler(
    withAuth(async (_req: NextRequest, { userId }) => {
        const tours = await db.select().from(tourGroups).where(eq(tourGroups.userId, userId)).orderBy(desc(tourGroups.createdAt));
        
        // Fetch participants manually since we haven't defined relations() in drizzle schema
        const toursWithParticipants = await Promise.all(tours.map(async (tour) => {
            const participants = await db.select().from(tourParticipants).where(eq(tourParticipants.tourId, tour.id));
            return { ...tour, participants };
        }));

        return NextResponse.json({ success: true, tours: toursWithParticipants });
    })
);

export const POST = apiHandler(
    withAuth(async (req: NextRequest, { userId }) => {
        const body = await req.json();
        const { name, participants } = createTourSchema.parse(body);

        const newTour = await db.transaction(async (tx) => {
            const [tour] = await tx.insert(tourGroups).values({
                userId: userId,
                name
            }).returning();

            const participantData = participants.map((pName) => ({
                tourId: tour.id,
                name: pName
            }));

            await tx.insert(tourParticipants).values(participantData);
            
            const pList = await tx.select().from(tourParticipants).where(eq(tourParticipants.tourId, tour.id));
            return { ...tour, participants: pList };
        });

        return NextResponse.json({ success: true, tour: newTour });
    })
);
