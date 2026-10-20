export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { NetWorthService } from '@/services/networth.service';
import { sanitizeText } from '@/lib/validation';
import { getClientIP } from '@/lib/security/rate-limiter';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = await NetWorthService.getNetWorthBreakdown(session.userId);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Net worth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const amount = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
    const note = sanitizeText(body.note, 200);

    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });
    }

    const ip = getClientIP(request);
    const entry = await NetWorthService.create(
      session.userId,
      { amount, note },
      { ip, userAgent: request.headers.get('user-agent') || undefined }
    );

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Net worth create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
