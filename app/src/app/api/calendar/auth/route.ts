export const dynamic = 'force-dynamic';

/**
 * @fileoverview Google Calendar OAuth helper route.
 *
 * GET /api/calendar/auth — Redirects or returns auth status for Google Calendar scope.
 *
 * @module api/calendar/auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryOne } from '@/lib/db';

export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    const user = await queryOne<{ google_calendar_token?: string }>(
      'SELECT google_calendar_token FROM users WHERE id = ?',
      [userId]
    );

    const isConnected = Boolean(user?.google_calendar_token);

    return NextResponse.json({
      isConnected,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      message: isConnected ? 'Google Calendar connected' : 'Google Calendar scope requires OAuth approval',
    });
  })
);
