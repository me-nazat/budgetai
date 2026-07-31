export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { CalendarRepository } from '@/repositories/calendar.repository';
import { encryptField } from '@/lib/crypto/encryption';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?error=calendar_auth_failed', request.url));
  }

  const userId = parseInt(state, 10);
  if (isNaN(userId)) {
    return NextResponse.redirect(new URL('/settings?error=invalid_user_state', request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${new URL(request.url).origin}/api/calendar/auth/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?error=missing_credentials', request.url));
  }

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    const accessToken = tokens.access_token ? encryptField(tokens.access_token) : '';
    const refreshToken = tokens.refresh_token ? encryptField(tokens.refresh_token) : accessToken;
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    await CalendarRepository.saveToken({
      userId,
      accessToken,
      refreshToken,
      calendarId: 'primary',
      expiresAt,
    });

    return NextResponse.redirect(new URL('/settings?calendar_synced=true', request.url));
  } catch {
    return NextResponse.redirect(new URL('/settings?error=calendar_token_failed', request.url));
  }
}
