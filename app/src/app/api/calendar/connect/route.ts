export const dynamic = 'force-dynamic';

/**
 * @fileoverview Google Calendar Connect API Route (Module 18).
 * Handles OAuth2 consent URL generation and connection status querying.
 * Rate limit: apiStrict (30 req/min).
 *
 * @module api/calendar/connect
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { CalendarRepository } from '@/repositories/calendar.repository';
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/calendar/auth/callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * GET /api/calendar/connect
 * Check Google Calendar OAuth connection status from oauthAccounts.
 */
export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const token = await CalendarRepository.getToken(userId);
    const isConnected = Boolean(token?.refreshToken || token?.accessToken);

    return NextResponse.json({
      isConnected,
      email: token?.email || null,
      calendarId: token?.calendarId || 'primary',
      scope: token?.scope || SCOPES[0],
      message: isConnected ? 'Google Calendar connected' : 'Google Calendar not connected',
    });
  }),
  { rateLimit: 'apiStrict' }
);

/**
 * POST /api/calendar/connect
 * Initiate OAuth consent flow. Returns the authUrl for user consent.
 */
export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const oauth2Client = getOAuth2Client();

    if (!oauth2Client) {
      return NextResponse.json(
        {
          error: 'Google Calendar OAuth integration is not configured in server environment.',
          configured: false,
        },
        { status: 503 }
      );
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
      state: String(userId),
    });

    return NextResponse.json({
      authUrl,
      configured: true,
    });
  }),
  { rateLimit: 'apiStrict' }
);
