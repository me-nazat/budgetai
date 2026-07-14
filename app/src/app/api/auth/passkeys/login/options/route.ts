export const dynamic = 'force-dynamic';

import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { UserRepository } from '@/repositories/user.repository';
import { cookies } from 'next/headers';
import { apiHandler } from '@/lib/middleware/api-handler';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/passkeys/login/options
 *
 * Generates WebAuthn authentication options.
 * Allows passwordless login using resident keys/discoverable credentials.
 * Stores the authentication challenge in an HTTP-only cookie.
 */
export const POST = apiHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const { email } = body;

  let allowCredentials: any[] = [];
  if (email) {
    const user = await UserRepository.findByEmail(email);
    if (user) {
      const passkeys = await UserRepository.listPasskeys(user.id);
      allowCredentials = passkeys.map((p) => ({
        id: Buffer.from(p.credentialId, 'base64url'),
        type: 'public-key' as const,
        transports: p.transports ? JSON.parse(p.transports) : undefined,
      }));
    }
  }

  const host = request.headers.get('host') || 'localhost';
  const rpID = host.split(':')[0];

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: 'preferred',
  });

  const cookieStore = await cookies();
  cookieStore.set('wai-passkey-auth-challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && !rpID.includes('localhost'),
    sameSite: 'strict',
    maxAge: 300, // 5 minutes
    path: '/',
  });

  return NextResponse.json(options);
});
