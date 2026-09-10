import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { db } from '@/db/client';
import { householdMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { addHouseholdSyncClient } from '@/lib/household-sync';

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
  const householdId = parseInt(id, 10);
  if (!Number.isFinite(householdId) || householdId < 1) {
    return NextResponse.json({ error: 'Invalid household ID' }, { status: 400 });
  }

  // Check if user is a member of the household
  const [membership] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, session.userId)
      )
    )
    .limit(1);

  if (!membership) {
    return NextResponse.json({ error: 'Household not found or access denied' }, { status: 403 });
  }

  let removeClient: (() => void) | null = null;
  let keepAliveInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      removeClient = addHouseholdSyncClient(householdId, session.userId, controller);

      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'CONNECTED' })}\n\n`));

      keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
        }
      }, 20000);
    },
    cancel() {
      if (removeClient) removeClient();
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
