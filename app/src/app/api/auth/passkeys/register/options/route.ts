export const dynamic = 'force-dynamic';

import { generateRegistrationOptions } from '@simplewebauthn/server';
import { UserRepository } from '@/repositories/user.repository';
import { cookies } from 'next/headers';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/passkeys/register/options
 *
 * Generates WebAuthn registration options for adding a new passkey.
 * Stores the challenge in an HTTP-only cookie.
 *
 * @security Requires authentication.
 */
export const POST = apiHandler(
  withAuth(async (request, { userId }) => {
    const user = await UserRepository.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const host = request.headers.get('host') || 'localhost';
    const rpID = host.split(':')[0];

    const options = await generateRegistrationOptions({
      rpName: 'Wealth AI',
      rpID,
      userID: Uint8Array.from(Buffer.from(String(user.id))),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    const cookieStore = await cookies();
    cookieStore.set('wai-passkey-reg-challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && !rpID.includes('localhost'),
      sameSite: 'strict',
      maxAge: 300, // 5 minutes
      path: '/',
    });

    return NextResponse.json(options);
  })
);
