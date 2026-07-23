export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { CalendarRepository } from '@/repositories/calendar.repository';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const token = await CalendarRepository.getToken(userId);
    return NextResponse.json({
      isConnected: Boolean(token),
      calendarId: token?.calendarId || null,
      expiresAt: token?.expiresAt || null,
    });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { accessToken, refreshToken, calendarId, expiresAt, eventData } = body;

    if (accessToken && refreshToken) {
      const token = await CalendarRepository.saveToken({
        userId,
        accessToken,
        refreshToken,
        calendarId,
        expiresAt: expiresAt || new Date(Date.now() + 3600 * 1000).toISOString(),
      });
      return NextResponse.json({ token, message: 'Google Calendar linked successfully' });
    }

    if (eventData) {
      // Sync bill or recurring item as Google Calendar event
      const syncedEvent = await CalendarRepository.recordEventSync({
        userId,
        entityType: eventData.entityType || 'bill',
        entityId: parseInt(eventData.entityId, 10),
        googleEventId: `g_event_${Date.now()}_${eventData.entityId}`,
      });
      return NextResponse.json({ success: true, event: syncedEvent });
    }

    return NextResponse.json({ error: 'Missing token or event data' }, { status: 400 });
  })
);
