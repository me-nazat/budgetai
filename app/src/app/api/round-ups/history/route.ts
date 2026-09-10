import { NextRequest, NextResponse } from 'next/server';

/**
 * 301 Permanent Redirect: /api/round-ups/history -> /api/round-up/history
 * Reconciles route family into single canonical /api/round-up endpoint.
 */
export async function GET(request: NextRequest) {
  const url = new URL('/api/round-up/history', request.url);
  return NextResponse.redirect(url, 301);
}
