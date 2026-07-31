export const dynamic = 'force-dynamic';

/**
 * @fileoverview Google Calendar OAuth callback route.
 *
 * GET /api/calendar/auth/callback — Handles the OAuth redirect from Google.
 * Exchanges the authorization code for tokens and stores them in calendarSyncTokens.
 *
 * @security
 * - State parameter carries the userId to link the token to the correct user.
 * - Tokens are stored server-side; no OAuth secrets reach the client.
 *
 * @module api/calendar/auth/callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { CalendarRepository } from '@/repositories/calendar.repository';

/**
 * GET /api/calendar/auth/callback?code=...&state=userId
 *
 * Google redirects here after user consents. We exchange the code for tokens.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // User denied access
  if (error) {
    return NextResponse.redirect(new URL('/settings?calendar=denied', request.url));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?calendar=error', request.url));
  }

  const userId = parseInt(state, 10);
  if (isNaN(userId) || userId <= 0) {
    return NextResponse.redirect(new URL('/settings?calendar=error', request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    console.error('[calendar/callback] Missing Google OAuth env vars');
    return NextResponse.redirect(new URL('/settings?calendar=error', request.url));
  }

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      console.error('[calendar/callback] Incomplete token response from Google');
      return NextResponse.redirect(new URL('/settings?calendar=error', request.url));
    }

    // Store tokens in calendarSyncTokens table
    await CalendarRepository.saveToken({
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      calendarId: 'primary',
      expiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    return NextResponse.redirect(new URL('/settings?calendar=connected', request.url));
  } catch (err) {
    console.error('[calendar/callback] Token exchange failed:', err);
    return NextResponse.redirect(new URL('/settings?calendar=error', request.url));
  }
}
