export const dynamic = 'force-dynamic';

/**
 * @fileoverview Google Calendar OAuth route.
 *
 * GET /api/calendar/auth — Returns connection status from calendarSyncTokens table.
 * POST /api/calendar/auth — Initiates OAuth flow by returning the Google consent URL.
 * DELETE /api/calendar/auth — Disconnects Google Calendar (removes tokens).
 *
 * @module api/calendar/auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { CalendarRepository } from '@/repositories/calendar.repository';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

/**
 * Creates a configured OAuth2 client.
 * Returns null if required env vars are missing (graceful degradation).
 */
function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * GET — Check Google Calendar connection status.
 *
 * Reads from calendarSyncTokens table (not the nonexistent users.google_calendar_token column).
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    const token = await CalendarRepository.getToken(userId);
    const isConnected = Boolean(token);

    return NextResponse.json({
      isConnected,
      calendarId: token?.calendarId || null,
      scope: SCOPES[0],
      message: isConnected
        ? 'Google Calendar connected'
        : 'Google Calendar scope requires OAuth approval',
    });
  })
);

/**
 * POST — Initiate OAuth flow. Returns the Google consent URL.
 */
export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    const oauth2Client = createOAuth2Client();

    if (!oauth2Client) {
      return NextResponse.json(
        { error: 'Google Calendar integration is not configured. Missing OAuth credentials.' },
        { status: 503 }
      );
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: String(userId),
    });

    return NextResponse.json({ authUrl });
  })
);

/**
 * DELETE — Disconnect Google Calendar (remove tokens).
 */
export const DELETE = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    await CalendarRepository.removeToken(userId);
    return NextResponse.json({ success: true, message: 'Google Calendar disconnected' });
  })
);
