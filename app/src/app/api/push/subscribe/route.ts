export const dynamic = 'force-dynamic';

/**
 * @fileoverview Push notification subscription endpoints.
 *
 * POST — Subscribe a device for push notifications
 * DELETE — Unsubscribe a device
 * GET — Returns the VAPID public key for client subscription
 *
 * @module api/push/subscribe
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { PushService } from '@/services/push.service';

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const UnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

/**
 * GET /api/push/subscribe
 * Returns the VAPID public key for client-side PushManager.subscribe().
 */
export const GET = apiHandler(async () => {
  const publicKey = PushService.getPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: 'Push notifications not configured' },
      { status: 503 }
    );
  }
  return NextResponse.json({ publicKey });
});

/**
 * POST /api/push/subscribe
 * Registers a push subscription for the authenticated user.
 */
export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const validated = SubscribeSchema.parse(body);

    const id = await PushService.subscribe(userId, validated);

    return NextResponse.json({ subscriptionId: id, message: 'Subscribed to push notifications' });
  }),
  { rateLimit: 'api' }
);

/**
 * DELETE /api/push/subscribe
 * Removes a push subscription for the authenticated user.
 */
export const DELETE = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const validated = UnsubscribeSchema.parse(body);

    await PushService.unsubscribe(userId, validated.endpoint);

    return NextResponse.json({ message: 'Unsubscribed from push notifications' });
  })
);
