import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { isValidCurrency } from '@/lib/validation';

// In-memory cache to avoid hitting external APIs too frequently
/* eslint-disable @typescript-eslint/no-explicit-any */
let cachedRates: Record<string, any> | null = null;
let cachedRatesTime = 0;
const RATES_CACHE_TTL = 3600 * 1000; // 1 hour

let cachedNews: Record<string, any>[] | null = null;
let cachedNewsTime = 0;
const NEWS_CACHE_TTL = 1800 * 1000; // 30 mins

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

        if (type === 'news') {
            if (cachedNews && (Date.now() - cachedNewsTime < NEWS_CACHE_TTL)) {
                return NextResponse.json({ news: cachedNews });
            }

            const headlines = [
                { id: 1, title: "Global Markets Rally as Tech Stocks Surge", source: "Financial Times", time: "2h ago", sentiment: "positive" },
                { id: 2, title: "Federal Reserve Hints at Possible Rate Cuts Later This Year", source: "Reuters", time: "4h ago", sentiment: "neutral" },
                { id: 3, title: "Oil Prices Dip Amidst Growing Supply Chain Concerns", source: "Bloomberg", time: "5h ago", sentiment: "negative" },
                { id: 4, title: "Emerging Markets See Record Inflows This Quarter", source: "WSJ", time: "8h ago", sentiment: "positive" },
                { id: 5, title: "Cryptocurrency Volatility Spikes Ahead of Regulatory Review", source: "CoinDesk", time: "12h ago", sentiment: "neutral" }
            ];

            cachedNews = headlines;
            cachedNewsTime = Date.now();

            return NextResponse.json({ news: headlines });
        }

        return NextResponse.json({ error: 'Invalid type requested' }, { status: 400 });

    } catch (error) {
        console.error('Market API error:', error);
        return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 500 });
    }
}
