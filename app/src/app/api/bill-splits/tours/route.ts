import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from "@/lib/middleware/api-handler";
import { withAuth } from "@/lib/middleware/with-auth";
import { queryAll, run } from '@/lib/db';
import { TourGroupSchema } from '@/lib/validation';

export const GET = apiHandler(
    withAuth(async (request: NextRequest, { userId }) => {
        const tours = await queryAll(
            'SELECT * FROM tour_groups WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        return NextResponse.json({ tours });
    })
);

export const POST = apiHandler(
    withAuth(async (request: NextRequest, { userId }) => {
        const body = await request.json();
        const data = TourGroupSchema.parse(body);

        // Create Tour Group
        const tourResult = await run(
            'INSERT INTO tour_groups (user_id, name) VALUES (?, ?)',
            [userId, data.name]
        );
        const tourId = tourResult.lastInsertRowid;

        // Create Participants
        for (const p of data.participants) {
            await run(
                'INSERT INTO tour_participants (tour_id, name) VALUES (?, ?)',
                [tourId, p.name]
            );
        }

        return NextResponse.json({ success: true, tourId });
    })
);
