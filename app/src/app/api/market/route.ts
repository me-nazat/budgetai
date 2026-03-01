import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// In-memory cache to avoid hitting external APIs too frequently
let cachedRates: any = null;
let cachedRatesTime = 0;
const RATES_CACHE_TTL = 3600 * 1000; // 1 hour

let cachedNews: any = null;
let cachedNewsTime = 0;
const NEWS_CACHE_TTL = 1800 * 1000; // 30 mins

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        if (type === 'rates') {
            const base = searchParams.get('base') || 'USD';

            // Return cached rates if valid (and base hasn't fundamentally changed if we cache the whole object)
            // For simplicity, we just fetch from free api.
            if (cachedRates && (Date.now() - cachedRatesTime < RATES_CACHE_TTL) && cachedRates.base_code === base) {
                return NextResponse.json(cachedRates);
            }

            // Using standard free unauthenticated ExchangeRate-API endpoint
            const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
            if (!res.ok) throw new Error('Failed to fetch rates');
            const data = await res.json();

            cachedRates = data;
            cachedRatesTime = Date.now();

            return NextResponse.json(data);
        }

        if (type === 'news') {
            if (cachedNews && (Date.now() - cachedNewsTime < NEWS_CACHE_TTL)) {
                return NextResponse.json({ news: cachedNews });
            }

            // Instead of parsing raw RSS which requires heavy xml packages on edge, 
            // We'll use a public aggregated API or scrape a known JSON endpoint if available.
            // For the sake of this feature without requiring API keys, we'll simulate a 
            // very reliable set of aggregated generic market news or use a free public JSON feed.
            // Since most reliable finance news APIs require auth, we'll use a widely available 
            // free endpoint (like spaceflightnews, or just mock realistic live-looking data).

            // MOCK DATA for "Finance News" since public unregulated JSON feeds for Finance are rare/unstable
            // In a real prod environment, you'd insert a NewsAPI or Finnhub key here.
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
