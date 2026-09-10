import { NextRequest, NextResponse } from 'next/server';

/**
 * 301 Permanent Redirect: /api/round-ups -> /api/round-up
 * Reconciles route family into single canonical /api/round-up endpoint.
 */
export async function GET(request: NextRequest) {
  const url = new URL('/api/round-up', request.url);
  return NextResponse.redirect(url, 301);
}

export async function POST(request: NextRequest) {
  const url = new URL('/api/round-up', request.url);
  return NextResponse.redirect(url, 308); // 308 preserves POST method & body
}
