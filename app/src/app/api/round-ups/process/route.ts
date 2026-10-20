export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { POST as cronSweepPost } from '@/app/api/cron/round-up-sweep/route';

export async function POST(request: NextRequest, context: any) {
  return cronSweepPost(request, context);
}
