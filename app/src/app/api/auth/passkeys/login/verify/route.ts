export const dynamic = 'force-dynamic';

import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { UserRepository } from '@/repositories/user.repository';
import { AuthService } from '@/services/auth.service';
import { cookies } from 'next/headers';
import { apiHandler } from '@/lib/middleware/api-handler';
import { NextResponse } from 'next/server';
import { AuditService } from '@/services/audit.service';
import { getClientIP } from '@/lib/security/rate-limiter';

/**
 * POST /api/auth/passkeys/login/verify
 *
 * Verifies WebAuthn authentication response, completes login,
 * and sets session cookies.
 */
export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const { response, rememberMe } = body;

  const cookieStore = await cookies();
  const expectedChallenge = cookieStore.get('wai-passkey-auth-challenge')?.value;

  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Authentication challenge not found or expired' }, { status: 400 });
  }

  // Find passkey in database
  const userPasskey = await UserRepository.findPasskeyByCredentialId(response.id);
  if (!userPasskey) {
    return NextResponse.json({ error: 'Credential not found' }, { status: 400 });
  }

  const host = request.headers.get('host') || 'localhost';
  const rpID = host.split(':')[0];
  const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
  const expectedOrigin = `${protocol}://${host}`;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: userPasskey.credentialId,
        publicKey: Buffer.from(userPasskey.publicKey, 'base64url'),
        counter: userPasskey.signCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 400 });
  }

  const { verified, authenticationInfo } = verification;

  if (!verified || !authenticationInfo) {
    return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
  }

  const { newCounter } = authenticationInfo;

  // Update sign count
  await UserRepository.updatePasskeySignCount(userPasskey.credentialId, newCounter);

  // Retrieve user
  const user = await UserRepository.findById(userPasskey.userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 400 });
  }

  // Complete login (creates session, sets cookies, audit logs)
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || undefined;

  const result = await AuthService.completeLogin(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency,
    },
    { ip, userAgent, request },
    rememberMe
  );

  // Clear challenge cookie
  cookieStore.delete('wai-passkey-auth-challenge');

  // Log specific passkey authenticate action
  AuditService.logAction({
    userId: user.id,
    action: 'PASSKEY_AUTHENTICATE',
    entityType: 'user',
    entityId: userPasskey.credentialId,
    ip,
  });

  return NextResponse.json({ user: result.user });
});
