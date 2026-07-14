export const dynamic = 'force-dynamic';

import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { UserRepository } from '@/repositories/user.repository';
import { cookies } from 'next/headers';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { NextResponse } from 'next/server';
import { AuditService } from '@/services/audit.service';
import { getClientIP } from '@/lib/security/rate-limiter';

/**
 * POST /api/auth/passkeys/register/verify
 *
 * Verifies WebAuthn registration response and registers the passkey.
 * Clears the temporary registration challenge.
 *
 * @security Requires authentication.
 */
export const POST = apiHandler(
  withAuth(async (request, { userId }) => {
    const body = await request.json();
    const { response, name } = body;

    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('wai-passkey-reg-challenge')?.value;

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Registration challenge not found or expired' }, { status: 400 });
    }

    const host = request.headers.get('host') || 'localhost';
    const rpID = host.split(':')[0];
    const protocol = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
    const expectedOrigin = `${protocol}://${host}`;

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 400 });
    }

    const { verified, registrationInfo } = verification;

    if (!verified || !registrationInfo) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 });
    }

    const { credential } = registrationInfo;
    const { id: credentialIdBase64, publicKey: credentialPublicKey, counter } = credential;
    const credentialAlgorithm = -7;

    // Convert keys to base64url for database storage
    const publicKeyBase64 = Buffer.from(credentialPublicKey).toString('base64url');

    // Extract transports
    const transports = credential.transports ? JSON.stringify(credential.transports) : (response.response?.transports ? JSON.stringify(response.response.transports) : undefined);

    // Save passkey
    await UserRepository.createPasskey({
      userId,
      name: name || 'My Passkey',
      credentialId: credentialIdBase64,
      publicKey: publicKeyBase64,
      signCount: counter,
      algorithm: credentialAlgorithm,
      transports,
    });

    // Clear challenge cookie
    cookieStore.delete('wai-passkey-reg-challenge');

    const ip = getClientIP(request);
    AuditService.logAction({
      userId,
      action: 'PASSKEY_REGISTER',
      entityType: 'user',
      entityId: credentialIdBase64,
      ip,
    });

    return NextResponse.json({ success: true, message: 'Passkey registered successfully' });
  })
);
