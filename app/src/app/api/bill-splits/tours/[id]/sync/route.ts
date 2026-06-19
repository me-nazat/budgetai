import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne } from '@/lib/db';
import { addSyncClient } from '@/lib/tour-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const tourId = parseInt(id, 10);
  if (!Number.isFinite(tourId) || tourId < 1) {
    return NextResponse.json({ error: 'Invalid tour ID' }, { status: 400 });
  }

  // Check if user is creator or participant
  const tour = await queryOne<{ id: number }>(
    `SELECT DISTINCT t.id
     FROM tours t
     LEFT JOIN tour_participants tp ON tp.tour_id = t.id
     WHERE t.id = ?
       AND (t.created_by = ? OR tp.user_id = ?)`,
    [tourId, session.userId, session.userId]
  );

  if (!tour) {
    return NextResponse.json({ error: 'Tour not found or access denied' }, { status: 403 });
  }

  let removeClient: (() => void) | null = null;
  let keepAliveInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      removeClient = addSyncClient(tourId, session.userId, controller);
      
      // Send initial connect message
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`));

      // Keep-alive ping every 20 seconds
      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch (err) {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
        }
      }, 20000);
    },
    cancel() {
      if (removeClient) removeClient();
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
