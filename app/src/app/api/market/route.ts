export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { isValidCurrency } from '@/lib/validation';

// In-memory cache to avoid hitting external APIs too frequently
 
let cachedRates: Record<string, any> | null = null;
let cachedRatesTime = 0;
const RATES_CACHE_TTL = 3600 * 1000; // 1 hour

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        if (type === 'rates') {
            const base = (searchParams.get('base') || 'BDT').toUpperCase();

            // Validate currency code to prevent SSRF
            if (!isValidCurrency(base)) {
                return NextResponse.json({ error: 'Invalid currency code' }, { status: 400 });
            }

            // Return cached rates if valid
            if (cachedRates && (Date.now() - cachedRatesTime < RATES_CACHE_TTL) && cachedRates.base_code === base) {
                return NextResponse.json(cachedRates);
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            try {
                const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
                    signal: controller.signal,
                });
                clearTimeout(timeout);

                if (!res.ok) throw new Error('Failed to fetch rates');
                const data = await res.json();

                cachedRates = data;
                cachedRatesTime = Date.now();

                return NextResponse.json(data);
            } catch (fetchErr) {
                clearTimeout(timeout);
                throw fetchErr;
            }
        }

        if (type === 'quote') {
            const ticker = (searchParams.get('ticker') || '').toUpperCase();
            if (!ticker) {
                return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
            }

            // Return clean reference quote for holdings
            return NextResponse.json({
                ticker,
                price: 100.0,
                updatedAt: new Date().toISOString(),
            });
        }

        return NextResponse.json({ error: 'Invalid type requested' }, { status: 400 });

    } catch (error) {
        console.error('Market API error:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
